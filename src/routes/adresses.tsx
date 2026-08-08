import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2, ChevronRight, DoorOpen, MapPin, Search, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getPatrimoine } from "@/lib/isis.functions";
import { isLogement, typeLotLabel } from "@/lib/isis";
import { collator, entreeDe, pushRecent, rueDe, type LotItem } from "@/lib/adresses";

type AdressesSearch = {
  q: string;
  ville: string;
  rue: string | undefined;
  entree: string | undefined;
  bat: string | undefined;
};

export const Route = createFileRoute("/adresses")({
  validateSearch: (search: Record<string, unknown>): AdressesSearch => ({
    q: typeof search["q"] === "string" ? search["q"] : "",
    ville: typeof search["ville"] === "string" ? search["ville"] : "toutes",
    rue: typeof search["rue"] === "string" ? search["rue"] : undefined,
    entree: typeof search["entree"] === "string" ? search["entree"] : undefined,
    bat: typeof search["bat"] === "string" ? search["bat"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Toutes les adresses du patrimoine par ville" },
      {
        name: "description",
        content:
          "Liste complète des adresses classées par ville : ouvrez une rue pour voir ses entrées, ses bâtiments puis ses lots.",
      },
      { property: "og:title", content: "Toutes les adresses du patrimoine par ville" },
      {
        property: "og:description",
        content: "Navigation ville → rue → entrée → bâtiment → lot sur l'ensemble du patrimoine.",
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
  const { q, ville, rue, entree, bat } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const setSearch = (patch: Partial<AdressesSearch>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }) });

  const fetchPatrimoine = useServerFn(getPatrimoine);
  const { data, isLoading } = useQuery({
    queryKey: ["patrimoine"],
    queryFn: () => fetchPatrimoine(),
  });

  const lots = (data?.lots ?? []) as LotItem[];

  const villes = useMemo(
    () => [...new Set(lots.map((l) => l.ville).filter(Boolean))].sort() as string[],
    [lots],
  );

  const filtres = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return lots.filter((l) => {
      if (ville !== "toutes" && l.ville !== ville) return false;
      if (!needle) return true;
      return [l.code_patrimoine, l.adresse, l.ville, l.locataire_nom, l.tranche_code]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [lots, q, ville]);

  const parVille = useMemo(() => {
    const map = new Map<string, Map<string, LotItem[]>>();
    for (const l of filtres) {
      const v = l.ville ?? "Ville inconnue";
      const r = rueDe(l.adresse);
      const rues = map.get(v) ?? new Map<string, LotItem[]>();
      rues.set(r, [...(rues.get(r) ?? []), l]);
      map.set(v, rues);
    }
    return [...map.entries()]
      .sort((a, b) => collator.compare(a[0], b[0]))
      .map(([v, rues]) => ({
        ville: v,
        rues: [...rues.entries()].sort((a, b) => collator.compare(a[0], b[0])),
      }));
  }, [filtres]);

  const dansRue = useMemo(
    () =>
      rue
        ? filtres.filter((l) => rueDe(l.adresse) === rue && (l.ville ?? "Ville inconnue") === ville)
        : [],
    [filtres, rue, ville],
  );

  const entrees = useMemo(() => {
    const map = new Map<string, LotItem[]>();
    for (const l of dansRue) map.set(entreeDe(l.adresse), [...(map.get(entreeDe(l.adresse)) ?? []), l]);
    return [...map.entries()].sort((a, b) => collator.compare(a[0], b[0]));
  }, [dansRue]);

  const dansEntree = useMemo(
    () => (entree ? dansRue.filter((l) => entreeDe(l.adresse) === entree) : []),
    [dansRue, entree],
  );

  const batiments = useMemo(() => {
    const map = new Map<string, LotItem[]>();
    for (const l of dansEntree) {
      const key = l.batiment || "—";
      map.set(key, [...(map.get(key) ?? []), l]);
    }
    return [...map.entries()].sort((a, b) => collator.compare(a[0], b[0]));
  }, [dansEntree]);

  const lotsAffiches = useMemo(
    () =>
      (bat ? dansEntree.filter((l) => (l.batiment || "—") === bat) : []).sort(
        (a, b) =>
          collator.compare(a.etage ?? "", b.etage ?? "") ||
          collator.compare(a.code_patrimoine, b.code_patrimoine),
      ),
    [dansEntree, bat],
  );

  const niveau = !rue ? "villes" : !entree ? "entrees" : !bat ? "batiments" : "lots";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-4 sm:px-6">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <MapPin className="size-5" />
          </div>
          <div className="mr-auto">
            <h1 className="text-lg font-semibold leading-tight">Toutes les adresses</h1>
            <p className="text-sm text-muted-foreground">Classées par ville</p>
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
          <div className="grid gap-3 border-b p-3 sm:grid-cols-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Rue, ville, code lot, locataire…"
                value={q}
                onChange={(e) =>
                  setSearch({ q: e.target.value, rue: undefined, entree: undefined, bat: undefined })
                }
              />
            </div>
            <Select
              value={ville}
              onValueChange={(v) =>
                setSearch({ ville: v, rue: undefined, entree: undefined, bat: undefined })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Ville" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="toutes">Toutes les villes</SelectItem>
                {villes.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {rue && (
            <nav className="flex flex-wrap items-center gap-1 border-b p-3 text-sm">
              <button
                className="text-primary hover:underline"
                onClick={() => setSearch({ rue: undefined, entree: undefined, bat: undefined })}
              >
                Toutes les adresses
              </button>
              <ChevronRight className="size-4 text-muted-foreground" />
              <button
                className={entree ? "text-primary hover:underline" : "font-medium"}
                onClick={() => setSearch({ entree: undefined, bat: undefined })}
              >
                {rue} — {ville}
              </button>
              {entree && (
                <>
                  <ChevronRight className="size-4 text-muted-foreground" />
                  <button
                    className={bat ? "text-primary hover:underline" : "font-medium"}
                    onClick={() => setSearch({ bat: undefined })}
                  >
                    {entree}
                  </button>
                </>
              )}
              {bat && (
                <>
                  <ChevronRight className="size-4 text-muted-foreground" />
                  <span className="font-medium">Bâtiment {bat}</span>
                </>
              )}
            </nav>
          )}

          {isLoading ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Chargement du patrimoine…</p>
          ) : filtres.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Aucune adresse trouvée.</p>
          ) : niveau === "villes" ? (
            <div className="divide-y">
              {parVille.map((groupe) => (
                <section key={groupe.ville}>
                  <h2 className="sticky top-0 z-10 bg-muted/70 px-3 py-2 text-xs font-semibold uppercase tracking-wide backdrop-blur">
                    {groupe.ville} · {groupe.rues.length} adresses
                  </h2>
                  <ul className="divide-y">
                    {groupe.rues.map(([r, items]) => (
                      <RowButton
                        key={`${groupe.ville}-${r}`}
                        icon={<MapPin className="size-4" />}
                        title={r}
                        subtitle={groupe.ville}
                        count={`${items.length} lots`}
                        onClick={() => {
                          pushRecent({ rue: r, ville: groupe.ville, lots: items.length });
                          setSearch({ ville: groupe.ville, rue: r, entree: undefined, bat: undefined });
                        }}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : niveau === "entrees" ? (
            <ul className="divide-y">
              {entrees.map(([e, items]) => (
                <RowButton
                  key={e}
                  icon={<DoorOpen className="size-4" />}
                  title={e}
                  subtitle={`Tranche ${[...new Set(items.map((i) => i.tranche_code))].join(", ")}`}
                  count={`${items.length} lots`}
                  onClick={() => setSearch({ entree: e, bat: undefined })}
                />
              ))}
            </ul>
          ) : niveau === "batiments" ? (
            <ul className="divide-y">
              {batiments.map(([b, items]) => (
                <RowButton
                  key={b}
                  icon={<Building2 className="size-4" />}
                  title={`Bâtiment ${b}`}
                  subtitle={`${items.filter((i) => isLogement(i.type_lot)).length} logements`}
                  count={`${items.length} lots`}
                  onClick={() => setSearch({ bat: b })}
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
                          {l.code_patrimoine}
                        </TableCell>
                        <TableCell className="text-sm">
                          {l.etage || "—"} / {l.porte || "—"}
                        </TableCell>
                        <TableCell className="text-sm">{typeLotLabel(l.type_lot)}</TableCell>
                        <TableCell className="tabnum text-sm">
                          {l.surface_utile ? `${l.surface_utile} m²` : "—"}
                        </TableCell>
                        <TableCell className="max-w-48 truncate text-sm">
                          {l.locataire_nom || <span className="text-muted-foreground">Vacant</span>}
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
                      <span className="font-mono text-sm font-medium">{l.code_patrimoine}</span>
                      <Badge variant="secondary">{typeLotLabel(l.type_lot)}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Étage {l.etage || "—"} · Porte {l.porte || "—"} · {l.locataire_nom || "Vacant"}
                    </p>
                  </li>
                ))}
              </ul>

              <p className="border-t p-3 text-sm text-muted-foreground">
                {lotsAffiches.length} lots dans ce bâtiment
              </p>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

function RowButton({
  icon,
  title,
  subtitle,
  count,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  count: string;
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
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>
    </li>
  );
}
