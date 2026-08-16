import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

import PspDetailFilters from "@/components/preparation-psp/PspDetailFilters";
import PspGroupRow from "@/components/preparation-psp/PspGroupRow";
import PspOperationRow from "@/components/preparation-psp/PspOperationRow";
import PspQuickAddRow from "@/components/preparation-psp/PspQuickAddRow";
import type { ModeAffichage } from "@/components/preparation-psp/PspGroupingSelector";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { money0 } from "@/lib/formats";
import {
  PSP_ANNEES,
  filtrerOperations,
  grouperParChargéClientele,
  grouperParTranche,
  sommeParAnnee,
  statsOperations,
  trierOperationsDetail,
  type CleTri,
  type FiltresDetail,
  type PspOperation,
  type SousGroupeCharge,
  type SousGroupeTranche,
} from "@/lib/psp.prep";
import type { LotInfo, PerimetreLigne } from "@/lib/psp.prep.v7";
import type { ReferencePatrimoine } from "@/lib/psp.prep.data";
import { cn } from "@/lib/utils";

/** Clés de groupe pour l'état déplié/replié. */
type CleGroupe =
  `t1:${string}` | `t2:${string}|${string}` | `c1:${string}` | `c2:${string}|${string}`;

const FILTRES_VIDES: FiltresDetail = {
  q: "",
  categorie: "",
  tranche: "",
  charge_clientele: "",
  corps_etat: "",
  annee: "",
};

const filtersActive = (f: FiltresDetail): boolean =>
  Boolean(f.q || f.categorie || f.tranche || f.charge_clientele || f.corps_etat || f.annee);

/** Colonnes descriptives (avant les années) : TR CC Adresse Corps C Nature. */
const NB_COLS_DESCRIPTIVES = 6;
/** Colonnes après Total : Devis, Priorité, Statut / Notes, Actions. */
const NB_COLS_TRAILING = 4;

const COLONNES: Array<{ cle: CleTri | null; label: string; align?: "right" }> = [
  { cle: "tranche", label: "TR" },
  { cle: "charge_clientele", label: "CC" },
  { cle: "adresse", label: "Adresse / périmètre" },
  { cle: "corps_etat", label: "Corps d'état" },
  { cle: "secteur", label: "C" },
  { cle: "nature_travaux", label: "Nature travaux" },
  ...PSP_ANNEES.map((a) => ({
    cle: String(a) as CleTri,
    label: String(a),
    align: "right" as const,
  })),
  { cle: "total", label: "Total", align: "right" as const },
  { cle: null, label: "Devis" },
  { cle: "priorite", label: "Priorité" },
  { cle: null, label: "Statut / Notes" },
  { cle: null, label: "Actions" },
];

/**
 * Tableau principal du module. Les totaux des groupes et du pied de tableau
 * sont TOUJOURS calculés à partir des opérations (jamais saisis). Le mode
 * « Détail » (aucun regroupement) est le mode PAR DÉFAUT ; les en-têtes sont
 * triables par clic. La ligne de saisie directe est TOUJOURS affichée en bas.
 */
