import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import { money0 } from "@/lib/formats";
import { PSP_ANNEES, montantAnnee, totalOperation, type PspOperation } from "@/lib/psp.prep";
import PspSecteurBadge from "@/components/preparation-psp/PspSecteurBadge";

/**
 * Ligne d'opération du tableau — cliquable (ouvre la fiche opération).
 * Les colonnes années sont alignées sur les en-têtes pour une comparaison
 * rapide des montants d'une année à l'autre.
 */
export default function PspOperationRow({
  op,
  onOpen,
}: {
  op: PspOperation;
  onOpen: (op: PspOperation) => void;
}) {
  return (
    <TableRow
      className="cursor-pointer transition-colors hover:bg-primary/5"
      onClick={() => onOpen(op)}
      title={`Ouvrir la fiche — ${op.nature_travaux}`}
    >
      <TableCell className="py-2 font-mono text-xs font-bold text-muted-foreground">
        {op.annee}
      </TableCell>
      <TableCell className="py-2 font-mono text-xs font-semibold">{op.tranche}</TableCell>
      <TableCell className="py-2 text-xs font-medium">{op.charge_clientele}</TableCell>
      <TableCell className="py-2">
        <PspSecteurBadge secteur={op.secteur} />
      </TableCell>
      <TableCell className="py-2 font-mono text-[11px] text-muted-foreground">
        {op.corps_etat_code}
      </TableCell>
      <TableCell className="max-w-[220px] py-2">
        <span className="block truncate text-xs" title={op.corps_etat}>
          {op.corps_etat}
        </span>
      </TableCell>
      <TableCell className="max-w-[240px] py-2">
        <span className="block truncate text-xs" title={`${op.adresse}, ${op.ville}`}>
          {op.adresse}, {op.ville}
        </span>
      </TableCell>
      <TableCell className="max-w-[260px] py-2">
        <span className="flex items-center gap-1.5">
          <span className="block truncate text-xs font-medium" title={op.nature_travaux}>
            {op.nature_travaux}
          </span>
          {op.reportee ? (
            <Badge className="shrink-0 border-amber-200 bg-amber-50 px-1.5 py-0 text-[9px] font-black text-amber-700">
              REPORTÉ
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
    </TableRow>
  );
}
