import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Building2,
  ChevronRight,
  Layers,
  Mail,
  MapPin,
  Phone,
  Search,
  Upload,
  User,
  Wrench,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { getOccupants, getPatrimoine, getTravaux } from "@/lib/isis.functions";
import { isLogement, typeLotLabel } from "@/lib/isis";
import { collator, entreeDe, estGarage, pushRecent, rueDe, type LotItem } from "@/lib/adresses";

type AdressesSearch = {
  q: string;
  ville: string | undefined;
  tranche: string | undefined;
  rue: string | undefined;
  adresse: string | undefined;
};

type TravauxScope =
  | { niveau: "ville"; label: string; ville: string }
  | { niveau: "tranche"; label: string; trancheCode: string }
  | { niveau: "lot"; label: string; lotCode: string; trancheCode: string };

export const Route = createFileRoute("/adresses")({
  validateSearch: (search: Record<string, unknown>): AdressesSearch => ({
    q: typeof search["q"] === "string" ? search["q"] : "",
    ville:
      typeof search["ville"] === "string" && search["ville"] !== "toutes"
        ? search["ville"]
        : undefined,
    tranche: typeof search["tranche"] === "string" ? search["tranche"] : undefined,
    rue: typeof search["rue"] === "string" ? search["rue"] : undefined,
    adresse: typeof search["adresse"] === "string" ? search["adresse"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Patrimoine par ville, tranche et adresse" },
      {
        name: "description",
        content:
          "Parcourez le patrimoine ville par ville : tranches, adresses puis lots, avec fiche locataire et filtre garages.",
      },
      { property: "og:title", content: "Patrimoine par ville, tranche et adresse" },
      {
        property: "og:description",
        content: "Navigation ville → tranche → adresse → lot avec fiches locataires.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdressesPage,
  errorComponent: ({ error }) => (
    <p role="alert" className="p-8 text-center text-sm text-destructive">
      {error.message}
    </p>
  ),
  notFoundComponent: () => <p className="p-8 text-center text-sm">Aucune adresse.</p>,
});

function AdressesPage() {
  const { q, ville, tranche, rue, adresse } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const setSearch = (patch: Partial<AdressesSearch>) =>
    navigate({ search: (prev: AdressesSearch) => ({ ...prev, ...patch }) });

  const fetchPatrimoine = useServerFn(getPatrimoine);
  const { data, isLoading } = useQuery({
    queryKey: ["patrimoine"],
    queryFn: () => fetchPatrimoine(),
  });

  const [fiche, setFiche] = useState<LotItem | null>(null);
  const [ficheLogement, setFicheLogement] = useState<LotItem | null>(null);
  const [travauxScope, setTravauxScope] = useState<TravauxScope | null>(null);

  const lots = (data?.lots ?? []) as LotItem[];
  const libelles = useMemo(
    () => new Map((data?.tranches ?? []).map((t) => [t.code, t.libelle ?? ""])),
    [data],
  );

  const filtres = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return lots.filter((l) => {
      if (estGarage(l)) return false;
      if (!needle) return true;
      return [l.code_patrimoine, l.adresse, l.ville, l.locataire_nom, l.tranche_code]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [lots, q]);

  const villes = useMemo(() => {
    const map = new Map<string, { lots: LotItem[]; tranches: Set<string> }>();
    for (const l of filtres) {
      const v = l.ville ?? "Ville inconnue";
      const g = map.get(v) ?? { lots: [], tranches: new Set<string>() };
      g.lots.push(l);
      g.tranches.add(l.tranche_code);
      map.set(v, g);
    }
    return [...map.entries()].sort((a, b) => collator.compare(a[0], b[0]));
  }, [filtres]);

  const dansVille = useMemo(
    () => (ville ? filtres.filter((l) => (l.ville ?? "Ville inconnue") === ville) : []),
    [filtres, ville],
  );

  const tranches = useMemo(() => {
    const map = new Map<string, LotItem[]>();
    for (const l of dansVille) map.set(l.tranche_code, [...(map.get(l.tranche_code) ?? []), l]);
    return [...map.entries()].sort((a, b) => collator.compare(a[0], b[0]));
  }, [dansVille]);

  const dansTranche = useMemo(
    () => (tranche ? dansVille.filter((l) => l.tranche_code === tranche) : []),
    [dansVille, tranche],
  );

  const rues = useMemo(() => {
    const map = new Map<string, LotItem[]>();
    for (const l of dansTranche) {
      const r = rueDe(l.adresse);
      map.set(r, [...(map.get(r) ?? []), l]);
    }
    return [...map.entries()].sort((a, b) => collator.compare(a[0], b[0]));
  }, [dansTranche]);

  const lotsAffiches = useMemo(
    () =>
      (adresse
        ? filtres.filter((l) => entreeDe(l.adresse) === adresse)
        : rue
          ? dansTranche.filter((l) => rueDe(l.adresse) === rue)
          : []
      ).sort(
        (a, b) =>
          collator.compare(a.adresse ?? "", b.adresse ?? "") ||
          collator.compare(a.etage ?? "", b.etage ?? "") ||
          collator.compare(a.code_patrimoine, b.code_patrimoine),
      ),
    [adresse, dansTranche, filtres, rue],
  );

  const niveau = adresse
    ? "lots"
    : !ville
      ? "villes"
      : !tranche
        ? "tranches"
        : !rue
          ? "rues"
          : "lots";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-4 sm:px-6">
          <div className="mr-auto">
            <h1 className="text-lg font-semibold leading-tight">Patrimoine</h1>
            <p className="text-sm text-muted-foreground">Ville → tranche → adresse → lot</p>
          </div>
          <Button asChild variant="outline">
            <Link to="/">Accueil</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/import">
              <Upload className="size-4" /> Import ISIS
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
        <section className="rounded-xl border bg-card shadow-panel">
          <div className="border-b p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Rue, ville, code lot, locataire…"
                value={q}
                onChange={(e) => setSearch({ q: e.target.value })}
              />
            </div>
          </div>

          {(ville || q || adresse) && (
            <nav className="flex flex-wrap items-center gap-1 border-b p-3 text-sm">
              <button
                className="text-primary hover:underline"
                onClick={() =>
                  setSearch({
                    ville: undefined,
                    tranche: undefined,
                    rue: undefined,
                    adresse: undefined,
                  })
                }
              >
                Toutes les villes
              </button>
              {ville && (
                <>
                  <ChevronRight className="size-4 text-muted-foreground" />
                  <button
                    className={tranche || adresse ? "text-primary hover:underline" : "font-medium"}
                    onClick={() =>
                      setSearch({ tranche: undefined, rue: undefined, adresse: undefined })
                    }
                  >
                    {ville}
                  </button>
                </>
              )}
              {tranche && (
                <>
                  <ChevronRight className="size-4 text-muted-foreground" />
                  <button
                    className={rue ? "text-primary hover:underline" : "font-medium"}
                    onClick={() => setSearch({ rue: undefined, adresse: undefined })}
                  >
                    Tranche {tranche}
                  </button>
                </>
              )}
              {rue && (
                <>
                  <ChevronRight className="size-4 text-muted-foreground" />
                  <span className="font-medium">{rue}</span>
                </>
              )}
              {adresse && (
                <>
                  <ChevronRight className="size-4 text-muted-foreground" />
                  <span className="font-medium">{adresse}</span>
                </>
              )}
            </nav>
          )}

          {isLoading ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Chargement du patrimoine…
            </p>
          ) : filtres.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Aucun résultat.</p>
          ) : niveau === "villes" ? (
            <ul className="divide-y">
              {villes.map(([v, g]) => (
                <RowButton
                  key={v}
                  icon={<MapPin className="size-4" />}
                  title={v}
                  subtitle={`${g.tranches.size} tranches`}
                  count={`${g.lots.length} lots`}
                  action={
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        setTravauxScope({ niveau: "ville", label: v, ville: v });
                      }}
                    >
                      <Wrench className="size-4" /> Travaux
                    </Button>
                  }
                  onClick={() =>
                    setSearch({ ville: v, tranche: undefined, rue: undefined, adresse: undefined })
                  }
                />
              ))}
            </ul>
          ) : niveau === "tranches" ? (
            <ul className="divide-y">
              {tranches.map(([t, items]) => (
                <RowButton
                  key={t}
                  icon={<Layers className="size-4" />}
                  title={`Tranche ${t}${libelles.get(t) ? ` — ${libelles.get(t)}` : ""}`}
                  subtitle={`${new Set(items.map((i) => rueDe(i.adresse))).size} adresses · ${
                    items.filter((i) => isLogement(i.type_lot)).length
                  } logements`}
                  count={`${items.length} lots`}
                  action={
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        setTravauxScope({ niveau: "tranche", label: `Tranche ${t}`, trancheCode: t });
                      }}
                    >
                      <Wrench className="size-4" /> Travaux
                    </Button>
                  }
                  onClick={() => setSearch({ tranche: t, rue: undefined, adresse: undefined })}
                />
              ))}
            </ul>
          ) : niveau === "rues" ? (
            <ul className="divide-y">
              {rues.map(([r, items]) => (
                <RowButton
                  key={r}
                  icon={<Building2 className="size-4" />}
                  title={r}
                  subtitle={ville ?? ""}
                  count={`${items.length} lots`}
                  onClick={() => {
                    pushRecent({ rue: r, ville: ville ?? "", lots: items.length });
                    setSearch({ rue: r, adresse: undefined });
                  }}
                />
              ))}
            </ul>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lot</TableHead>
                      <TableHead>Adresse</TableHead>
                      <TableHead>Étage / Porte</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Surface</TableHead>
                      <TableHead>Locataire</TableHead>
                      <TableHead className="text-right">DPE</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lotsAffiches.map((l) => (
                      <TableRow key={l.code_patrimoine}>
                        <TableCell className="font-mono text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <LotLien lot={l} onOpen={setFicheLogement} />
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Afficher les travaux du lot ${l.code_patrimoine}`}
                              onClick={() =>
                                setTravauxScope({
                                  niveau: "lot",
                                  label: `Lot ${l.code_patrimoine}`,
                                  lotCode: l.code_patrimoine,
                                  trancheCode: l.tranche_code,
                                })
                              }
                            >
                              <Wrench className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-56 truncate text-sm">
                          {l.adresse || "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {l.etage || "—"} / {l.porte || "—"}
                        </TableCell>
                        <TableCell className="text-sm">{typeLotLabel(l.type_lot)}</TableCell>
                        <TableCell className="tabnum text-sm">
                          {l.surface_utile ? `${l.surface_utile} m²` : "—"}
                        </TableCell>
                        <TableCell className="max-w-48 truncate text-sm">
                          <LocataireLien lot={l} onOpen={setFiche} />
                        </TableCell>
                        <TableCell className="text-right">
                          {l.dpe ? <Badge variant="secondary">{l.dpe}</Badge> : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <ul className="divide-y md:hidden">
                {lotsAffiches.map((l) => (
                  <li key={l.code_patrimoine} className="space-y-1 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <LotLien lot={l} onOpen={setFicheLogement} />
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Afficher les travaux du lot ${l.code_patrimoine}`}
                          onClick={() =>
                            setTravauxScope({
                              niveau: "lot",
                              label: `Lot ${l.code_patrimoine}`,
                              lotCode: l.code_patrimoine,
                              trancheCode: l.tranche_code,
                            })
                          }
                        >
                          <Wrench className="size-4" />
                        </Button>
                      </div>
                      <Badge variant="secondary">{typeLotLabel(l.type_lot)}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {l.adresse} · Étage {l.etage || "—"} · Porte {l.porte || "—"}
                    </p>
                    <div className="text-sm">
                      <LocataireLien lot={l} onOpen={setFiche} />
                    </div>
                  </li>
                ))}
              </ul>

              <p className="border-t p-3 text-sm text-muted-foreground">
                {lotsAffiches.length} lots à cette adresse
              </p>
            </>
          )}
        </section>

        {q.trim() && (
          <section className="rounded-xl border bg-card p-3 text-sm text-muted-foreground shadow-panel">
            {filtres.length} lots correspondent à « {q} ». Cliquez sur un lot ou un nom de locataire
            pour ouvrir sa fiche.
          </section>
        )}
      </main>

      <FicheLocataire lot={fiche} onClose={() => setFiche(null)} />
      <FicheLogement lot={ficheLogement} onClose={() => setFicheLogement(null)} />
      <TravauxDialog scope={travauxScope} onClose={() => setTravauxScope(null)} />
    </div>
  );
}