export default function PspTable({
  mode,
  operations,
  filters,
  onFiltersChange,
  onOpenOperation,
  onModifier,
  onSupprimer,
  onStatutPriorite,
  onNotes,
  perimetresParLigne,
  lotsParId,
  quickAdd,
  figee,
}: {
  mode: ModeAffichage;
  operations: PspOperation[];
  filters: FiltresDetail;
  onFiltersChange: (f: FiltresDetail) => void;
  onOpenOperation: (op: PspOperation) => void;
  onModifier: (op: PspOperation) => void;
  onSupprimer: (id: string) => void;
  onStatutPriorite: (id: string, patch: { statut?: string; priorite?: string }) => void;
  onNotes: (id: string, remarques: string) => void;
  perimetresParLigne: Map<string, PerimetreLigne[]>;
  lotsParId: Map<string, LotInfo>;
  quickAdd: {
    programmationId: string;
    reference: ReferencePatrimoine | null;
    onSaved: () => void;
  } | null;
  figee: boolean;
}) {
  const [expanded, setExpanded] = useState<Set<CleGroupe>>(new Set());
  const [tri, setTri] = useState<{ cle: CleTri; asc: boolean } | null>(null);

  /** À chaque changement de mode : tout déplier pour visualiser la hiérarchie. */
  useEffect(() => {
    const toutes: CleGroupe[] = [];
    if (mode === "tranche") {
      for (const g of grouperParTranche(operations)) {
        toutes.push(`t1:${g.tranche}`);
        for (const c of g.charges) toutes.push(`t2:${g.tranche}|${c.charge_clientele}`);
      }
    } else if (mode === "charge") {
      for (const g of grouperParChargéClientele(operations)) {
        toutes.push(`c1:${g.charge_clientele}`);
        for (const t of g.tranches) toutes.push(`c2:${g.charge_clientele}|${t.tranche}`);
      }
    }
    setExpanded(new Set(toutes));
  }, [mode, operations]);

  const basculer = (cle: CleGroupe) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(cle)) next.delete(cle);
      else next.add(cle);
      return next;
    });

  const filtrees = useMemo(() => filtrerOperations(operations, filters), [operations, filters]);
  const triees = useMemo(
    () => (tri ? trierOperationsDetail(filtrees, tri.cle, tri.asc) : filtrees),
    [filtrees, tri],
  );
  const totauxDetail = useMemo(() => statsOperations(triees), [triees]);
  const parAnneeDetail = useMemo(() => sommeParAnnee(triees), [triees]);

  const changerTri = (cle: CleTri) => {
    setTri((prev) => {
      if (prev?.cle === cle) return { cle, asc: !prev.asc };
      const numerique = cle === "total" || PSP_ANNEES.map(String).includes(cle);
      return { cle, asc: !numerique };
    });
  };

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-panel">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-surface/50 px-3 py-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          {mode === "tranche" && "Regroupement par tranche → chargé de clientèle (optionnel)"}
          {mode === "charge" && "Regroupement par chargé de clientèle → tranche (optionnel)"}
          {mode === "detail" && `Détail — ${triees.length} opérations`}
        </p>
        {mode === "detail" && filtersActive(filters) ? (
          <button
            type="button"
            onClick={() => onFiltersChange(FILTRES_VIDES)}
            className="text-[10px] font-bold text-primary hover:underline"
          >
            Réinitialiser les filtres
          </button>
        ) : null}
      </div>

      {mode === "detail" ? (
        <div className="border-b px-3 py-2">
          <PspDetailFilters filters={filters} onChange={onFiltersChange} operations={operations} />
        </div>
      ) : null}

      <div className="max-h-[62vh] overflow-auto">
        <Table className="min-w-[1700px]">
          <TableHeader>
            <TableRow className="border-b bg-muted/50">
              {COLONNES.map((col, i) => (
                <TableHead
                  key={`${col.label}-${i}`}
                  className={cn(
                    "sticky top-0 z-10 whitespace-nowrap bg-muted/95 text-[10px] font-black uppercase tracking-widest",
                    col.align === "right" && "text-right",
                    mode === "detail" &&
                      col.cle &&
                      "cursor-pointer select-none hover:text-foreground",
                  )}
                  onClick={
                    mode === "detail" && col.cle ? () => changerTri(col.cle as CleTri) : undefined
                  }
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {mode === "detail" && col.cle ? (
                      tri?.cle === col.cle ? (
                        tri.asc ? (
                          <ArrowUp className="size-3" />
                        ) : (
                          <ArrowDown className="size-3" />
                        )
                      ) : (
                        <ChevronsUpDown className="size-3 opacity-40" />
                      )
                    ) : null}
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {/* Ligne de saisie directe — VRAIE LIGNE, juste sous l'en-tête */}
            {quickAdd ? (
              <PspQuickAddRow
                programmationId={quickAdd.programmationId}
                reference={quickAdd.reference}
                onSaved={quickAdd.onSaved}
                figee={figee}
              />
            ) : null}

            {mode === "detail"
              ? triees.map((op) => (
                  <PspOperationRow
                    key={op.id}
                    op={op}
                    perimetres={perimetresParLigne.get(op.id) ?? []}
                    lotsParId={lotsParId}
                    onOpen={onOpenOperation}
                    onModifier={onModifier}
                    onSupprimer={onSupprimer}
                    onStatutPriorite={onStatutPriorite}
                    onNotes={onNotes}
                  />
                ))
              : null}

            {mode === "tranche"
              ? grouperParTranche(operations).map((g) => (
                  <FragmentsTranche
                    key={g.tranche}
                    tranche={g.tranche}
                    charges={g.charges}
                    stats={g.stats}
                    expanded={expanded}
                    basculer={basculer}
                    onOpenOperation={onOpenOperation}
                    onModifier={onModifier}
                    onSupprimer={onSupprimer}
                    onStatutPriorite={onStatutPriorite}
                    onNotes={onNotes}
                    perimetresParLigne={perimetresParLigne}
                    lotsParId={lotsParId}
                  />
                ))
              : null}

            {mode === "charge"
              ? grouperParChargéClientele(operations).map((g) => (
                  <FragmentsChargé
                    key={g.charge_clientele}
                    charge={g.charge_clientele}
                    tranches={g.tranches}
                    stats={g.stats}
                    expanded={expanded}
                    basculer={basculer}
                    onOpenOperation={onOpenOperation}
                    onModifier={onModifier}
                    onSupprimer={onSupprimer}
                    onStatutPriorite={onStatutPriorite}
                    onNotes={onNotes}
                    perimetresParLigne={perimetresParLigne}
                    lotsParId={lotsParId}
                  />
                ))
              : null}
          </TableBody>

          {mode === "detail" ? (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={NB_COLS_DESCRIPTIVES} className="py-2 text-xs font-bold">
                  Total — {triees.length} opération{triees.length > 1 ? "s" : ""}
                </TableCell>
                {PSP_ANNEES.map((annee) => (
                  <TableCell key={annee} className="py-2 text-right">
                    <span className="tabnum text-xs font-bold">
                      {(parAnneeDetail[String(annee)] ?? 0) > 0
                        ? money0(parAnneeDetail[String(annee)] ?? 0)
                        : "—"}
                    </span>
                  </TableCell>
                ))}
                <TableCell className="py-2 text-right">
                  <span className="tabnum text-xs font-black text-primary">
                    {money0(totauxDetail.total)}
                  </span>
                </TableCell>
                <TableCell colSpan={NB_COLS_TRAILING} className="py-2" />
              </TableRow>
            </TableFooter>
          ) : null}
        </Table>
      </div>
    </div>
  );
}

type PropsOpLigne = {
  onOpenOperation: (op: PspOperation) => void;
  onModifier: (op: PspOperation) => void;
  onSupprimer: (id: string) => void;
  onStatutPriorite: (id: string, patch: { statut?: string; priorite?: string }) => void;
  onNotes: (id: string, remarques: string) => void;
  perimetresParLigne: Map<string, PerimetreLigne[]>;
  lotsParId: Map<string, LotInfo>;
};

/** Fragments JSX du mode « Par tranche » : groupe racine + sous-groupes + opérations. */
function FragmentsTranche({
  tranche,
  charges,
  stats,
  expanded,
  basculer,
  ...ligne
}: {
  tranche: string;
  charges: SousGroupeCharge[];
  stats: { nbOperations: number; parAnnee: Record<string, number>; total: number };
  expanded: Set<CleGroupe>;
  basculer: (cle: CleGroupe) => void;
} & PropsOpLigne) {
  const cle1: CleGroupe = `t1:${tranche}`;
  const ouvert1 = expanded.has(cle1);
  return (
    <>
      <PspGroupRow
        depth={1}
        label={`TRANCHE ${tranche}`}
        stats={stats}
        expanded={ouvert1}
        onToggle={() => basculer(cle1)}
      />
      {ouvert1
        ? charges.map((c) => {
            const cle2: CleGroupe = `t2:${tranche}|${c.charge_clientele}`;
            const ouvert2 = expanded.has(cle2);
            return (
              <FragmentSousGroupe
                key={cle2}
                cle={cle2}
                hint="Chargé clientèle :"
                label={c.charge_clientele}
                stats={c.stats}
                expanded={ouvert2}
                basculer={basculer}
                operations={c.operations}
                {...ligne}
              />
            );
          })
        : null}
    </>
  );
}

/** Fragments JSX du mode « Par chargé de clientèle » : groupe racine + sous-groupes. */
function FragmentsChargé({
  charge,
  tranches,
  stats,
  expanded,
  basculer,
  ...ligne
}: {
  charge: string;
  tranches: SousGroupeTranche[];
  stats: { nbOperations: number; parAnnee: Record<string, number>; total: number };
  expanded: Set<CleGroupe>;
  basculer: (cle: CleGroupe) => void;
} & PropsOpLigne) {
  const cle1: CleGroupe = `c1:${charge}`;
  const ouvert1 = expanded.has(cle1);
  return (
    <>
      <PspGroupRow
        depth={1}
        label={charge}
        stats={stats}
        expanded={ouvert1}
        onToggle={() => basculer(cle1)}
      />
      {ouvert1
        ? tranches.map((t) => {
            const cle2: CleGroupe = `c2:${charge}|${t.tranche}`;
            const ouvert2 = expanded.has(cle2);
            return (
              <FragmentSousGroupe
                key={cle2}
                cle={cle2}
                hint="Tranche :"
                label={t.tranche}
                stats={t.stats}
                expanded={ouvert2}
                basculer={basculer}
                operations={t.operations}
                {...ligne}
              />
            );
          })
        : null}
    </>
  );
}

/** Sous-groupe (niveau 2) : ligne de groupe + opérations si déplié. */
function FragmentSousGroupe({
  cle,
  hint,
  label,
  stats,
  expanded,
  basculer,
  operations,
  onOpenOperation,
  onModifier,
  onSupprimer,
  onStatutPriorite,
  onNotes,
  perimetresParLigne,
  lotsParId,
}: {
  cle: CleGroupe;
  hint: string;
  label: string;
  stats: { nbOperations: number; parAnnee: Record<string, number>; total: number };
  expanded: boolean;
  basculer: (cle: CleGroupe) => void;
  operations: PspOperation[];
} & PropsOpLigne) {
  return (
    <>
      <PspGroupRow
        depth={2}
        hint={hint}
        label={label}
        stats={stats}
        expanded={expanded}
        onToggle={() => basculer(cle)}
      />
      {expanded
        ? operations.map((op) => (
            <PspOperationRow
              key={op.id}
              op={op}
              perimetres={perimetresParLigne.get(op.id) ?? []}
              lotsParId={lotsParId}
              onOpen={onOpenOperation}
              onModifier={onModifier}
              onSupprimer={onSupprimer}
              onStatutPriorite={onStatutPriorite}
              onNotes={onNotes}
            />
          ))
        : null}
    </>
  );
}
