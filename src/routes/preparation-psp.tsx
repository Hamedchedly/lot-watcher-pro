import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, FlaskConical } from "lucide-react";
import { toast } from "sonner";

import PspAncienneProgrammation from "@/components/preparation-psp/PspAncienneProgrammation";
import PspGroupingSelector, {
  type ModeAffichage,
} from "@/components/preparation-psp/PspGroupingSelector";
import PspHeader from "@/components/preparation-psp/PspHeader";
import PspKpi from "@/components/preparation-psp/PspKpi";
import PspOperationDetail from "@/components/preparation-psp/PspOperationDetail";
import PspTable from "@/components/preparation-psp/PspTable";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { money0 } from "@/lib/formats";
import {
  FILTRES_VIDES,
  PSP_ANNEES,
  PSP_BUDGET_DISPONIBLE_PAR_ANNEE,
  PSP_OPERATIONS,
  construireCsvProgrammation,
  kpiGlobal,
  type FiltresDetail,
  type PspOperation,
} from "@/lib/psp.prep";

export const Route = createFileRoute("/preparation-psp")({
  head: () => ({
    meta: [
      { title: "Préparation PSP — Programmation pluriannuelle des travaux" },
      {
        name: "description",
        content:
          "Prototype V1 de préparation de la programmation pluriannuelle des travaux (2027-2031). Données mock, aucune écriture en base.",
      },
    ],
  }),
  component: PreparationPspPage,
});

function PreparationPspPage() {
  const [exercice, setExercice] = useState(2027);
  const [mode, setMode] = useState<ModeAffichage>("tranche");
  const [filters, setFilters] = useState<FiltresDetail>(FILTRES_VIDES);
  const [selectedOp, setSelectedOp] = useState<PspOperation | null>(null);
  const [ancienneOuverte, setAncienneOuverte] = useState(false);
  const [simulationOuverte, setSimulationOuverte] = useState(false);

  const kpi = useMemo(() => kpiGlobal(PSP_OPERATIONS), []);

  const exporter = () => {
    const csv = construireCsvProgrammation(PSP_OPERATIONS);
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "programmation-psp-2027-2031.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export CSV généré (données mock V1).");
  };

  const analyser = () =>
    toast.info("Analyse — simulation V1. La future analyse s'appuiera sur les données Supabase.");

  const ajouterOperation = () =>
    toast.info("Ajouter une opération — simulation V1, aucune écriture en base.");

  return (
    <div className="min-h-screen bg-background pb-12 text-foreground">
      <PspHeader
        exercice={exercice}
        onExerciceChange={setExercice}
        onAncienneProgrammation={() => setAncienneOuverte(true)}
        onAnalyser={analyser}
        onSimulation={() => setSimulationOuverte(true)}
        onAjouterOperation={ajouterOperation}
        onExporter={exporter}
      />

      <main className="mx-auto max-w-[2200px] space-y-4 px-4 pt-4 sm:px-6">
        <PspKpi operations={PSP_OPERATIONS} exercice={exercice} />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <PspGroupingSelector mode={mode} onChange={setMode} />
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Prototype V1 — données mock · {PSP_OPERATIONS.length} opérations
          </p>
        </div>

        <PspTable
          mode={mode}
          operations={PSP_OPERATIONS}
          filters={filters}
          onFiltersChange={setFilters}
          onOpenOperation={setSelectedOp}
        />
      </main>

      <PspOperationDetail operation={selectedOp} onClose={() => setSelectedOp(null)} />
      <PspAncienneProgrammation open={ancienneOuverte} onClose={() => setAncienneOuverte(false)} />

      <SimulationDialog
        open={simulationOuverte}
        onClose={() => setSimulationOuverte(false)}
        kpi={kpi}
      />
    </div>
  );
}

function SimulationDialog({
  open,
  onClose,
  kpi,
}: {
  open: boolean;
  onClose: () => void;
  kpi: { disponible: number; programme: number; ecart: number; parAnnee: Record<string, number> };
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[min(92vw,560px)] sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="size-4 text-muted-foreground" />
            Simulation de programmation
          </DialogTitle>
          <DialogDescription>
            Répartition théorique du programme 2027-2031 sur les enveloppes disponibles (mock V1).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          {PSP_ANNEES.map((annee) => {
            const programme = kpi.parAnnee[String(annee)] ?? 0;
            const disponible = PSP_BUDGET_DISPONIBLE_PAR_ANNEE[String(annee)] ?? 0;
            const taux = disponible > 0 ? (programme / disponible) * 100 : 0;
            return (
              <div key={annee} className="rounded-lg border bg-surface/60 p-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono font-black">{annee}</span>
                  <span className="tabnum font-semibold">
                    {money0(programme)} / {money0(disponible)}
                  </span>
                  <span className="tabnum font-black text-primary">{taux.toFixed(0)} %</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-primary/70"
                    style={{ width: `${Math.min(100, taux)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-info/30 bg-info/5 p-2.5 text-xs text-info-foreground">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Simulation purement indicative en V1. Le moteur d'analyse et le rééquilibrage entre
            exercices seront connectés à Supabase dans une phase ultérieure.
          </span>
        </div>

        <div className="flex items-center justify-between border-t pt-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Programme total : {money0(kpi.programme)}
          </p>
          <Button variant="outline" size="sm" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
