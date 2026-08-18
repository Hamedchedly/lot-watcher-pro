/**
 * V8.6.1 §2 — NOUVELLE OPÉRATION HORS PSP (registre /suivi).
 *
 * Une opération PSP vient de la PRÉPARATION PSP (programmation de l'année N).
 * /suivi ne permet donc que la création manuelle d'une opération HORS PSP
 * (imprévue apparue en cours d'année, sans ligne budgétaire PSP).
 * Réutilise STRICTEMENT le formulaire existant (PspOperationForm) — aucun
 * formulaire parallèle. Une seule entité opérationnelle.
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
import { type PspCategorie, type SaisieOperation } from "@/lib/psp.prep";
import { createPspOperationHorsPsp } from "@/lib/psp.prep.supabase.functions";

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
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const creerHorsPsp = useServerFn(createPspOperationHorsPsp);

  const enregistrer = async (saisie: SaisieOperation) => {
    if (saving) return;
    setSaving(true);
    try {
      // V8.6.1 §2 — TOUJOURS hors PSP depuis /suivi (l'origine PSP vient de la
      // préparation). Aucun montant / année / ligne budgétaire obligatoire.
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
          priorite: (saisie.priorite ?? "normale") as "prioritaire" | "normale" | "non_prioritaire",
          perimetres: perimetresDe(saisie),
        },
      });
      await onCreated();
      toast.success("Opération hors PSP créée.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur à la création de l'opération.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-h-[92vh] w-[min(94vw,760px)] gap-0 p-0 sm:max-w-[760px]">
        <div className="max-h-[calc(92vh-4rem)] overflow-y-auto p-5">
          <DialogHeader>
            <DialogTitle>Nouvelle opération hors PSP</DialogTitle>
            <DialogDescription>
              V8.6.1 — une opération PSP vient de la PRÉPARATION PSP (programmation de l'année N) :
              elle n'est jamais créée manuellement ici. Cette création sert aux opérations imprévues
              apparues en cours d'année, sans ligne budgétaire PSP. Aucune programmation / année /
              ligne budgétaire obligatoire.
            </DialogDescription>
          </DialogHeader>

          {/* Formulaire réutilisé (aucun parallèle). */}
          <div className="mt-3">
            <PspOperationForm
              open={open}
              mode="ajout"
              operation={null}
              reference={null}
              perimetresLigne={[]}
              lotsParId={null}
              horsPsp
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
