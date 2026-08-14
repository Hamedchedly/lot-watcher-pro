import type { ReactNode } from "react";
import { Building2, TrendingDown, TrendingUp } from "lucide-react";

import { money0 } from "@/lib/formats";
import { PSP_ANNEES, statsDevis, totalOperation, type PspOperation } from "@/lib/psp.prep";
import { cn } from "@/lib/utils";

/**
 * Bloc « Devis » de la fiche opération :
 * liste des devis (mock), min / moyenne / max, puis Budget programmé,
 * Estimation devis et Écart. Tous les montants sont calculés, jamais saisis.
 */
export default function PspDevisPanel({ operation }: { operation: PspOperation }) {
  const stats = statsDevis(operation.devis);
  const budget = totalOperation(operation);
  const estimation = stats?.moyenne ?? null;
  const ecart = estimation !== null ? budget - estimation : null;

  return (
    <div className="rounded-lg border bg-surface/60 p-3">
      <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-muted-foreground">
        <Building2 className="size-3.5" />
        Devis
      </p>

      {operation.devis.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Aucun devis renseigné pour cette opération (V1 — à connecter).
        </p>
      ) : (
        <>
          <ul className="mt-2 space-y-1">
            {[...operation.devis]
              .sort((a, b) => a.montant - b.montant)
              .map((d, i) => (
                <li
                  key={`${d.entreprise}-${i}`}
                  className="flex items-center justify-between rounded-md border bg-card px-2.5 py-1.5"
                >
                  <span className="flex items-center gap-2 text-xs font-medium">
                    <span
                      className={cn(
                        "flex size-5 items-center justify-center rounded font-mono text-[9px] font-black",
                        i === 0
                          ? "bg-emerald-100 text-emerald-700"
                          : i === operation.devis.length - 1
                            ? "bg-orange-100 text-orange-700"
                            : "bg-muted text-muted-foreground",
                      )}
                    >
                      {i + 1}
                    </span>
                    {d.entreprise}
                    {d.remarque ? (
                      <span className="text-[10px] font-normal text-muted-foreground">
                        — {d.remarque}
                      </span>
                    ) : null}
                  </span>
                  <span className="tabnum text-xs font-bold">{money0(d.montant)}</span>
                </li>
              ))}
          </ul>

          <div className="mt-2 grid grid-cols-3 gap-2">
            <MiniStat
              icone={<TrendingDown className="size-3" />}
              label="Minimum"
              valeur={money0(stats?.min)}
              className="text-emerald-600"
            />
            <MiniStat label="Moyenne" valeur={money0(stats?.moyenne)} className="text-foreground" />
            <MiniStat
              icone={<TrendingUp className="size-3" />}
              label="Maximum"
              valeur={money0(stats?.max)}
              className="text-orange-600"
            />
          </div>

          <div className="mt-2 space-y-1 border-t border-dashed pt-2">
            <LigneComparaison label="Budget programmé" valeur={money0(budget)} />
            <LigneComparaison
              label="Estimation devis"
              valeur={estimation !== null ? money0(estimation) : "—"}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground">Écart</span>
              <span
                className={cn(
                  "tabnum text-xs font-black",
                  ecart === null
                    ? "text-muted-foreground"
                    : ecart >= 0
                      ? "text-emerald-600"
                      : "text-destructive",
                )}
              >
                {ecart !== null ? `${ecart >= 0 ? "+" : ""}${money0(ecart)}` : "—"}
              </span>
            </div>
          </div>
        </>
      )}

      <p className="mt-2 text-[10px] text-muted-foreground">
        Programmation couverte : {PSP_ANNEES[0] ?? 2027} →{" "}
        {PSP_ANNEES[PSP_ANNEES.length - 1] ?? 2031} — devis mock V1.
      </p>
    </div>
  );
}

function MiniStat({
  icone,
  label,
  valeur,
  className,
}: {
  icone?: ReactNode;
  label: string;
  valeur: string;
  className?: string;
}) {
  return (
    <div className="rounded-md border bg-card px-2 py-1.5">
      <p className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
        {icone}
        {label}
      </p>
      <p className={cn("tabnum mt-0.5 text-xs font-black", className)}>{valeur}</p>
    </div>
  );
}

function LigneComparaison({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="tabnum text-xs font-bold">{valeur}</span>
    </div>
  );
}
