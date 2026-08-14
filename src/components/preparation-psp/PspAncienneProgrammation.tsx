import { Archive, ArrowRightLeft, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { money0 } from "@/lib/formats";
import { ANCIENNE_PROGRAMMATION } from "@/lib/psp.prep";

const simulé = (action: string) =>
  toast.info(`${action} — simulation V1, aucune écriture en base.`);

/**
 * Modal « Ancienne programmation » : affichage simulé des opérations issues de
 * la programmation 2026. Aucune action n'écrit en base (V1).
 */
export default function PspAncienneProgrammation({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[min(92vw,680px)] sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="size-4 text-muted-foreground" />
            Ancienne programmation
          </DialogTitle>
          <DialogDescription>
            Programmation 2026 — lignes non encore reportées. Actions visuelles (V1), aucune
            écriture en base.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[55vh] pr-2">
          <ul className="space-y-2">
            {ANCIENNE_PROGRAMMATION.map((ligne) => (
              <li key={ligne.id} className="rounded-lg border bg-surface/60 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{ligne.nature_travaux}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {ligne.adresse}, {ligne.ville} — Tranche {ligne.tranche}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-black">
                    <span className="text-muted-foreground">{ligne.annee} → </span>
                    <span className="tabnum">{money0(ligne.montant)}</span>
                  </p>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px]"
                    onClick={() => simulé("Conserver l'opération")}
                  >
                    <Archive className="size-3" />
                    Conserver
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px]"
                    onClick={() => simulé("Reporter l'opération")}
                  >
                    <ArrowRightLeft className="size-3" />
                    Reporter
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px]"
                    onClick={() => simulé("Modifier l'opération")}
                  >
                    <Pencil className="size-3" />
                    Modifier
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[11px] text-destructive hover:text-destructive"
                    onClick={() => simulé("Supprimer l'opération")}
                  >
                    <Trash2 className="size-3" />
                    Supprimer
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </ScrollArea>

        <div className="flex items-center justify-between gap-2 border-t pt-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            {ANCIENNE_PROGRAMMATION.length} opération{ANCIENNE_PROGRAMMATION.length > 1 ? "s" : ""}{" "}
            —{money0(ANCIENNE_PROGRAMMATION.reduce((s, l) => s + l.montant, 0))}
          </p>
          <Button variant="outline" size="sm" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
