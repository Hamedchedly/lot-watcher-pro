import type { ReactNode } from "react";
import { BarChart3, Coins, PiggyBank, Scale } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { money0 } from "@/lib/formats";
import {
  PSP_ANNEES,
  PSP_BUDGET_DISPONIBLE_PAR_ANNEE,
  kpiGlobal,
  type PspOperation,
} from "@/lib/psp.prep";
import { cn } from "@/lib/utils";

/**
 * KPI du module : Budget disponible, Budget programmé, Écart disponible,
 * Nombre d'opérations — puis la répartition par année (2027 → 2031).
 * Tous les montants sont calculés à partir des opérations (jamais saisis).
 */
export default function PspKpi({
  operations,
  exercice,
}: {
  operations: PspOperation[];
  exercice: number;
}) {
  const kpi = kpiGlobal(operations);

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CarteKpi
          icone={<Coins className="size-4" />}
          label="Budget disponible"
          valeur={money0(kpi.disponible)}
          note={`${PSP_ANNEES.length} exercices`}
          accent="text-primary"
        />
        <CarteKpi
          icone={<BarChart3 className="size-4" />}
          label="Budget programmé"
          valeur={money0(kpi.programme)}
          note={`${kpi.nbOperations} opérations`}
          accent="text-slate-800"
        />
        <CarteKpi
          icone={<PiggyBank className="size-4" />}
          label="Écart disponible"
          valeur={money0(kpi.ecart)}
          note={kpi.ecart >= 0 ? "Marge de programmation" : "Enveloppe dépassée"}
          accent={kpi.ecart >= 0 ? "text-emerald-600" : "text-destructive"}
        />
        <CarteKpi
          icone={<Scale className="size-4" />}
          label="Nombre d'opérations"
          valeur={String(kpi.nbOperations)}
          note="dont reportées de 2026"
          accent="text-primary"
        />
      </div>

      <Card className="shadow-panel">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <BarChart3 className="size-4 text-muted-foreground" />
            Répartition par année
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {PSP_ANNEES.map((annee) => {
              const programme = kpi.parAnnee[String(annee)] ?? 0;
              const disponible = PSP_BUDGET_DISPONIBLE_PAR_ANNEE[String(annee)] ?? 0;
              const ecart = disponible - programme;
              const taux = disponible > 0 ? Math.min(100, (programme / disponible) * 100) : 0;
              const actif = annee === exercice;
              return (
                <div
                  key={annee}
                  className={cn(
                    "rounded-lg border bg-surface/60 p-3 transition-colors",
                    actif && "border-primary/40 bg-primary/5 ring-1 ring-primary/20",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "font-mono text-sm font-black tabular-nums",
                        actif ? "text-primary" : "text-foreground",
                      )}
                    >
                      {annee}
                    </span>
                    {actif ? (
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-primary">
                        Exercice
                      </span>
                    ) : null}
                  </div>
                  <p className="tabnum mt-2 text-sm font-bold">{money0(programme)}</p>
                  <p className="text-xs text-muted-foreground">programmé</p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full rounded-full bg-primary/70 transition-all"
                      style={{ width: `${taux}%` }}
                    />
                  </div>
                  <p
                    className={cn(
                      "tabnum mt-2 text-xs font-semibold",
                      ecart >= 0 ? "text-emerald-600" : "text-destructive",
                    )}
                  >
                    {money0(ecart)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    écart sur {money0(disponible)}
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function CarteKpi({
  icone,
  label,
  valeur,
  note,
  accent,
}: {
  icone: ReactNode;
  label: string;
  valeur: string;
  note: string;
  accent: string;
}) {
  return (
    <Card className="shadow-panel">
      <CardContent className="flex items-start justify-between gap-2 p-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            {label}
          </p>
          <p className={cn("tabnum mt-1 text-xl font-black", accent)}>{valeur}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{note}</p>
        </div>
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface text-muted-foreground">
          {icone}
        </div>
      </CardContent>
    </Card>
  );
}
