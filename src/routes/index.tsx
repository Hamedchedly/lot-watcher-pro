import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2, Search, Upload } from "lucide-react";

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
      { title: "Patrimoine — tranches, lots et locataires" },
      {
        name: "description",
        content:
          "Vue consolidée du patrimoine issu d'ISIS : villes, tranches, bâtiments, lots, locataires et travaux réalisés ou à anticiper.",
      },
      { property: "og:title", content: "Patrimoine — tranches, lots et locataires" },
      {
        property: "og:description",
        content:
          "Pilotez des milliers de lots classés par ville, tranche, bâtiment et lot, avec l'historique des travaux.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const PAGE = 50;

function Index() {
  const fetchPatrimoine = useServerFn(getPatrimoine);
  const { data, isLoading } = useQuery({
    queryKey: ["patrimoine"],
    queryFn: () => fetchPatrimoine(),
  });

  const [q, setQ] = useState("");
  const [ville, setVille] = useState("toutes");
  const [tranche, setTranche] = useState("toutes");
  const [type, setType] = useState("tous");
  const [page, setPage] = useState(0);

  const lots = data?.lots ?? [];
  const tranches = data?.tranches ?? [];

  const trancheLabel = useMemo(
    () => new Map(tranches.map((t) => [t.code, t.localite ?? ""])),
    [tranches],
  );

  const villes = useMemo(
    () => [...new Set(lots.map((l) => l.ville).filter(Boolean))].sort() as string[],
    [lots],
  );
  const codesTranches = useMemo(
    () =>
      [...new Set(lots.filter((l) => ville === "toutes" || l.ville === ville).map((l) => l.tranche_code))].sort(),
    [lots, ville],
  );

  const visibles = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return lots
      .filter((l) => {
        if (ville !== "toutes" && l.ville !== ville) return false;
        if (tranche !== "toutes" && l.tranche_code !== tranche) return false;
        if (type === "logements" && !isLogement(l.type_lot)) return false;
        if (type === "annexes" && isLogement(l.type_lot)) return false;
        if (!needle) return true;
        return [l.code_patrimoine, l.tranche_code, l.adresse, l.locataire_nom, l.batiment]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      })
      .sort(
        (a, b) =>
          a.tranche_code.localeCompare(b.tranche_code, "fr", { numeric: true }) ||
          (a.batiment ?? "").localeCompare(b.batiment ?? "", "fr", { numeric: true }) ||
          (a.etage ?? "").localeCompare(b.etage ?? "", "fr", { numeric: true }) ||
          a.code_patrimoine.localeCompare(b.code_patrimoine, "fr", { numeric: true }),
      );
  }, [lots, q, ville, tranche, type]);

  const totaux = useMemo(() => {
    const logements = visibles.filter((l) => isLogement(l.type_lot)).length;
    const dpe = visibles.filter((l) => l.dpe && "EFG".includes(l.dpe)).length;
    const occupes = visibles.filter((l) => l.locataire_nom).length;
    return { total: visibles.length, logements, dpe, occupes };
  }, [visibles]);

  const pageItems = visibles.slice(page * PAGE, page * PAGE + PAGE);
  const pages = Math.max(1, Math.ceil(visibles.length / PAGE));
  const reset = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPage(0);
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
              Ville · Tranche · Bâtiment · Lot · Locataire
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
          <Stat label="Lots" value={String(totaux.total)} />
          <Stat label="Logements" value={String(totaux.logements)} />
          <Stat label="Lots occupés" value={String(totaux.occupes)} />
          <Stat label="DPE E, F ou G" value={String(totaux.dpe)} />
        </section>

        <section className="rounded-xl border bg-card shadow-panel">
          <div className="grid gap-3 border-b p-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Code lot, adresse, locataire…"
                value={q}
                onChange={(e) => reset(setQ)(e.target.value)}
              />
            </div>
            <Select
              value={ville}
              onValueChange={(v) => {
                reset(setVille)(v);
                setTranche("toutes");
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
            <Select value={tranche} onValueChange={reset(setTranche)}>
              <SelectTrigger>
                <SelectValue placeholder="Tranche" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="toutes">Toutes les tranches</SelectItem>
                {codesTranches.map((t) => (
                  <SelectItem key={t} value={t}>
                    Tranche {t} — {trancheLabel.get(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={type} onValueChange={reset(setType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tous">Tous les types</SelectItem>
                <SelectItem value="logements">Logements uniquement</SelectItem>
                <SelectItem value="annexes">Annexes (parking, box…)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Chargement du patrimoine…</p>
          ) : visibles.length === 0 ? (
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
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lot</TableHead>
                      <TableHead>Tranche</TableHead>
                      <TableHead>Bât. / Étage</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Adresse</TableHead>
                      <TableHead>Locataire</TableHead>
                      <TableHead className="text-right">DPE</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageItems.map((l) => (
                      <TableRow key={l.code_patrimoine}>
                        <TableCell className="font-mono text-sm font-medium">
                          {l.code_patrimoine}
                        </TableCell>
                        <TableCell className="tabnum">
                          {l.tranche_code}
                          <span className="block text-xs text-muted-foreground">
                            {trancheLabel.get(l.tranche_code)}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm">
                          {l.batiment || "—"} / {l.etage || "—"}
                        </TableCell>
                        <TableCell className="text-sm">{typeLotLabel(l.type_lot)}</TableCell>
                        <TableCell className="max-w-56 truncate text-sm">
                          {l.adresse} · {l.ville}
                        </TableCell>
                        <TableCell className="max-w-48 truncate text-sm">
                          {l.locataire_nom || (
                            <span className="text-muted-foreground">Vacant</span>
                          )}
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
                {pageItems.map((l) => (
                  <li key={l.code_patrimoine} className="space-y-1 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-sm font-medium">{l.code_patrimoine}</span>
                      <Badge variant="secondary">{typeLotLabel(l.type_lot)}</Badge>
                    </div>
                    <p className="text-sm">{l.adresse} · {l.ville}</p>
                    <p className="text-xs text-muted-foreground">
                      Tranche {l.tranche_code} · Bât. {l.batiment || "—"} ·{" "}
                      {l.locataire_nom || "Vacant"}
                    </p>
                  </li>
                ))}
              </ul>

              <div className="flex items-center justify-between gap-2 border-t p-3 text-sm">
                <span className="text-muted-foreground">
                  {visibles.length} lots · page {page + 1}/{pages}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Précédent
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= pages - 1}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Suivant
                  </Button>
                </div>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
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
