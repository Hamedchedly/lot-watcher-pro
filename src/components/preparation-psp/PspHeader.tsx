import { CalendarRange, Download, FlaskConical, History, Plus, ScanSearch } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PSP_ANNEES } from "@/lib/psp.prep";

/**
 * En-tête du module « Préparation PSP » :
 * titre, sous-titre, sélecteur d'exercice, badge « Brouillon » et actions.
 * Les actions sont visuelles en V1 (aucune écriture).
 */
export default function PspHeader({
  exercice,
  onExerciceChange,
  onAncienneProgrammation,
  onAnalyser,
  onSimulation,
  onAjouterOperation,
  onExporter,
}: {
  exercice: number;
  onExerciceChange: (annee: number) => void;
  onAncienneProgrammation: () => void;
  onAnalyser: () => void;
  onSimulation: () => void;
  onAjouterOperation: () => void;
  onExporter: () => void;
}) {
  return (
    <header className="sticky top-11 z-30 border-b bg-white/90 shadow-sm backdrop-blur-lg">
      <div className="mx-auto max-w-[2200px] px-4 py-3 sm:px-6">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary p-2 text-primary-foreground shadow-md shadow-primary/20">
              <CalendarRange className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black uppercase tracking-tight text-foreground">
                  Préparation PSP
                </h1>
                <Badge className="border-amber-200 bg-amber-100 text-amber-800 hover:bg-amber-100">
                  Brouillon
                </Badge>
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Programmation pluriannuelle des travaux
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border bg-background px-2.5 py-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Exercice
              </span>
              <Select value={String(exercice)} onValueChange={(v) => onExerciceChange(Number(v))}>
                <SelectTrigger className="h-8 w-[90px] border-0 bg-transparent px-0 font-black shadow-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PSP_ANNEES.map((a) => (
                    <SelectItem key={a} value={String(a)}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button variant="outline" size="sm" onClick={onAncienneProgrammation}>
              <History className="size-3.5" />
              Ancienne programmation
            </Button>
            <Button variant="outline" size="sm" onClick={onAnalyser}>
              <ScanSearch className="size-3.5" />
              Analyser
            </Button>
            <Button variant="outline" size="sm" onClick={onSimulation}>
              <FlaskConical className="size-3.5" />
              Simulation
            </Button>
            <Button size="sm" onClick={onAjouterOperation}>
              <Plus className="size-3.5" />
              Ajouter une opération
            </Button>
            <Button variant="outline" size="sm" onClick={onExporter}>
              <Download className="size-3.5" />
              Exporter
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
