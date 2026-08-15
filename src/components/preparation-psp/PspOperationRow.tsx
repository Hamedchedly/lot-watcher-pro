import { Building2, Pencil, Trash2 } from "lucide-react";

import PspSecteurBadge from "@/components/preparation-psp/PspSecteurBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { money0 } from "@/lib/formats";
import { PSP_ANNEES, montantAnnee, totalOperation, type PspOperation } from "@/lib/psp.prep";
import {
  PRIORITE_LABELS,
  STATUT_LABELS,
  libelleAdressePerimetre,
  type LotInfo,
  type PerimetreLigne,
} from "@/lib/psp.prep.v7";
import { cn } from "@/lib/utils";

const STATUT_STYLES: Record<string, string> = {
  a_definir: "border-amber-200 bg-amber-50 text-amber-800",
  attente_agence: "border-blue-200 bg-blue-50 text-blue-800",
  attente_confirmation: "border-violet-200 bg-violet-50 text-violet-800",
};
const PRIORITE_STYLES: Record<string, string> = {
  prioritaire: "border-red-200 bg-red-50 text-red-800",
  normale: "border-slate-200 bg-slate-100 text-slate-700",
  non_prioritaire: "border-border bg-muted text-muted-foreground",
};

/**
 * Ligne d'opération du tableau — cliquable (ouvre la fiche opération).
 * Colonnes V7.1 : TR, CC, Adresse / périmètre réel, Corps d'état, Catégorie,
 * Nature travaux, 2027-2031, Total, Devis, Statut, Priorité, Actions.
 */
export default function PspOperationRow({
  op,
  perimetres,
  lotsParId,
  onOpen,
  onModifier,
  onSupprimer,
}: {
  op: PspOperation;
  perimetres: PerimetreLigne[];
  lotsParId: Map<string, LotInfo>;
  onOpen: (op: PspOperation) => void;
  onModifier: (op: PspOperation) => void;
  onSupprimer: (id: string) => void;
}) {
  const adresse = libelleAdressePerimetre(perimetres, lotsParId, {
    adresse: op.adresse,
    ville: op.ville,
  });
  const statut = op.statut ?? "a_definir";
  const priorite = op.priorite ?? "normale";
  const nbDevis = op.devis.length;

  return (
    <TableRow
      className="cursor-pointer transition-colors hover:bg-primary/5"
      onClick={() => onOpen(op)}
      title={`Ouvrir la fiche — ${op.nature_travaux}`}
    >
      <TableCell className="py-2 font-mono text-xs font-semibold">{op.tranche}</TableCell>
      <TableCell className="py-2 text-xs font-medium">{op.charge_clientele}</TableCell>
      <TableCell className="max-w-[220px] py-2">
        <span className="block truncate text-xs" title={adresse}>
          {adresse}
        </span>
      </TableCell>
      <TableCell className="max-w-[160px] py-2">
        <span className="block truncate text-xs" title={op.corps_etat}>
          {op.corps_etat || "—"}
        </span>
      </TableCell>
      <TableCell className="py-2">
        <PspSecteurBadge categorie={op.categorie} />
      </TableCell>
      <TableCell className="max-w-[240px] py-2">
        <span className="flex items-center gap-1.5">
          <span className="block truncate text-xs font-medium" title={op.nature_travaux}>
            {op.nature_travaux}
          </span>
          {op.reportee ? (
            <Badge className="shrink-0 border-amber-200 bg-amber-50 px-1.5 py-0 text-[9px] font-black text-amber-700">
              REPORTÉ{op.ancienne_annee ? ` DE ${op.ancienne_annee}` : ""}
            </Badge>
          ) : null}
        </span>
      </TableCell>
      {PSP_ANNEES.map((annee) => {
        const montant = montantAnnee(op, annee);
        return (
          <TableCell key={annee} className="py-2 text-right">
            <span
              className={
                montant > 0
                  ? "tabnum text-xs font-semibold text-foreground"
                  : "text-xs text-muted-foreground/40"
              }
            >
              {montant > 0 ? money0(montant) : "—"}
            </span>
          </TableCell>
        );
      })}
      <TableCell className="py-2 text-right">
        <span className="tabnum text-xs font-black">{money0(totalOperation(op))}</span>
      </TableCell>
      <TableCell className="py-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 text-[11px] font-bold",
            nbDevis > 0 ? "text-emerald-700" : "text-muted-foreground",
          )}
        >
          <Building2 className="size-3" />
          {nbDevis > 0 ? `☑ Oui (${nbDevis})` : "☐ Non"}
        </span>
      </TableCell>
      <TableCell className="py-2">
        <Badge className={cn("font-bold", STATUT_STYLES[statut] ?? STATUT_STYLES["a_definir"])}>
          {STATUT_LABELS[statut] ?? statut}
        </Badge>
      </TableCell>
      <TableCell className="py-2">
        <Badge className={cn("font-bold", PRIORITE_STYLES[priorite] ?? PRIORITE_STYLES["normale"])}>
          {PRIORITE_LABELS[priorite] ?? priorite}
        </Badge>
      </TableCell>
      <TableCell className="py-2" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-primary"
            title="Modifier"
            onClick={() => onModifier(op)}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-destructive"
            title="Supprimer"
            onClick={() => onSupprimer(op.id)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
