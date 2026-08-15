import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

import { TableCell, TableRow } from "@/components/ui/table";
import { money0 } from "@/lib/formats";
import { PSP_ANNEES, type StatsGroupe } from "@/lib/psp.prep";
import { cn } from "@/lib/utils";

/**
 * Ligne de groupe repliable/dépliable (tranche ou chargé de clientèle).
 * Le libellé occupe les colonnes descriptives (colSpan), les colonnes
 * « années » et « Total » affichent les totaux du groupe — toujours calculés.
 */
export default function PspGroupRow({
  depth,
  label,
  hint,
  stats,
  expanded,
  onToggle,
  accent,
}: {
  /** 1 = groupe racine (tranche ou chargé), 2 = sous-groupe. */
  depth: 1 | 2;
  label: ReactNode;
  /** Préfixe discret du libellé (ex. « Chargé clientèle : »). */
  hint?: ReactNode;
  stats: StatsGroupe;
  expanded: boolean;
  onToggle: () => void;
  accent?: boolean;
}) {
  return (
    <TableRow
      className={cn(
        "cursor-pointer select-none transition-colors",
        depth === 1 ? "bg-slate-100/90 hover:bg-slate-100" : "bg-slate-50/70 hover:bg-slate-100/70",
        accent && "bg-primary/5 hover:bg-primary/10",
      )}
      onClick={onToggle}
    >
      <TableCell colSpan={6} className="py-2">
        <div
          className={cn(
            "flex items-center gap-2",
            depth === 2 && "pl-6",
            depth === 1
              ? "text-[13px] font-black uppercase tracking-wide"
              : "text-xs font-semibold",
          )}
        >
          <ChevronRight
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              expanded && "rotate-90",
            )}
          />
          {hint ? (
            <span className="font-bold normal-case tracking-normal text-muted-foreground">
              {hint}
            </span>
          ) : null}
          <span className={cn("truncate", depth === 1 && "text-foreground")}>{label}</span>
          <span
            className={cn(
              "shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest",
              depth === 1
                ? "border-slate-300 bg-white text-slate-600"
                : "border-slate-200 bg-white/70 text-muted-foreground",
            )}
          >
            {stats.nbOperations} opération{stats.nbOperations > 1 ? "s" : ""}
          </span>
        </div>
      </TableCell>
      {PSP_ANNEES.map((annee) => (
        <TableCell key={annee} className="py-2 text-right">
          <span
            className={cn(
              "tabnum",
              (stats.parAnnee[String(annee)] ?? 0) > 0
                ? "text-xs font-semibold text-foreground"
                : "text-xs text-muted-foreground/60",
            )}
          >
            {(stats.parAnnee[String(annee)] ?? 0) > 0 ? money0(stats.parAnnee[String(annee)]) : "—"}
          </span>
        </TableCell>
      ))}
      <TableCell className="py-2 text-right">
        <span className="tabnum text-xs font-black text-foreground">{money0(stats.total)}</span>
      </TableCell>
      <TableCell colSpan={5} className="py-2" />
    </TableRow>
  );
}
