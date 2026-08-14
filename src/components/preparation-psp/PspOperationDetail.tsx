import { useEffect, useRef, useState } from "react";
import { ArrowRight, FileText, History, MapPin, Pencil, Trash2 } from "lucide-react";

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
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { money0 } from "@/lib/formats";
import {
  PSP_ANNEES,
  montantAnnee,
  totalOperation,
  type DeplacementMemo,
  type PspAnnee,
  type PspOperation,
} from "@/lib/psp.prep";

/**
 * Fiche opération (panneau latéral style Dialog) : tous les champs métier,
 * la programmation 2027-2031, le bloc Devis (mock), le déplacement d'année et
 * la mémoire locale des mouvements. Modifier / Déplacer / Supprimer restent
 * LOCAUX — aucune écriture Supabase.
 */
export default function PspOperationDetail({
  operation,
  deplacements,
  onClose,
  onModifier,
  onDeplacer,
  onSupprimer,
}: {
  operation: PspOperation | null;
  deplacements: DeplacementMemo[];
  onClose: () => void;
  onModifier: (op: PspOperation) => void;
  onDeplacer: (id: string, cible: PspAnnee, motif: string | null) => void;
  onSupprimer: (id: string) => void;
}) {
  const devisRef = useRef<HTMLDivElement>(null);
  const mouvementsRef = useRef<HTMLDivElement>(null);
  const [cible, setCible] = useState<number>(2028);
  const [motif, setMotif] = useState<string>("");

  useEffect(() => {
    if (!operation) return undefined;
    setCible(operation.annee === 2027 ? 2028 : 2027);
    setMotif("");
    const timer = window.setTimeout(
      () => devisRef.current?.scrollIntoView({ block: "nearest" }),
      150,
    );
    return () => window.clearTimeout(timer);
  }, [operation]);

  if (!operation) return null;

  const mouvements = deplacements.filter((d) => d.operationId === operation.id);

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
                  C — catégorie budgétaire
                </p>
                <p className="mt-0.5">
                  <PspSecteurBadge categorie={operation.categorie} />
                </p>
              </div>
              <Champ label="Sous-secteur" valeur={operation.sous_secteur ?? "—"} />
              <Champ label="Budget" valeur={money0(operation.budget)} accent />
              <Champ label="Corps d'état" valeur={operation.corps_etat} large />
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
                      className={
                        annee === operation.annee
                          ? "rounded-md border border-primary/40 bg-primary/5 px-1.5 py-1.5 text-center"
                          : "rounded-md border bg-card px-1.5 py-1.5 text-center"
                      }
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

            <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-2.5">
              <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-primary">
                <ArrowRight className="size-3.5" />
                Déplacer l'opération
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {money0(montantAnnee(operation, operation.annee))} programmé en {operation.annee}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Select value={String(cible)} onValueChange={(v) => setCible(Number(v))}>
                  <SelectTrigger className="h-8 w-[110px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PSP_ANNEES.filter((a) => a !== operation.annee).map((a) => (
                      <SelectItem key={a} value={String(a)}>
                        Vers {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={motif}
                  onChange={(e) => setMotif(e.target.value)}
                  placeholder="Motif du déplacement (en mémoire)"
                  className="h-8 min-w-[180px] flex-1 text-xs"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() => onDeplacer(operation.id, cible as PspAnnee, motif.trim() || null)}
                >
                  <ArrowRight className="size-3.5" />
                  Déplacer
                </Button>
              </div>
            </div>

            {mouvements.length > 0 ? (
              <div ref={mouvementsRef} className="mt-3 rounded-lg border bg-surface/60 p-2.5">
                <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  <History className="size-3.5" />
                  Mouvements en mémoire
                </p>
                <ul className="mt-1 space-y-1">
                  {mouvements.map((d) => (
                    <li
                      key={d.id}
                      className="flex flex-wrap items-center justify-between gap-1 text-xs"
                    >
                      <span>
                        <span className="font-mono font-bold">{d.anneePrecedente}</span> →{" "}
                        <span className="font-mono font-bold">{d.anneeNouvelle}</span>
                        {d.motif ? (
                          <span className="text-muted-foreground"> · {d.motif}</span>
                        ) : null}
                      </span>
                      <span className="tabnum font-bold">{money0(d.montant)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div ref={devisRef} className="mt-3">
              <PspDevisPanel operation={operation} />
            </div>

            <DialogFooter className="mt-4 flex-col-reverse gap-2 sm:flex-row sm:justify-start">
              <Button variant="outline" size="sm" onClick={() => onModifier(operation)}>
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
                onClick={() =>
                  mouvementsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
                }
              >
                <History className="size-3.5" />
                Historique
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => {
                  onSupprimer(operation.id);
                  onClose();
                }}
              >
                <Trash2 className="size-3.5" />
                Supprimer
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
