import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2, ChevronRight, DoorOpen, Home, MapPin, Search, Upload } from "lucide-react";

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

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Patrimoine — adresses, entrées, bâtiments et lots" },
      {
        name: "description",
        content:
          "Navigation par adresse puis entrée, bâtiment et lot : visibilité sur les locataires, les DPE et les travaux du patrimoine.",
      },
      { property: "og:title", content: "Patrimoine — adresses, entrées, bâtiments et lots" },
      {
        property: "og:description",
        content:
          "Explorez des milliers de lots en partant de la rue : entrées, bâtiments puis lots, sans encombrer la page d'accueil.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

type LotItem = {
  code_patrimoine: string;
  tranche_code: string;
  type_lot: string | null;
  batiment: string | null;
  etage: string | null;
  porte: string | null;
  surface_utile: number | null;
  dpe: string | null;
  ville: string | null;
  code_postal: string | null;
  adresse: string | null;
  locataire_nom: string | null;
};

const collator = new Intl.Collator("fr", { numeric: true, sensitivity: "base" });

/** « 25-27  RUE DE RUZE » → « RUE DE RUZE » : on retire le numéro pour regrouper la rue. */
function rueDe(adresse: string | null) {
  const a = (adresse ?? "").replace(/\s+/g, " ").trim();
  if (!a) return "Adresse inconnue";
  const m = a.match(/^[\d.\-/]+\s*(BIS|TER|QUATER)?\s+(.*)$/i);
  return (m?.[2] ?? a).trim();
}

function entreeDe(adresse: string | null) {
  const a = (adresse ?? "").replace(/\s+/g, " ").trim();
  return a || "Entrée inconnue";
}

function Index() {
  const fetchPatrimoine = useServerFn(getPatrimoine);
  const { data, isLoading } = useQuery({
    queryKey: ["patrimoine"],
    queryFn: () => fetchPatrimoine(),
  });

  const [q, setQ] = useState("");
  const [ville, setVille] = useState("toutes");
  const [rue, setRue] = useState<string | null>(null);
  const [entree, setEntree] = useState<string | null>(null);
  const [batiment, setBatiment] = useState<string | null>(null);

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

  const niveau: "rues" | "entrees" | "batiments" | "lots" = !rue
    ? "rues"
    : !entree
      ? "entrees"
      : !batiment
        ? "batiments"
        : "lots";

  const rues = useMemo(() => {
    const map = new Map<string, { rue: string; ville: string; lots: LotItem[] }>();
    for (const l of filtres) {
      const key = `${rueDe(l.adresse)}|${l.ville ?? ""}`;
      const g = map.get(key) ?? { rue: rueDe(l.adresse), ville: l.ville ?? "", lots: [] };
      g.lots.push(l);
      map.set(key, g);
    }
    return [...map.values()].sort(
      (a, b) => collator.compare(a.ville, b.ville) || collator.compare(a.rue, b.rue),
    );
  }, [filtres]);

  const dansRue = useMemo(
    () => (rue ? filtres.filter((l) => `${rueDe(l.adresse)}|${l.ville ?? ""}` === rue) : []),
    [filtres, rue],
  );

  const entrees = useMemo(() => {
    const map = new Map<string, LotItem[]>();
    for (const l of dansRue) {
      const key = entreeDe(l.adresse);
      map.set(key, [...(map.get(key) ?? []), l]);
    }
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
      (batiment ? dansEntree.filter((l) => (l.batiment || "—") === batiment) : []).sort(
        (a, b) =>
          collator.compare(a.etage ?? "", b.etage ?? "") ||
          collator.compare(a.code_patrimoine, b.code_patrimoine),
      ),
    [dansEntree, batiment],
  );

  const totaux = useMemo(
    () => ({
      total: filtres.length,
      logements: filtres.filter((l) => isLogement(l.type_lot)).length,
      occupes: filtres.filter((l) => l.locataire_nom).length,
      adresses: rues.length,
    }),
    [filtres, rues],
  );

  const resetNiveaux = () => {
    setRue(null);
    setEntree(null);
    setBatiment(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-4 sm:px-6">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Building2 className="size-5" />
          </div>
          <div className="mr-auto">
            <h1 className="text-lg font-semibold leading-tight">Patrimoine</h1>
            <p className="text-sm text-muted-foreground">
              Adresse · Entrée · Bâtiment · Lot
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/import">
              <Upload className="size-4" /> Import ISIS
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Adresses" value={String(totaux.adresses)} />
          <Stat label="Lots" value={String(totaux.total)} />
          <Stat label="Logements" value={String(totaux.logements)} />
          <Stat label="Lots occupés" value={String(totaux.occupes)} />
        </section>

        <section className="rounded-xl border bg-card shadow-panel">
          <div className="grid gap-3 border-b p-3 sm:grid-cols-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Rue, ville, code lot, locataire…"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  resetNiveaux();
                }}
              />
            </div>
            <Select
              value={ville}
              onValueChange={(v) => {
                setVille(v);
                resetNiveaux();
              }}
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
              <button className="text-primary hover:underline" onClick={resetNiveaux}>
                Toutes les adresses
              </button>
              <ChevronRight className="size-4 text-muted-foreground" />
              <button
                className={entree ? "text-primary hover:underline" : "font-medium"}
                onClick={() => {
                  setEntree(null);
                  setBatiment(null);
                }}
              >
                {rue.split("|")[0]} — {rue.split("|")[1]}
              </button>
              {entree && (
                <>
                  <ChevronRight className="size-4 text-muted-foreground" />
                  <button
                    className={batiment ? "text-primary hover:underline" : "font-medium"}
                    onClick={() => setBatiment(null)}
                  >
                    {entree}
                  </button>
                </>
              )}
              {batiment && (
                <>
                  <ChevronRight className="size-4 text-muted-foreground" />
                  <span className="font-medium">Bâtiment {batiment}</span>
                </>
              )}
            </nav>
          )}

          {isLoading ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Chargement du patrimoine…
            </p>
          ) : filtres.length === 0 ? (
            <div className="space-y-3 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Aucun lot. Importez votre export ISIS pour alimenter la base.
              </p>
              <Button asChild>
                <Link to="/import">
                  <Upload className="size-4" /> Importer l'export ISIS
                </Link>
              </Button>
            </div>
          ) : niveau === "rues" ? (
            <ul className="divide-y">
              {rues.map((r) => (
                <RowButton
                  key={`${r.rue}|${r.ville}`}
                  icon={<MapPin className="size-4" />}
                  title={r.rue}
                  subtitle={r.ville}
                  count={`${r.lots.length} lots`}
                  onClick={() => setRue(`${r.rue}|${r.ville}`)}
                />
              ))}
            </ul>
          ) : niveau === "entrees" ? (
            <ul className="divide-y">
              {entrees.map(([e, items]) => (
                <RowButton
                  key={e}
                  icon={<DoorOpen className="size-4" />}
                  title={e}
                  subtitle={`Tranche ${[...new Set(items.map((i) => i.tranche_code))].join(", ")}`}
                  count={`${items.length} lots`}
                  onClick={() => setEntree(e)}
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
                  onClick={() => setBatiment(b)}
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
                      Étage {l.etage || "—"} · Porte {l.porte || "—"} ·{" "}
                      {l.locataire_nom || "Vacant"}
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-panel">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="tabnum mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