function LotLien({ lot, onOpen }: { lot: LotItem; onOpen: (l: LotItem) => void }) {
  return (
    <button
      className="font-mono text-left font-medium text-primary hover:underline"
      onClick={() => onOpen(lot)}
    >
      {lot.code_patrimoine}
    </button>
  );
}

function LocataireLien({ lot, onOpen }: { lot: LotItem; onOpen: (l: LotItem) => void }) {
  if (!lot.locataire_nom) return <span className="text-muted-foreground">Vacant</span>;
  return (
    <button className="truncate text-left text-primary hover:underline" onClick={() => onOpen(lot)}>
      {lot.locataire_nom}
    </button>
  );
}

function FicheLogement({ lot, onClose }: { lot: LotItem | null; onClose: () => void }) {
  return (
    <Dialog open={!!lot} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        {lot && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="size-4 text-primary" /> Fiche logement
              </DialogTitle>
              <DialogDescription>
                Lot {lot.code_patrimoine} · Tranche {lot.tranche_code}
              </DialogDescription>
            </DialogHeader>

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Info label="Adresse" value={lot.adresse} />
              <Info label="Ville" value={`${lot.code_postal ?? ""} ${lot.ville ?? ""}`.trim()} />
              <Info label="Bâtiment" value={lot.batiment} />
              <Info label="Étage / Porte" value={`${lot.etage || "—"} / ${lot.porte || "—"}`} />
              <Info label="Type de lot" value={typeLotLabel(lot.type_lot)} />
              <Info label="Surface" value={lot.surface_utile ? `${lot.surface_utile} m²` : null} />
              <Info label="DPE" value={lot.dpe} />
            </dl>

            <TravauxList
              scope={{
                niveau: "lot",
                label: `Lot ${lot.code_patrimoine}`,
                lotCode: lot.code_patrimoine,
                trancheCode: lot.tranche_code,
              }}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function FicheLocataire({ lot, onClose }: { lot: LotItem | null; onClose: () => void }) {
  const fetchOccupants = useServerFn(getOccupants);
  const { data: occupants } = useQuery({
    queryKey: ["occupants", lot?.code_patrimoine],
    queryFn: () => fetchOccupants({ data: { lotCode: lot!.code_patrimoine } }),
    enabled: !!lot,
  });

  return (
    <Dialog open={!!lot} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        {lot && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <User className="size-4 text-primary" /> {lot.locataire_nom}
              </DialogTitle>
              <DialogDescription>
                Lot {lot.code_patrimoine} · Tranche {lot.tranche_code}
              </DialogDescription>
            </DialogHeader>

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Info
                label="Téléphone"
                value={lot.locataire_telephone}
                icon={<Phone className="size-3.5" />}
              />
              <Info
                label="E-mail"
                value={lot.locataire_email}
                icon={<Mail className="size-3.5" />}
              />
              <Info label="Date d'entrée" value={formatDate(lot.date_entree)} />
              <Info label="Type de lot" value={typeLotLabel(lot.type_lot)} />
              <Info label="Adresse" value={`${lot.adresse ?? "—"}`} />
              <Info label="Ville" value={`${lot.code_postal ?? ""} ${lot.ville ?? ""}`.trim()} />
              <Info label="Bâtiment" value={lot.batiment} />
              <Info label="Étage / Porte" value={`${lot.etage || "—"} / ${lot.porte || "—"}`} />
              <Info label="Surface" value={lot.surface_utile ? `${lot.surface_utile} m²` : null} />
              <Info label="DPE" value={lot.dpe} />
            </dl>

            <div>
              <h3 className="mb-2 text-sm font-semibold">Occupants enregistrés</h3>
              {!occupants || occupants.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun occupant enregistré.</p>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {occupants.map((o, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 p-2 text-sm">
                      <span className="truncate">
                        {[o.prenom, o.nom].filter(Boolean).join(" ") || "—"}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        Entré le {formatDate(o.date_entree)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

type TravailRow = {
  id: string;
  niveau: string;
  tranche_code: string | null;
  batiment: string | null;
  lot_code: string | null;
  libelle: string;
  statut: string;
  date_travaux: string | null;
  cout: number;
  note: string | null;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  etage: string | null;
  porte: string | null;
};

function TravauxDialog({
  scope,
  onClose,
}: {
  scope: TravauxScope | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!scope} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        {scope && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wrench className="size-4 text-primary" /> Travaux
              </DialogTitle>
              <DialogDescription>{scope.label}</DialogDescription>
            </DialogHeader>
            <TravauxList scope={scope} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TravauxList({ scope }: { scope: TravauxScope }) {
  const fetchTravaux = useServerFn(getTravaux);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["travaux", scope],
    queryFn: () =>
      fetchTravaux({
        data:
          scope.niveau === "ville"
            ? { niveau: "ville", ville: scope.ville }
            : scope.niveau === "tranche"
              ? { niveau: "tranche", trancheCode: scope.trancheCode }
              : {
                  niveau: "lot",
                  lotCode: scope.lotCode,
                  trancheCode: scope.trancheCode,
                },
      }),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement des travaux…</p>;
  if (isError) return <p className="text-sm text-destructive">Impossible de charger les travaux.</p>;
  if (!data?.length) return <p className="text-sm text-muted-foreground">Aucun travail enregistré.</p>;

  return (
    <ul className="max-h-[55vh] divide-y overflow-y-auto rounded-lg border">
      {(data as TravailRow[]).map((travail) => (
        <li key={travail.id} className="space-y-2 p-3 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="font-medium">{travail.libelle}</p>
            <TravauxStatus statut={travail.statut} />
          </div>
          <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
            <span>{travail.adresse || "Adresse non précisée"}{travail.etage || travail.porte ? ` · ${travail.etage || "—"} / ${travail.porte || "—"}` : ""}</span>
            <span>{travail.tranche_code ? `Tranche ${travail.tranche_code}` : "Tranche non précisée"}{travail.batiment ? ` · Bât. ${travail.batiment}` : ""}</span>
            <span>{travail.date_travaux ? formatDate(travail.date_travaux) : "Date non précisée"}</span>
            <span>{new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(travail.cout || 0)}</span>
          </div>
          {travail.note && <p className="text-xs text-muted-foreground">{travail.note}</p>}
        </li>
      ))}
    </ul>
  );
}

function TravauxStatus({ statut }: { statut: string }) {
  const labels: Record<string, string> = {
    realise: "Réalisé",
    planifie: "Planifié",
    a_prevoir: "À prévoir",
  };
  return <Badge variant="outline">{labels[statut] ?? statut}</Badge>;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("fr-FR");
}

function Info({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | null | undefined;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
        {icon} {label}
      </dt>
      <dd className="mt-0.5 break-words">{value || "—"}</dd>
    </div>
  );
}

function RowButton({
  icon,
  title,
  subtitle,
  count,
  action,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  count: string;
  action?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        onClick={onClick}
        className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-accent/50"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{title}</span>
          <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
        </span>
        <span className="tabnum shrink-0 text-xs text-muted-foreground">{count}</span>
        {action}
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>
    </li>
  );
}
