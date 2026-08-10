import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import {
  Building2,
  ChevronRight,
  Filter,
  Info as InfoIcon,
  Mail,
  MapPin,
  Phone,
  Search,
  User,
  Wrench,
  Calendar,
} from "lucide-react";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getAdresses,
  getOccupants,
  getTravaux,
  type LotItem,
  type TravauxScope,
} from "@/lib/isis.functions";

const searchSchema = z.object({
  q: z.string().optional(),
  ville: z.string().optional(),
  tranche: z.string().optional(),
  rue: z.string().optional(),
  adresse: z.string().optional(),
});

export const Route = createFileRoute("/adresses")({
  validateSearch: searchSchema,
  component: AdressesPage,
});

function AdressesPage() {
  const { q, ville, tranche, rue, adresse } = Route.useSearch();
  const navigate = Route.useNavigate();
  const fetchAdresses = useServerFn(getAdresses);

  const { data, isLoading } = useQuery({
    queryKey: ["adresses", q, ville, tranche, rue, adresse],
    queryFn: () => fetchAdresses({ data: { q, ville, tranche, rue, adresse } }),
  });

  type AdresseTree = Record<string, Record<string, Record<string, LotItem[]>>>;

  const hierarchy = useMemo(() => {
    if (!data) return null;
    const lots = data as LotItem[];

    // Groupement hiérarchique
    const tree: AdresseTree = {};
    lots.forEach((lot) => {
      const v = lot.ville || "Ville inconnue";
      const t = lot.tranche_code || "Sans tranche";
      const r = lot.adresse || "Adresse inconnue";

      if (!tree[v]) tree[v] = {};
      if (!tree[v][t]) tree[v][t] = {};
      if (!tree[v][t][r]) tree[v][t][r] = [];
      tree[v][t][r].push(lot);
    });
    return tree;
  }, [data]);

  const [selectedLot, setSelectedLot] = useState<LotItem | null>(null);
  const [selectedLocataire, setSelectedLocataire] = useState<LotItem | null>(null);
  const [travauxScope, setTravauxScope] = useState<TravauxScope | null>(null);

  const handleSearch = (val: string) => {
    navigate({ search: (prev) => ({ ...prev, q: val || undefined }) });
  };

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="container flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Building2 className="size-5 text-primary" />
            <h1 className="text-lg font-semibold tracking-tight">Patrimoine</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Rechercher..."
                className="pl-9"
                defaultValue={q}
                onKeyDown={(e) => e.key === "Enter" && handleSearch(e.currentTarget.value)}
              />
            </div>
            <Button variant="outline" size="icon">
              <Filter className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container flex-1 p-4">
        <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
          <button onClick={() => navigate({ search: {} })} className="hover:text-primary">
            Patrimoine
          </button>
          {ville && (
            <>
              <ChevronRight className="size-3" />{" "}
              <button
                onClick={() => navigate({ search: { ville } })}
                className="hover:text-primary font-medium text-foreground"
              >
                {ville}
              </button>
            </>
          )}
          {tranche && (
            <>
              <ChevronRight className="size-3" />{" "}
              <button
                onClick={() => navigate({ search: { ville, tranche } })}
                className="hover:text-primary font-medium text-foreground"
              >
                {tranche}
              </button>
            </>
          )}
          {rue && (
            <>
              <ChevronRight className="size-3" />{" "}
              <span className="font-medium text-foreground">{rue}</span>
            </>
          )}
        </div>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <p className="text-muted-foreground">Chargement du patrimoine...</p>
          </div>
        ) : !data || data.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
            <InfoIcon className="size-8 text-muted-foreground" />
            <h2 className="text-lg font-medium">Aucun résultat</h2>
            <p className="text-sm text-muted-foreground">
              Essayez de modifier vos filtres ou votre recherche.
            </p>
            <Button variant="outline" onClick={() => handleSearch("")}>
              Réinitialiser la recherche
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {!ville &&
              Object.keys(hierarchy || {}).map((v) => (
                <Button
                  key={v}
                  variant="outline"
                  className="justify-between h-14 px-6 text-lg"
                  onClick={() => navigate({ search: { ville: v } })}
                >
                  <span className="flex items-center gap-3">
                    <MapPin className="size-5 text-primary" /> {v}
                  </span>
                  <ChevronRight className="size-5 text-muted-foreground" />
                </Button>
              ))}

            {ville &&
              !tranche &&
              Object.keys(hierarchy?.[ville] || {}).map((t) => (
                <Button
                  key={t}
                  variant="outline"
                  className="justify-between h-14 px-6"
                  onClick={() => navigate({ search: { ville, tranche: t } })}
                >
                  <span className="flex items-center gap-3">
                    <Building2 className="size-5 text-primary" /> Tranche {t}
                  </span>
                  <ChevronRight className="size-5 text-muted-foreground" />
                </Button>
              ))}

            {ville &&
              tranche &&
              !rue &&
              Object.keys(hierarchy?.[ville]?.[tranche] || {}).map((r) => (
                <Button
                  key={r}
                  variant="outline"
                  className="justify-between h-14 px-6"
                  onClick={() => navigate({ search: { ville, tranche, rue: r } })}
                >
                  <span className="flex items-center gap-3">
                    <MapPin className="size-5 text-primary" /> {r}
                  </span>
                  <ChevronRight className="size-5 text-muted-foreground" />
                </Button>
              ))}

            {(rue || q) && (
              <div className="rounded-lg border bg-background shadow-sm overflow-hidden">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="border-b bg-muted/50 font-medium text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Lot</th>
                      <th className="px-4 py-3">Bâtiment / Porte</th>
                      <th className="px-4 py-3">Locataire</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(data as LotItem[]).map((lot) => (
                      <tr key={lot.code_patrimoine} className="hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-3 font-medium">
                          <button
                            onClick={() => setSelectedLot(lot)}
                            className="text-primary hover:underline"
                          >
                            {lot.code_patrimoine}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {lot.batiment || "—"} {lot.porte ? ` / ${lot.porte}` : ""}
                        </td>
                        <td className="px-4 py-3">
                          {lot.locataire_nom ? (
                            <button
                              onClick={() => setSelectedLocataire(lot)}
                              className="text-muted-foreground hover:text-primary hover:underline"
                            >
                              {lot.locataire_nom}
                            </button>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setTravauxScope({
                                niveau: "lot",
                                label: `Lot ${lot.code_patrimoine}`,
                                lotCode: lot.code_patrimoine,
                                trancheCode: lot.tranche_code,
                              })
                            }
                          >
                            <Wrench className="size-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      <FicheLogement lot={selectedLot} onClose={() => setSelectedLot(null)} />
      <FicheLocataire lot={selectedLocataire} onClose={() => setSelectedLocataire(null)} />
      <TravauxDialog scope={travauxScope} onClose={() => setTravauxScope(null)} />
    </div>
  );
}

function typeLotLabel(type: string | null) {
  const labels: Record<string, string> = {
    LOG: "Logement",
    PAR: "Parking",
    BOX: "Box",
    GAR: "Garage",
    COM: "Commerce",
    BUR: "Bureau",
  };
  return labels[type ?? ""] ?? type ?? "—";
}

function FicheLogement({ lot, onClose }: { lot: LotItem | null; onClose: () => void }) {
  return (
    <Dialog open={!!lot} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        {lot && (
          <>
            <div className="p-6 pb-0">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Building2 className="size-4 text-primary" /> Fiche logement
                </DialogTitle>
                <DialogDescription>
                  Lot {lot.code_patrimoine} · Tranche {lot.tranche_code}
                </DialogDescription>
              </DialogHeader>

              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <Info label="Adresse" value={lot.adresse} />
                <Info label="Ville" value={`${lot.code_postal ?? ""} ${lot.ville ?? ""}`.trim()} />
                <Info label="Bâtiment" value={lot.batiment} />
                <Info label="Étage / Porte" value={`${lot.etage || "—"} / ${lot.porte || "—"}`} />
                <Info label="Type de lot" value={typeLotLabel(lot.type_lot)} />
                <Info
                  label="Surface"
                  value={lot.surface_utile ? `${lot.surface_utile} m²` : null}
                />
                <Info label="DPE" value={lot.dpe} />
              </dl>
            </div>

            <div className="flex-1 overflow-hidden mt-6">
              <Tabs defaultValue="lot" className="h-full flex flex-col">
                <div className="px-6 border-b">
                  <TabsList className="bg-transparent h-auto p-0 gap-6">
                    <TabsTrigger
                      value="lot"
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 pb-2 text-sm font-medium"
                    >
                      Travaux sur ce lot
                    </TabsTrigger>
                    <TabsTrigger
                      value="tranche"
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 pb-2 text-sm font-medium"
                    >
                      Travaux sur cette tranche
                    </TabsTrigger>
                  </TabsList>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                  <TabsContent value="lot" className="m-0">
                    <TravauxList
                      scope={{
                        niveau: "lot",
                        label: `Lot ${lot.code_patrimoine}`,
                        lotCode: lot.code_patrimoine,
                        trancheCode: lot.tranche_code,
                      }}
                    />
                  </TabsContent>
                  <TabsContent value="tranche" className="m-0">
                    <TravauxList
                      scope={{
                        niveau: "tranche",
                        label: `Tranche ${lot.tranche_code}`,
                        trancheCode: lot.tranche_code,
                      }}
                    />
                  </TabsContent>
                </div>
              </Tabs>
            </div>
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
  is_commande?: boolean;
};

function TravauxDialog({ scope, onClose }: { scope: TravauxScope | null; onClose: () => void }) {
  return (
    <Dialog open={!!scope} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        {scope && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wrench className="size-4 text-primary" /> Travaux
              </DialogTitle>
              <DialogDescription>{scope.label}</DialogDescription>
            </DialogHeader>
            <div className="mt-4">
              <TravauxList scope={scope} />
            </div>
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

  const groupedTravaux = useMemo(() => {
    if (!data) return null;
    const groups: Record<string, TravailRow[]> = {};
    (data as TravailRow[]).forEach((t) => {
      const year = t.date_travaux
        ? new Date(t.date_travaux).getFullYear().toString()
        : "Année non précisée";
      if (!groups[year]) groups[year] = [];
      groups[year].push(t);
    });
    return Object.entries(groups).sort((a, b) => {
      if (a[0] === "Année non précisée") return 1;
      if (b[0] === "Année non précisée") return -1;
      return b[0].localeCompare(a[0]);
    });
  }, [data]);

  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement des travaux…</p>;
  if (isError)
    return <p className="text-sm text-destructive">Impossible de charger les travaux.</p>;
  if (!data?.length)
    return <p className="text-sm text-muted-foreground">Aucun travail enregistré.</p>;

  return (
    <div className="space-y-6">
      {groupedTravaux?.map(([year, travaux]) => (
        <div key={year} className="space-y-3">
          <h4 className="flex items-center gap-2 text-sm font-bold text-primary">
            <Calendar className="size-4" /> {year}
          </h4>
          <ul className="divide-y rounded-lg border bg-card">
            {travaux.map((travail) => (
              <li key={travail.id} className="space-y-2 p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium">{travail.libelle}</p>
                  <TravauxStatus statut={travail.statut} />
                </div>
                <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                  <span>
                    {travail.adresse || "Adresse non précisée"}
                    {travail.etage || travail.porte
                      ? ` · ${travail.etage || "—"} / ${travail.porte || "—"}`
                      : ""}
                  </span>
                  <span>
                    {travail.tranche_code
                      ? `Tranche ${travail.tranche_code}`
                      : "Tranche non précisée"}
                    {travail.batiment ? ` · Bât. ${travail.batiment}` : ""}
                  </span>
                  <span>
                    {travail.is_commande && (
                      <Badge
                        variant="outline"
                        className="mr-2 bg-blue-50 text-blue-600 border-blue-200 text-[9px] font-black uppercase py-0 px-1"
                      >
                        commande importée
                      </Badge>
                    )}
                    {travail.date_travaux ? formatDate(travail.date_travaux) : "Date non précisée"}
                  </span>
                  <span className="font-semibold text-foreground">
                    {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(
                      travail.cout || 0,
                    )}
                  </span>
                </div>
                {travail.note && (
                  <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded italic border-l-2 border-primary/30">
                    {travail.note}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
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
      <dd className="mt-0.5 break-words font-medium">{value || "—"}</dd>
    </div>
  );
}
