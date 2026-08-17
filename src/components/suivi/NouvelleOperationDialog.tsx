/**
 * V8.3 §3/§21 — NOUVELLE OPÉRATION depuis le registre « Opérations » (/suivi).
 *
 * Réutilise STRICTEMENT le formulaire existant (PspOperationForm) — aucun
 * formulaire parallèle. Une seule entité opérationnelle : le choix « Origine »
 * (PSP / Hors PSP) pilote uniquement la partie programmation.
 *
 *  · Hors PSP : aucun montant / année / ligne budgétaire obligatoire
 *    (createPspOperationHorsPsp — programmation_id NULL, origine 'hors_psp') ;
 *  · PSP : comportement actuel conservé (createPspOperationComplete, dans la
 *    programmation officielle courante).
 */
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import PspOperationForm from "@/components/preparation-psp/PspOperationForm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PSP_ANNEES, type PspCategorie, type SaisieOperation } from "@/lib/psp.prep";
import {
  createPspOperationComplete,
  createPspOperationHorsPsp,
} from "@/lib/psp.prep.supabase.functions";

type PerimetrePayload = {
  niveau: "tranche" | "rue" | "adresse" | "lot";
  rue: string | null;
  numero: string | null;
  lotId: string | null;
};

const perimetresDe = (saisie: SaisieOperation): PerimetrePayload[] =>
  (saisie.perimetres ?? []).map((p) => ({
    niveau: p.niveau as "tranche" | "rue" | "adresse" | "lot",
    rue: p.rue ?? null,
    numero: p.numero ?? null,
    lotId: p.lot_id ?? null,
  }));

export default function NouvelleOperationDialog({
  open,
  onClose,
  programmationId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  /** Programmation officielle courante (null → origine PSP indisponible). */
  programmationId: string | null;
  onCreated: () => Promise<void>;
}) {
  const [origine, setOrigine] = useState<"psp" | "hors_psp">("hors_psp");
  const [saving, setSaving] = useState(false);
  const creerHorsPsp = useServerFn(createPspOperationHorsPsp);
  const creerPsp = useServerFn(createPspOperationComplete);

  const enregistrer = async (saisie: SaisieOperation) => {
    if (saving) return;
    setSaving(true);
    try {
      if (origine === "hors_psp") {
        await creerHorsPsp({
          data: {
            trancheCode: saisie.tranche,
            categorie: saisie.categorie as PspCategorie,
            corpsEtatCode: null,
            corpsEtat: saisie.corps_etat,
            natureTravaux: saisie.nature_travaux,
            remarques: saisie.remarques,
            statut: (saisie.statut ?? "a_definir") as
              "a_definir" | "attente_agence" | "attente_confirmation",
            priorite: (saisie.priorite ?? "normale") as
              "prioritaire" | "normale" | "non_prioritaire",
            perimetres: perimetresDe(saisie),
          },
        });
      } else {
        if (!programmationId) {
          throw new Error(
            "Aucune programmation officielle — créez d'abord la programmation dans Préparation PSP.",
          );
        }
        await creerPsp({
          data: {
            programmationId,
            trancheCode: saisie.tranche,
            categorie: saisie.categorie as PspCategorie,
            corpsEtatCode: null,
            corpsEtat: saisie.corps_etat,
            natureTravaux: saisie.nature_travaux,
            programme: Object.fromEntries(
              PSP_ANNEES.map((a, i) => [String(a), Number(saisie.programme[i]) || 0]),
            ),
            ligneBudget: null,
            remarques: saisie.remarques,
            statut: (saisie.statut ?? "a_definir") as
              "a_definir" | "attente_agence" | "attente_confirmation",
            priorite: (saisie.priorite ?? "normale") as
              "prioritaire" | "normale" | "non_prioritaire",
            origine: "preparation",
            perimetres: perimetresDe(saisie),
            devis: [],
          },
        });
      }
      await onCreated();
      toast.success("Opération créée.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur à la création de l'opération.");
    } finally {
      setSaving(false);
    }
  };

  const btnCls = (actif: boolean) =>
    `rounded-md border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
      actif
        ? "border-primary bg-primary/10 text-primary"
        : "border-muted bg-card text-muted-foreground hover:border-primary/40"
    }`;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-h-[92vh] w-[min(94vw,760px)] gap-0 p-0 sm:max-w-[760px]">
        <div className="max-h-[calc(92vh-4rem)] overflow-y-auto p-5">
          <DialogHeader>
            <DialogTitle>Nouvelle opération</DialogTitle>
            <DialogDescription>
              PSP et hors PSP = une SEULE entité opérationnelle. Hors PSP : aucune programmation /
              année / ligne budgétaire obligatoire.
            </DialogDescription>
          </DialogHeader>

          {/* V8.3 §3 — choix de l'origine */}
          <div className="mt-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Origine
            </p>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <button
                type="button"
                className={btnCls(origine === "hors_psp")}
                onClick={() => setOrigine("hors_psp")}
              >
                Hors PSP
                <span className="block text-[9px] font-normal text-muted-foreground">
                  Sans programmation ni budget
                </span>
              </button>
              <button
                type="button"
                className={btnCls(origine === "psp")}
                onClick={() => setOrigine("psp")}
              >
                PSP
                <span className="block text-[9px] font-normal text-muted-foreground">
                  Dans la programmation officielle
                </span>
              </button>
            </div>
            {origine === "psp" && !programmationId && (
              <p className="mt-1 text-[10px] font-bold text-amber-700">
                Aucune programmation officielle disponible — créez d'abord la programmation dans
                Préparation PSP.
              </p>
            )}
          </div>

          {/* Formulaire réutilisé (aucun parallèle). */}
          <div className="mt-3">
            <PspOperationForm
              open={open}
              mode="ajout"
              operation={null}
              reference={null}
              perimetresLigne={[]}
              lotsParId={null}
              horsPsp={origine === "hors_psp"}
              onSave={enregistrer}
              onClose={onClose}
              embedded
            />
          </div>

          {saving && (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> Enregistrement de l'opération…
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
