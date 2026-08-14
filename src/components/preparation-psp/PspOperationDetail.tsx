import { useEffect, useRef } from "react";
import { FileText, History, MapPin, Pencil } from "lucide-react";
import { toast } from "sonner";

import PspDevisPanel from "@/components/preparation-psp/PspDevisPanel";
import PspSecteurBadge from "@/components/preparation-psp/PspSecteurBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { money0 } from "@/lib/formats";
import { PSP_ANNEES, montantAnnee, totalOperation, type PspOperation } from "@/lib/psp.prep";

const simulé = (action: string) =>
  toast.info(`${action} — simulation V1, aucune écriture en base.`);

/**
 * Fiche opération (panneau latéral style Dialog) : tous les champs métier,
 * la programmation 2027-2031, les remarques et le bloc Devis.
 * Les boutons Modifier / Voir devis / Historique sont simulés en V1.
 */
export default function PspOperationDetail({
  operation,
  onClose,
}: {
  operation: PspOperation | null;
  onClose: () => void;
}) {
  const devisRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!operation) return undefined;
    const timer = window.setTimeout(
      () => devisRef.current?.scrollIntoView({ block: "nearest" }),
      150,
    );
    return () => window.clearTimeout(timer);
  }, [operation]);

  if (!operation) return null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] w-[min(92vw,640px)] gap-0 p-0 sm:max-w-[640px]">
        <ScrollArea className="max-h-[calc(90vh-4rem)]">
          <div className="p-5">
            <DialogHeader className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <div className="rounded-lg bg-primary/10 p-1.5 text-primary">
                    <FileText className="size-4" />
                  </div>
                  <DialogTitle className="text-base font-black leading-snug">
                    {operation.nature_travaux}
                  </DialogTitle>
                </div>
                {operation.reportee ? (
                  <Badge className="border-amber-200 bg-amber-50 text-amber-700">REPORTÉ</Badge>
                ) : null}
              </div>
              <DialogDescription className="flex items-center gap-1.5 text-xs">
                <MapPin className="size-3" />
                {operation.adresse}, {operation.ville} — Tranche {operation.tranche}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Champ label="Tranche" valeur={operation.tranche} />
              <Champ label="Chargé clientèle" valeur={operation.charge_clientele} large />
              <Champ label="Chargé opération" valeur={operation.charge_operation} />
              <div className="rounded-lg border bg-surface/60 p-2.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Secteur
                </p>
                <p className="mt-0.5">
                  <PspSecteurBadge secteur={operation.secteur} />
                </p>
              </div>
              <Champ label="Corps d'état" valeur={operation.corps_etat} large />
              <Champ label="Budget" valeur={money0(operation.budget)} accent />
            </div>

            <div className="mt-3 rounded-lg border bg-surface/60 p-2.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Programmation {PSP_ANNEES[0] ?? 2027} → {PSP_ANNEES[PSP_ANNEES.length - 1] ?? 2031}
              </p>
              <div className="mt-1.5 grid grid-cols-5 gap-1.5">
                {PSP_ANNEES.map((annee) => {
                  const montant = montantAnnee(operation, annee);
                  return (
                    <div
                      key={annee}
                      className="rounded-md border bg-card px-1.5 py-1.5 text-center"
                    >
                      <p className="font-mono text-[10px] font-black text-muted-foreground">
                        {annee}
                      </p>
                      <p className="tabnum text-[11px] font-bold">
                        {montant > 0 ? money0(montant) : "—"}
                      </p>
                    </div>
                  );
                })}
              </div>
              <p className="tabnum mt-1.5 text-right text-xs font-black text-primary">
                Total : {money0(totalOperation(operation))}
              </p>
            </div>

            {operation.remarques ? (
              <div className="mt-3 rounded-lg border bg-surface/60 p-2.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Remarques
                </p>
                <p className="mt-0.5 text-xs">{operation.remarques}</p>
              </div>
            ) : null}

            {operation.reportee && operation.ancienne_annee && operation.ancien_montant ? (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/60 p-2.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">
                  Ancienne programmation
                </p>
                <p className="mt-0.5 text-xs">
                  {operation.nature_travaux} — {operation.ancienne_annee} →{" "}
                  <span className="font-bold">{money0(operation.ancien_montant)}</span>
                </p>
              </div>
            ) : null}

            <div ref={devisRef} className="mt-3">
              <PspDevisPanel operation={operation} />
            </div>

            <DialogFooter className="mt-4 flex-col-reverse gap-2 sm:flex-row sm:justify-start">
              <Button variant="outline" size="sm" onClick={() => simulé("Modifier l'opération")}>
                <Pencil className="size-3.5" />
                Modifier
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  devisRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
                }
              >
                <FileText className="size-3.5" />
                Voir devis
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => simulé("Historique de l'opération")}
              >
                <History className="size-3.5" />
                Historique
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose}>
                Fermer
              </Button>
            </DialogFooter>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function Champ({
  label,
  valeur,
  accent,
  large,
}: {
  label: string;
  valeur: string;
  accent?: boolean;
  large?: boolean;
}) {
  return (
    <div
      className={
        large
          ? "rounded-lg border bg-surface/60 p-2.5 sm:col-span-2"
          : "rounded-lg border bg-surface/60 p-2.5"
      }
    >
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p
        className={
          accent ? "tabnum mt-0.5 text-sm font-black text-primary" : "mt-0.5 text-sm font-medium"
        }
      >
        {valeur}
      </p>
    </div>
  );
}
