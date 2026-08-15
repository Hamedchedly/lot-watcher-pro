/**
 * V7 — Cockpit annuel : filtre d'années CUMULATIF (cliquable, désélectionnable)
 * + enveloppes GE/GT/CP par année (consommé / restant / % — jamais stockés).
 * Le filtre est UNIQUEMENT visuel : il ne modifie jamais la programmation.
 */
import { useMemo } from "react";
import { Settings2, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { money0 } from "@/lib/formats";
import { PSP_ANNEES, type PspAnnee, type PspOperation } from "@/lib/psp.prep";
import { calculEnveloppe } from "@/lib/psp.prep.v7";

export type EnveloppeMap = Record<string, number>; // clé `${annee}|${categorie}`

export default function PspCockpitV7({
  operations,
  anneesFiltre,
  anneeActive,
  onToggleAnnee,
  enveloppes,
  onOuvrirEnveloppes,
  figee,
}: {
  operations: PspOperation[];
  anneesFiltre: PspAnnee[];
  anneeActive: PspAnnee;
  onToggleAnnee: (a: PspAnnee) => void;
  enveloppes: EnveloppeMap;
  onOuvrirEnveloppes: () => void;
  figee: boolean;
}) {
  const programmePar = useMemo(() => {
    const m: Record<string, number> = {};
    for (const op of operations) {
      for (const a of PSP_ANNEES) {
        const v = op.programme?.[String(a)] ?? 0;
        if (v > 0) m[`${a}|${op.categorie}`] = (m[`${a}|${op.categorie}`] ?? 0) + v;
      }
    }
    return m;
  }, [operations]);

  const lignesParAnnee = useMemo(() => {
    const m: Record<string, number> = {};
    for (const op of operations) {
      for (const a of PSP_ANNEES) {
        if ((op.programme?.[String(a)] ?? 0) > 0) m[String(a)] = (m[String(a)] ?? 0) + 1;
      }
    }
    return m;
  }, [operations]);

  const totalFiltre = useMemo(() => {
    const set = new Set(anneesFiltre.map(String));
    if (set.size === 0) return operations.length;
    return operations.filter((op) =>
      PSP_ANNEES.some((a) => set.has(String(a)) && (op.programme?.[String(a)] ?? 0) > 0),
    ).length;
  }, [operations, anneesFiltre]);

  return (
    <div className="rounded-xl border bg-surface/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          Répartition annuelle — {totalFiltre} opération(s) affichée(s) · filtre cumulatif (ne
          modifie pas la programmation)
        </p>
        <Button variant="outline" size="sm" onClick={onOuvrirEnveloppes} disabled={figee}>
          <Settings2 className="size-3.5" />
          Gérer les enveloppes
        </Button>
      </div>

      {/* Années cliquables */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {PSP_ANNEES.map((a) => {
          const actif = anneesFiltre.includes(a);
          const actifAnnee = anneeActive === a;
          return (
            <button
              key={a}
              onClick={() => onToggleAnnee(a)}
              className={`rounded-lg border px-3 py-1 text-xs font-black transition-colors ${
                actif
                  ? "border-primary bg-primary text-primary-foreground"
                  : actifAnnee
                    ? "border-primary/60 bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:border-primary/50"
              } ${actifAnnee ? "ring-2 ring-primary/30" : ""}`}
              title={`${actif ? "Désélectionner" : "Sélectionner (cumulatif)"} — enveloppes ${a}`}
            >
              {a} ·{" "}
              {money0(
                (programmePar[`${a}|GE`] ?? 0) +
                  (programmePar[`${a}|GT`] ?? 0) +
                  (programmePar[`${a}|CP`] ?? 0),
              )}
            </button>
          );
        })}
      </div>

      {/* Enveloppes GE/GT/CP pour l'année active */}
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {(["GE", "GT", "CP"] as const).map((cat) => {
          const enveloppe = enveloppes[`${anneeActive}|${cat}`] ?? 0;
          const programme = programmePar[`${anneeActive}|${cat}`] ?? 0;
          const calc = calculEnveloppe(enveloppe, programme);
          const pct = calc.pourcentage == null ? null : Math.min(1, calc.pourcentage);
          return (
            <div key={cat} className="rounded-lg border p-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-black">{cat}</span>
                <span className="font-mono tabnum text-muted-foreground">
                  {money0(programme)} / {money0(enveloppe)}
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-border">
                <div
                  className={`h-full rounded-full ${calc.depassement ? "bg-destructive" : "bg-primary"}`}
                  style={{ width: `${Math.max(2, (pct ?? 0) * 100)}%` }}
                />
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground">
                  {calc.pourcentage == null
                    ? "enveloppe non définie"
                    : `${Math.round(calc.pourcentage * 100)} %`}
                </span>
                {calc.depassement ? (
                  <span className="flex items-center gap-0.5 font-bold text-destructive">
                    <TriangleAlert className="size-3" /> Dépassement {money0(-calc.restant)}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Restant {money0(calc.restant)}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground">
        BUDGET_SOURCE = MOCK · {money0(programmePar[`${anneeActive}|${"GE"}`] ?? 0)} +{" "}
        {money0(programmePar[`${anneeActive}|${"GT"}`] ?? 0)} +{" "}
        {money0(programmePar[`${anneeActive}|${"CP"}`] ?? 0)} programmé(s) ·{" "}
        {lignesParAnnee[String(anneeActive)] ?? 0} ligne(s) en {anneeActive}
      </p>
    </div>
  );
}
