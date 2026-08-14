import { Layers, List, Users } from "lucide-react";

import { cn } from "@/lib/utils";

/** Modes d'affichage du module (V1). */
export type ModeAffichage = "tranche" | "charge" | "detail";

const MODES: Array<{
  valeur: ModeAffichage;
  label: string;
  icone: typeof Layers;
}> = [
  { valeur: "tranche", label: "Par tranche", icone: Layers },
  { valeur: "charge", label: "Par chargé de clientèle", icone: Users },
  { valeur: "detail", label: "Détail", icone: List },
];

/**
 * Sélecteur des trois modes d'affichage :
 * [Par tranche] [Par chargé de clientèle] [Détail]
 */
export default function PspGroupingSelector({
  mode,
  onChange,
}: {
  mode: ModeAffichage;
  onChange: (mode: ModeAffichage) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border bg-surface p-1">
      {MODES.map(({ valeur, label, icone: Icone }) => (
        <button
          key={valeur}
          type="button"
          onClick={() => onChange(valeur)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-colors",
            mode === valeur
              ? "bg-card text-foreground shadow-sm ring-1 ring-border"
              : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
          )}
        >
          <Icone className="size-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}
