import type { StatutTravaux } from "@/lib/lots";
import { STATUT_LABELS } from "@/lib/lots";
import { cn } from "@/lib/utils";

const styles: Record<StatutTravaux, string> = {
  realise: "bg-success/12 text-success border-success/30",
  planifie: "bg-info/12 text-info border-info/30",
  a_prevoir: "bg-warning/15 text-warning-foreground border-warning/40",
};

export function StatutBadge({ statut, className }: { statut: StatutTravaux; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        styles[statut],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {STATUT_LABELS[statut]}
    </span>
  );
}
