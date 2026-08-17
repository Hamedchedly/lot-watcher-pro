/**
 * V8.2 — SUIVI OPÉRATION : tableau des opérations.
 *
 * KPI dynamiques + filtres + tableau 9 colonnes (les détails sont dans la
 * fiche). Réutilise les fonctions pures de `psp.suivi.view` — aucun MOCK.
 */
import { useMemo, useState } from "react";
import { ChevronsUpDown, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { money0 } from "@/lib/formats";
import { PSP_ANNEES } from "@/lib/psp.prep";
import {
  FILTRES_SUIVI_VIDES,
  filtrerOperationsSuivi,
  kpiSuivi,
  trierOperationsSuivi,
  type CleTriSuivi,
  type FiltresSuivi,
} from "@/lib/psp.suivi.view";
import {
  STATUT_CONSULTATION_LABELS,
  STATUT_EXECUTION_LABELS,
  STATUT_PSP_LABELS,
  type StatutConsultationCode,
  type StatutExecutionCode,
  type StatutPspCode,
} from "@/lib/psp.suivi.foundation";
import type { SuiviOperationVue } from "@/lib/psp.suivi.foundation";

const selectCls =
  "h-8 rounded-md border bg-card px-2 text-[10px] text-foreground focus:outline-none";

export default function SuiviTable({
  operations,
  onOpen,
}: {
  operations: SuiviOperationVue[];
  onOpen: (op: SuiviOperationVue) => void;
}) {
  const [filtres, setFiltres] = useState<FiltresSuivi>(FILTRES_SUIVI_VIDES);
  const [cleTri, setCleTri] = useState<CleTriSuivi>("tranche");
  const [asc, setAsc] = useState(true);

  const kpi = useMemo(() => kpiSuivi(operations), [operations]);
  const visibles = useMemo(() => {
    const filtrees = filtrerOperationsSuivi(operations, filtres);
    return trierOperationsSuivi(filtrees, cleTri, asc);
  }, [operations, filtres, cleTri, asc]);

  const set = (patch: Partial<FiltresSuivi>) => setFiltres((f) => ({ ...f, ...patch }));
  const trier = (cle: CleTriSuivi) => {
    if (cle === cleTri) setAsc((a) => !a);
    else {
      setCleTri(cle);
      setAsc(true);
    }
  };

  return (
    <div className="space-y-3">
      {/* KPI dynamiques */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        <Kpi label="Programmées" value={String(kpi.programmees)} />
        <Kpi label="Sans commande" value={String(kpi.sansCommande)} />
        <Kpi label="Demandes devis" value={String(kpi.demandesDevis)} />
        <Kpi label="Devis reçus" value={String(kpi.devisRecus)} />
        <Kpi label="Commandées" value={String(kpi.commandees)} />
        <Kpi label="En cours" value={String(kpi.travauxEnCours)} />
        <Kpi label="Terminées" value={String(kpi.terminees)} />
        <Kpi label="Relances" value={String(kpi.relances)} />
        <Kpi label="Programmé" value={money0(kpi.budgetProgramme)} />
        <Kpi label="Commandé" value={money0(kpi.budgetCommande)} />
        <Kpi label="Engagé" value={money0(kpi.budgetEngage)} />
        <Kpi label="Payé" value={money0(kpi.budgetPaye)} />
      </div>{" "}
      {/* Barre de filtres */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 w-44 pl-7 text-[11px]"
            placeholder="Recherche…"
            value={filtres.recherche}
            onChange={(e) => set({ recherche: e.target.value })}
          />
        </div>
        <select
          className={selectCls}
          value={filtres.annee}
          onChange={(e) => set({ annee: e.target.value })}
        >
          <option value="">Année : toutes</option>
          {PSP_ANNEES.map((a) => (
            <option key={a} value={String(a)}>
              {a}
            </option>
          ))}
        </select>
        <Input
          className="h-8 w-20 text-[11px]"
          placeholder="TR"
          value={filtres.tranche}
          onChange={(e) => set({ tranche: e.target.value })}
        />
        <Input
          className="h-8 w-24 text-[11px]"
          placeholder="CC"
          value={filtres.cc}
          onChange={(e) => set({ cc: e.target.value })}
        />
        <select
          className={selectCls}
          value={filtres.categorie}
          onChange={(e) => set({ categorie: e.target.value })}
        >
          <option value="">C : toutes</option>
          {(["GE", "GT", "CP"] as const).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          className={selectCls}
          value={filtres.statutPsp}
          onChange={(e) => set({ statutPsp: e.target.value })}
        >
          <option value="">Statut PSP : tous</option>
          {(Object.keys(STATUT_PSP_LABELS) as StatutPspCode[]).map((s) => (
            <option key={s} value={s}>
              {STATUT_PSP_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          className={selectCls}
          value={filtres.statutConsultation}
          onChange={(e) => set({ statutConsultation: e.target.value })}
        >
          <option value="">Consultation : toutes</option>
          {(Object.keys(STATUT_CONSULTATION_LABELS) as StatutConsultationCode[]).map((s) => (
            <option key={s} value={s}>
              {STATUT_CONSULTATION_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          className={selectCls}
          value={filtres.statutExecution}
          onChange={(e) => set({ statutExecution: e.target.value })}
        >
          <option value="">Exécution : tous</option>
          {(Object.keys(STATUT_EXECUTION_LABELS) as StatutExecutionCode[]).map((s) => (
            <option key={s} value={s}>
              {STATUT_EXECUTION_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          className={selectCls}
          value={filtres.commande}
          onChange={(e) => set({ commande: e.target.value as "toutes" | "avec" | "sans" })}
        >
          <option value="toutes">Commande : toutes</option>
          <option value="avec">Avec commande</option>
          <option value="sans">Sans commande</option>
        </select>
        <select
          className={selectCls}
          value={filtres.priorite}
          onChange={(e) => set({ priorite: e.target.value })}
        >
          <option value="">Priorité : toutes</option>
          <option value="prioritaire">Prioritaire</option>
          <option value="normale">Normale</option>
          <option value="non_prioritaire">Non prioritaire</option>
        </select>
      </div>
      {/* Tableau */}
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[900px] text-left text-[11px]">
          <thead>
            <tr className="border-b bg-muted/40 text-[9px] uppercase tracking-wider text-muted-foreground">
              <Th
                label="Opération"
                cle="nature"
                onTri={trier}
                actif={cleTri === "nature"}
                asc={asc}
                icon
              />
              <Th
                label="TR"
                cle="tranche"
                onTri={trier}
                actif={cleTri === "tranche"}
                asc={asc}
                icon
              />
              <Th label="CC" cle="cc" onTri={trier} actif={cleTri === "cc"} asc={asc} icon />
              <Th
                label="C"
                cle="categorie"
                onTri={trier}
                actif={cleTri === "categorie"}
                asc={asc}
                icon
              />
              <Th
                label="Programmation"
                cle="annee"
                onTri={trier}
                actif={cleTri === "annee"}
                asc={asc}
                icon
              />
              <th className="px-2 py-1.5 font-bold">Devis</th>
              <th className="px-2 py-1.5 font-bold">Commande</th>
              <th className="px-2 py-1.5 font-bold">Travaux</th>
              <th className="px-2 py-1.5 font-bold">Financier</th>
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-2 py-6 text-center text-muted-foreground">
                  Aucune donnée disponible.
                </td>
              </tr>
            ) : (
              visibles.map((op) => {
                const p = op.programmation;
                const c = op.consultation;
                const cmd = op.commandes;
                const ex = op.execution;
                return (
                  <tr
                    key={op.identite.id}
                    onClick={() => onOpen(op)}
                    className="cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/40"
                  >
                    <td className="px-2 py-1.5">
                      <p className="font-semibold">{p.nature ?? "Sans nature"}</p>
                      <p className="text-[9px] text-muted-foreground">{p.corps_etat ?? "—"}</p>
                    </td>
                    <td className="px-2 py-1.5 font-bold">{op.identite.tranche}</td>
                    <td className="px-2 py-1.5">{p.cc ?? "—"}</td>
                    <td className="px-2 py-1.5">
                      <Badge variant="outline">{op.identite.categorie}</Badge>
                    </td>
                    <td className="px-2 py-1.5">
                      <p className="font-bold">{p.annee_premiere ?? "—"}</p>
                      <p className="text-[9px] text-muted-foreground">{money0(p.montant_total)}</p>
                    </td>
                    <td className="px-2 py-1.5">
                      <p className={c.relance_necessaire ? "font-semibold text-amber-700" : ""}>
                        {c.statut_label}
                      </p>
                      {c.relance_necessaire && (
                        <p className="text-[9px] font-bold text-amber-700">Relance</p>
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      {cmd.nb_commandes === 0 ? (
                        <span className="text-muted-foreground">Sans commande</span>
                      ) : (
                        <>
                          <p className="font-semibold">
                            {cmd.liees[0]?.numero_commande ?? "—"}
                            {cmd.nb_commandes > 1 ? ` (+${cmd.nb_commandes - 1})` : ""}
                          </p>
                          <p className="text-[9px] text-muted-foreground">
                            {cmd.liees[0]?.entreprise ?? "—"}
                          </p>
                        </>
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      <Badge variant="outline" className="text-[9px]">
                        {ex.statut_label}
                      </Badge>
                    </td>
                    <td className="px-2 py-1.5">
                      <p className="font-semibold">{money0(p.montant_total)}</p>
                      <p className="text-[9px] text-muted-foreground">
                        Cmd {money0(cmd.budget_commande)} · Eng {money0(cmd.engage)} · Payé{" "}
                        {money0(cmd.paye)}
                      </p>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-muted-foreground">
        {visibles.length} opération(s) affichée(s) sur {operations.length} — cliquez sur une ligne
        pour ouvrir la fiche.
      </p>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card px-2 py-1.5">
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-bold">{value}</p>
    </div>
  );
}

function Th({
  label,
  cle,
  onTri,
  actif,
  asc,
  icon = false,
}: {
  label: string;
  cle: CleTriSuivi;
  onTri: (cle: CleTriSuivi) => void;
  actif: boolean;
  asc: boolean;
  icon?: boolean;
}) {
  return (
    <th
      className="cursor-pointer select-none px-2 py-1.5 font-bold hover:bg-muted"
      onClick={() => onTri(cle)}
    >
      <span className="inline-flex items-center gap-0.5">
        {label}
        {icon && <ChevronsUpDown className="size-2.5 opacity-60" />}
        {actif ? (asc ? " ▲" : " ▼") : ""}
      </span>
    </th>
  );
}
