/**
 * V1 VISUELLE — Parcours de création d'une opération (MAQUETTE, aucune écriture).
 *
 * Présente visuellement le parcours de création en 7 étapes :
 *   1. sélectionner le patrimoine ; 2. descriptif ; 3. corps d'état ;
 *   4. ligne budgétaire ; 5. montants 2027-2031 ; 6. enregistrer ;
 *   7. préparer la consultation.
 *
 * Rien n'est persisté : le formulaire réel reste `PspOperationForm` (module
 * opérationnel /preparation-psp). Ce dialogue est UNIQUEMENT un aperçu UX.
 */
import { Check, MousePointerClick, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const ETAPES = [
  { titre: "Sélectionner le patrimoine", detail: "Recherche TR / adresse / lot" },
  { titre: "Renseigner le descriptif", detail: "Nature des travaux (texte large)" },
  { titre: "Choisir le corps d'état", detail: "Référentiel GE / GT / CP" },
  { titre: "Renseigner la ligne budgétaire", detail: "Ex. 525 · 551 · 561…" },
  { titre: "Saisir les montants 2027-2031", detail: "Une opération peut être pluriannuelle" },
  { titre: "Enregistrer", detail: "UNE psp_ligne — jamais un doublon" },
  { titre: "Préparer la consultation", detail: "Entreprises suggérées / devis" },
];

const EXEMPLE = [
  { annee: "2027", montant: "50 000" },
  { annee: "2028", montant: "6 000" },
  { annee: "2029", montant: "—" },
  { annee: "2030", montant: "3 000" },
  { annee: "2031", montant: "—" },
];

export default function PspV1CreationDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] w-[min(92vw,720px)] gap-0 overflow-y-auto p-0">
        <DialogHeader className="border-b p-4 pb-3">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <MousePointerClick className="size-4" />
            Ajouter une opération — parcours (aperçu V1)
          </DialogTitle>
          <DialogDescription>
            Maquette du parcours de création. Aucune donnée n'est enregistrée ici : le formulaire
            réel reste disponible dans le module opérationnel.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 p-4">
          {/* Étapes */}
          <ol className="space-y-1.5">
            {ETAPES.map((e, i) => (
              <li key={e.titre} className="flex items-start gap-2">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-black text-primary">
                  {i + 1}
                </span>
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-bold">
                    <Check className="size-3 text-emerald-600" />
                    {e.titre}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{e.detail}</p>
                </div>
              </li>
            ))}
          </ol>

          {/* Exemple visuel pluriannuel */}
          <div className="rounded-lg border bg-surface/60 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              <Wallet className="size-3.5" />
              Une seule opération — montants par année
            </p>
            <div className="grid grid-cols-5 gap-1.5">
              {EXEMPLE.map(({ annee, montant }) => (
                <div
                  key={annee}
                  className={
                    montant === "—"
                      ? "rounded border border-dashed bg-muted/30 p-1.5 text-center"
                      : "rounded border border-primary/40 bg-primary/5 p-1.5 text-center"
                  }
                >
                  <p className="text-[9px] font-black uppercase text-muted-foreground">{annee}</p>
                  <p
                    className={
                      montant === "—"
                        ? "text-[11px] text-muted-foreground/60"
                        : "tabnum text-[11px] font-bold"
                    }
                  >
                    {montant}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-1.5 text-[9px] text-muted-foreground">
              Exemple : 2027 = 50 000 € · 2028 = 6 000 € · 2029 non programmée · 2030 = 3 000 € ·
              2031 non programmée. Une opération = une psp_ligne.
            </p>
          </div>

          <div className="flex items-center justify-between gap-2 border-t pt-3">
            <Badge variant="outline" className="text-[9px]">
              Prototype — aucune écriture
            </Badge>
            <Button size="sm" onClick={onClose}>
              Compris
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
