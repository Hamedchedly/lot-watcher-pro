/**
 * V1 VISUELLE — Fiche opération structurée en 4 blocs (lecture seule).
 *
 * A. IDENTIFICATION  — TR, adresse, patrimoine (périmètre), descriptif, corps, LB.
 * B. PROGRAMMATION   — montants 2027-2031 + total.
 * C. CONSULTATION    — entreprises consultées / devis (statut psp_devis dérivé).
 * D. SUIVI           — états réels existants (réutilise PspSuiviApercu, lecture
 *                      seule : état réel / importé / consultation / pilotage).
 *
 * Aucune écriture, aucun nouveau moteur.
 */
import { useMemo } from "react";
import { Archive, Building2, CalendarRange, X } from "lucide-react";

import PspSuiviApercu from "@/components/preparation-psp/PspSuiviApercu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { money0 } from "@/lib/formats";
import { PSP_ANNEES } from "@/lib/psp.prep";
import { libelleEntreprise } from "@/lib/psp.prep.v7";
import type { SuiviOperationVue } from "@/lib/psp.suivi.foundation";
import { cn } from "@/lib/utils";

function Bloc({
  titre,
  icone: Icone,
  children,
}: {
  titre: string;
  icone: typeof Archive;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card p-3">
      <h3 className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        <Icone className="size-3.5" />
        {titre}
      </h3>
      {children}
    </section>
  );
}

function Cellule({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="text-xs font-medium">{value ?? "—"}</p>
    </div>
  );
}

export default function PspV1Fiche({
  operation,
  onClose,
}: {
  operation: SuiviOperationVue;
  onClose: () => void;
}) {
  const montantParAnnee = useMemo(
    () => new Map(operation.programmation.annees.map((a) => [a.annee, a.montant])),
    [operation],
  );

  const perimetre = operation.programmation.perimetre ?? [];
  const nbLots = perimetre.filter((p) => p.niveau === "lot").length;

  return (
    <div className="rounded-xl border bg-surface/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-black">{operation.identite.tranche}</span>
          <Badge variant="outline">{operation.programmation.statut_psp_label}</Badge>
          <span className="text-[10px] text-muted-foreground">
            origine : {operation.programmation.ligne.origine}
          </span>
        </div>
        <Button variant="ghost" size="icon" className="size-7" onClick={onClose}>
          <X className="size-3.5" />
        </Button>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* ── A. IDENTIFICATION ─────────────────────────────────────────────── */}
        <Bloc titre="A · Identification" icone={Archive}>
          <div className="grid grid-cols-2 gap-2">
            <Cellule label="TR" value={operation.identite.tranche} />
            <Cellule label="Catégorie" value={operation.identite.categorie} />
            <Cellule label="Adresse" value={operation.programmation.adresse} />
            <Cellule
              label="Patrimoine (périmètre)"
              value={
                nbLots > 0
                  ? `${perimetre.length} ligne(s) · ${nbLots} lot(s)`
                  : perimetre.length > 0
                    ? `${perimetre.length} ligne(s)`
                    : "Aucun périmètre"
              }
            />
            <Cellule label="Descriptif" value={operation.programmation.nature} />
            <Cellule label="Corps d'état" value={operation.programmation.corps_etat} />
            <Cellule
              label="Ligne budgétaire"
              value={operation.programmation.ligne.ligne_budget ?? null}
            />
            <Cellule label="Chargé de clientèle" value={operation.programmation.cc} />
          </div>
        </Bloc>

        {/* ── B. PROGRAMMATION ──────────────────────────────────────────────── */}
        <Bloc titre="B · Programmation" icone={CalendarRange}>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {PSP_ANNEES.map((a) => {
              const montant = montantParAnnee.get(a) ?? 0;
              return (
                <div
                  key={a}
                  className={cn(
                    "rounded-lg border p-2",
                    montant > 0 ? "border-primary/40 bg-primary/5" : "border-dashed bg-muted/30",
                  )}
                >
                  <p className="text-[9px] font-black uppercase text-muted-foreground">{a}</p>
                  <p
                    className={cn(
                      "tabnum text-[11px]",
                      montant > 0 ? "font-bold" : "text-muted-foreground/60",
                    )}
                  >
                    {montant > 0 ? money0(montant) : "—"}
                  </p>
                </div>
              );
            })}
            <div className="rounded-lg border border-primary bg-primary/10 p-2">
              <p className="text-[9px] font-black uppercase text-muted-foreground">Total</p>
              <p className="tabnum text-[11px] font-black text-primary">
                {money0(operation.programmation.montant_total)}
              </p>
            </div>
          </div>
          <p className="mt-1.5 text-[9px] text-muted-foreground">
            Une opération peut être programmée sur plusieurs années — une seule psp_ligne.
          </p>
        </Bloc>

        {/* ── C. CONSULTATION ───────────────────────────────────────────────── */}
        <Bloc titre="C · Consultation / Devis" icone={Building2}>
          <div className="space-y-1.5">
            <p className="text-[10px]">
              Statut : <Badge className="ml-1">{operation.consultation.statut_label}</Badge>
            </p>
            {operation.consultation.entreprises.length === 0 ? (
              <p className="text-[10px] text-muted-foreground">Aucune demande / aucun devis.</p>
            ) : (
              <ul className="space-y-1">
                {operation.consultation.entreprises.map((e) => (
                  <li
                    key={e.fournisseur_id ?? e.entreprise}
                    className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded border border-dashed px-2 py-1 text-[10px]"
                  >
                    <span className="font-semibold">{libelleEntreprise(e.entreprise, null)}</span>
                    <span>{e.statut_devis ?? "—"}</span>
                    {e.montant != null ? <span className="tabnum">{money0(e.montant)}</span> : null}
                    {e.date_demande ? (
                      <span className="text-muted-foreground">
                        demande : {e.date_demande.slice(0, 10)}
                      </span>
                    ) : null}
                    {e.relance_necessaire ? (
                      <Badge className="bg-amber-100 text-amber-800">Relance nécessaire</Badge>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Bloc>

        {/* ── D. SUIVI (réutilise PspSuiviApercu — états réels distincts) ──── */}
        <Bloc titre="D · Suivi — états réels (distincts)" icone={Archive}>
          <PspSuiviApercu pspLigneId={operation.identite.id} />
        </Bloc>
      </div>
    </div>
  );
}
