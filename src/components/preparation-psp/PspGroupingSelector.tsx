import { Layers, List, Users } from "lucide-react";

import { cn } from "@/lib/utils";

/** Modes d'affichage du module (V2 + V3). */
export type ModeAffichage = "tranche" | "charge" | "detail" | "reports";

// V8.6.3 — L'option « reports » (revue V3/V4, identité TR+C) est MASQUÉE du
// parcours principal : elle n'est plus cohérente avec l'architecture actuelle
// (une opération = une psp_lignes, identité = psp_lignes.id). Le type
// ModeAffichage et les composants legacy restent disponibles (tests, données
// historiques) mais l'accès UI est désactivé.
const MODES: Array<{
  valeur: ModeAffichage;
  label: string;
  icone: typeof Layers;
}> = [
  { valeur: "detail", label: "Détail", icone: List },
  { valeur: "tranche", label: "Par tranche", icone: Layers },
  { valeur: "charge", label: "Par chargé de clientèle", icone: Users },
  // 'reports' retiré de MODES (V8.6.3 — LEGACY V3/V4, non accessible depuis l'UI).
];

/**
 * Sélecteur des modes d'affichage (V7.4 — ordre métier) :
 * [Détail] [Par tranche] [Par chargé de clientèle] [Revue des reports]
 * Détail est le premier et le mode par défaut.
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
