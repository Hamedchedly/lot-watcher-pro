import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpDown, Building2, Plus, Search } from "lucide-react";

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
import { LotDialog } from "@/components/LotDialog";
import { StatutBadge } from "@/components/StatutBadge";
import {
  compareLots,
  formatDate,
  formatEuro,
  loadLots,
  saveLots,
  statsLot,
  type Lot,
} from "@/lib/lots";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Suivi des lots immobiliers — travaux réalisés et à venir" },
      {
        name: "description",
        content:
          "Pilotez des milliers de lots classés par tranche, copropriété, bâtiment et entrée : historique des travaux réalisés et anticipation des travaux à venir.",
      },
      { property: "og:title", content: "Suivi des lots immobiliers — travaux réalisés et à venir" },
      {
        property: "og:description",
        content:
          "Liste triable de lots par tranche, copro, bâtiment et entrée, avec suivi des travaux réalisés et planifiés.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Filtre = "tous" | "realise" | "planifie" | "a_prevoir" | "aucun";

function Index() {
  const [lots, setLots] = useState<Lot[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [q, setQ] = useState("");
  const [tranche, setTranche] = useState("toutes");
  const [copro, setCopro] = useState("toutes");
  const [filtre, setFiltre] = useState<Filtre>("tous");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<Lot | null>(null);

  useEffect(() => {
    setLots(loadLots());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveLots(lots);
  }, [lots, hydrated]);

  const tranches = useMemo(
    () => [...new Set(lots.map((l) => l.tranche))].sort(),
    [lots],
  );
  const copros = useMemo(() => [...new Set(lots.map((l) => l.copro))].sort(), [lots]);

  const visibles = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return lots
      .filter((l) => {
        if (tranche !== "toutes" && l.tranche !== tranche) return false;
        if (copro !== "toutes" && l.copro !== copro) return false;
        if (filtre === "aucun" && l.travaux.length > 0) return false;
        if (filtre !== "tous" && filtre !== "aucun" && !l.travaux.some((t) => t.statut === filtre))
          return false;
        if (!needle) return true;
        return [l.numeroLot, l.designation, l.batiment, l.entree, l.copro, l.tranche]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      })
      .sort(compareLots);
  }, [lots, q, tranche, copro, filtre]);

  const totaux = useMemo(() => {
    const s = visibles.map(statsLot);
    return {
      lots: visibles.length,
      realises: s.reduce((a, x) => a + x.realises, 0),
      aVenir: s.reduce((a, x) => a + x.planifies + x.aPrevoir, 0),
      budget: s.reduce((a, x) => a + x.coutAVenir, 0),
    };
  }, [visibles]);

  const upsert = (lot: Lot) =>
    setLots((prev) =>
      prev.some((l) => l.id === lot.id) ? prev.map((l) => (l.id === lot.id ? lot : l)) : [...prev, lot],
    );

  const openLot = (lot: Lot | null) => {
    setSelected(lot);
    setDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-4 sm:px-6">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Building2 className="size-5" />
          </div>
          <div className="mr-auto">
            <h1 className="text-lg font-semibold leading-tight">Suivi des lots</h1>
            <p className="text-sm text-muted-foreground">
              Tranche · Copropriété · Bâtiment · Entrée · Lot
            </p>
          </div>
          <Button onClick={() => openLot(null)}>
            <Plus className="size-4" /> Nouveau lot
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Lots affichés" value={String(totaux.lots)} />
          <Stat label="Travaux réalisés" value={String(totaux.realises)} />
          <Stat label="Travaux à venir" value={String(totaux.aVenir)} />
          <Stat label="Budget à engager" value={formatEuro(totaux.budget)} />
        </section>

        <section className="rounded-xl border bg-card shadow-panel">
          <div className="grid gap-3 border-b p-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Rechercher un lot…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <Select value={tranche} onValueChange={setTranche}>
              <SelectTrigger>
                <SelectValue placeholder="Tranche" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="toutes">Toutes les tranches</SelectItem>
                {tranches.map((t) => (
                  <SelectItem key={t} value={t}>
                    Tranche {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={copro} onValueChange={setCopro}>
              <SelectTrigger>
                <SelectValue placeholder="Copropriété" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="toutes">Toutes les copros</SelectItem>
                {copros.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtre} onValueChange={(v) => setFiltre(v as Filtre)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tous">Tous les travaux</SelectItem>
                <SelectItem value="realise">Avec travaux réalisés</SelectItem>
                <SelectItem value="planifie">Avec travaux planifiés</SelectItem>
                <SelectItem value="a_prevoir">Avec travaux à prévoir</SelectItem>
                <SelectItem value="aucun">Sans aucun travail</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 border-b px-3 py-2 text-xs text-muted-foreground">
            <ArrowUpDown className="size-3.5" />
            Tri fixe : tranche, puis copropriété, bâtiment, entrée et numéro de lot.
          </div>

          {/* Tableau — écrans larges */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lot</TableHead>
                  <TableHead>Tranche</TableHead>
                  <TableHead>Copro</TableHead>
                  <TableHead>Bât. / Entrée</TableHead>
                  <TableHead className="text-right">Réalisés</TableHead>
                  <TableHead>Prochain travail</TableHead>
                  <TableHead className="text-right">Budget à venir</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibles.map((lot) => {
                  const s = statsLot(lot);
                  return (
                    <TableRow
                      key={lot.id}
                      className="cursor-pointer"
                      onClick={() => openLot(lot)}
                    >
                      <TableCell>
                        <span className="font-mono font-medium">{lot.numeroLot}</span>
                        <span className="block text-xs text-muted-foreground">
                          {lot.designation || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="tabnum">{lot.tranche}</TableCell>
                      <TableCell className="font-mono text-sm">{lot.copro}</TableCell>
                      <TableCell className="text-sm">
                        {lot.batiment || "—"} / {lot.entree || "—"}
                      </TableCell>
                      <TableCell className="tabnum text-right">{s.realises}</TableCell>
                      <TableCell>
                        {s.prochaine ? (
                          <div className="flex flex-col gap-1">
                            <span className="text-sm">{s.prochaine.libelle || "Sans intitulé"}</span>
                            <span className="flex items-center gap-2">
                              <StatutBadge statut={s.prochaine.statut} />
                              <span className="text-xs text-muted-foreground">
                                {formatDate(s.prochaine.date)}
                              </span>
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Rien de prévu</span>
                        )}
                      </TableCell>
                      <TableCell className="tabnum text-right">{formatEuro(s.coutAVenir)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Cartes — mobile */}
          <ul className="divide-y md:hidden">
            {visibles.map((lot) => {
              const s = statsLot(lot);
              return (
                <li key={lot.id}>
                  <button
                    type="button"
                    onClick={() => openLot(lot)}
                    className="w-full space-y-2 p-4 text-left transition-colors hover:bg-muted/60"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-mono font-semibold">{lot.numeroLot}</span>
                      <span className="text-xs text-muted-foreground">
                        {lot.tranche} · {lot.copro} · {lot.batiment}/{lot.entree}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{lot.designation || "—"}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      {s.prochaine ? (
                        <>
                          <StatutBadge statut={s.prochaine.statut} />
                          <span className="text-xs text-muted-foreground">
                            {s.prochaine.libelle} · {formatDate(s.prochaine.date)}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">Rien de prévu</span>
                      )}
                    </div>
                    <div className="tabnum text-xs text-muted-foreground">
                      {s.realises} réalisé(s) · {formatEuro(s.coutAVenir)} à engager
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          {hydrated && visibles.length === 0 && (
            <p className="p-10 text-center text-sm text-muted-foreground">
              Aucun lot ne correspond à ces critères.
            </p>
          )}
        </section>
      </main>

      <LotDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        lot={selected}
        onSave={upsert}
        onDelete={(id) => setLots((prev) => prev.filter((l) => l.id !== id))}
      />
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
