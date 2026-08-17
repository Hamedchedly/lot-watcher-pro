/**
 * V8.2.2 — OPÉRATIONS : tableau principal (registre opérationnel unique).
 *
 * Simplifié : 10 colonnes, 7 KPI, 3 filtres (Recherche / Origine / État).
 * Les montants détaillés restent dans la fiche. Aucun MOCK.
 */
import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { money0 } from "@/lib/formats";
import {
  FILTRES_SUIVI_VIDES,
  filtrerOperationsSuivi,
  kpiSuivi,
  type FiltresSuivi,
} from "@/lib/psp.suivi.view";
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
  const set = (patch: Partial<FiltresSuivi>) => setFiltres((f) => ({ ...f, ...patch }));
  const kpi = useMemo(() => kpiSuivi(operations), [operations]);
  const visibles = useMemo(
    () => filtrerOperationsSuivi(operations, filtres),
    [operations, filtres],
  );

  return (
    <div className="space-y-3">
      {/* KPI — limités (V8.2.2) */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        <Kpi label="Opérations" value={String(kpi.operations)} />
        <Kpi label="Budget programmé" value={money0(kpi.budgetProgramme)} />
        <Kpi label="Commandé" value={money0(kpi.budgetCommande)} />
        <Kpi label="Engagé" value={money0(kpi.budgetEngage)} />
        <Kpi label="Payé" value={money0(kpi.budgetPaye)} />
        <Kpi label="Travaux en cours" value={String(kpi.travauxEnCours)} />
        <Kpi label="Terminées" value={String(kpi.terminees)} />
      </div>
      {/* Filtres — 3 uniquement (Recherche / Origine / État) */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 w-56 pl-7 text-[11px]"
            placeholder="Recherche : TR, adresse, corps d'état, entreprise, n° commande…"
            value={filtres.recherche}
            onChange={(e) => set({ recherche: e.target.value })}
          />
        </div>
        <select
          className={selectCls}
          value={filtres.origine}
          onChange={(e) => set({ origine: e.target.value as "toutes" | "psp" | "hors_psp" })}
        >
          <option value="toutes">Origine : toutes</option>
          <option value="psp">PSP</option>
          <option value="hors_psp">Hors PSP</option>
        </select>
        <select
          className={selectCls}
          value={filtres.etat}
          onChange={(e) =>
            set({
              etat: e.target.value as
                "toutes" | "consultation" | "commande" | "travaux_en_cours" | "travaux_termines",
            })
          }
        >
          <option value="toutes">État : toutes</option>
          <option value="consultation">Consultation</option>
          <option value="commande">Commande</option>
          <option value="travaux_en_cours">Travaux en cours</option>
          <option value="travaux_termines">Travaux terminés</option>
        </select>
      </div>{" "}
      {/* Tableau — 10 colonnes (détails dans la fiche) */}
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[860px] text-left text-[11px]">
          <thead>
            <tr className="border-b bg-muted/40 text-[9px] uppercase tracking-wider text-muted-foreground">
              <th className="px-2 py-1.5 font-bold">Opération</th>
              <th className="px-2 py-1.5 font-bold">TR</th>
              <th className="px-2 py-1.5 font-bold">Sous-secteur</th>
              <th className="px-2 py-1.5 font-bold">CC</th>
              <th className="px-2 py-1.5 font-bold">Corps d&apos;état</th>
              <th className="px-2 py-1.5 font-bold">Programmation</th>
              <th className="px-2 py-1.5 font-bold">Consultation</th>
              <th className="px-2 py-1.5 font-bold">Devis</th>
              <th className="px-2 py-1.5 font-bold">Commande</th>
              <th className="px-2 py-1.5 font-bold">Travaux</th>
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-2 py-6 text-center text-muted-foreground">
                  Aucune donnée disponible.
                </td>
              </tr>
            ) : (
              visibles.map((op) => (
                <tr
                  key={op.identite.id}
                  onClick={() => onOpen(op)}
                  className="cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/40"
                >
                  <td className="px-2 py-1.5">
                    <p className="font-semibold">{op.programmation.nature ?? "Sans nature"}</p>
                    <Badge variant="outline" className="text-[9px]">
                      {op.identite.origine === "hors_psp" ? "Hors PSP" : "PSP"}
                    </Badge>
                  </td>
                  <td className="px-2 py-1.5 font-bold">{op.identite.tranche}</td>
                  <td className="px-2 py-1.5">{op.programmation.sous_secteur ?? "—"}</td>
                  <td className="px-2 py-1.5">{op.programmation.cc ?? "—"}</td>
                  <td className="px-2 py-1.5">{op.programmation.corps_etat ?? "—"}</td>
                  <td className="px-2 py-1.5">
                    {op.identite.origine === "hors_psp" ? (
                      <span className="text-muted-foreground">Hors programme</span>
                    ) : (
                      <>
                        <p className="font-bold">{op.programmation.annee_premiere ?? "—"}</p>
                        <p className="text-[9px] text-muted-foreground">
                          {money0(op.programmation.montant_total)}
                        </p>
                      </>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    {op.consultation.nb_entreprises_consultees > 0 ? (
                      <span className={op.consultation.relance_necessaire ? "text-amber-700" : ""}>
                        {op.consultation.nb_entreprises_consultees} entreprise(s)
                        {op.consultation.relance_necessaire ? " · Relance" : ""}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Pas de consultation</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    {op.consultation.statut === "devis_retenu" ? (
                      <span className="font-semibold text-emerald-700">Devis retenu</span>
                    ) : op.consultation.nb_devis_recus > 0 ? (
                      <span>{op.consultation.nb_devis_recus} reçu(s)</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    {op.commandes.nb_commandes === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <p className="font-semibold">
                        {op.commandes.liees[0]?.numero_commande ?? "—"}
                        {op.commandes.nb_commandes > 1
                          ? ` (+${op.commandes.nb_commandes - 1})`
                          : ""}
                      </p>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    <Badge variant="outline" className="text-[9px]">
                      {op.execution.statut_label}
                    </Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-muted-foreground">
        {visibles.length} opération(s) affichée(s) sur {operations.length} — cliquez pour ouvrir la
        fiche (détails financiers et parcours complet).
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
