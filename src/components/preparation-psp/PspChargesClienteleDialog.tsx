/**
 * V7.5 §8 — Consultation du référentiel chargé clientèle :
 * Sous-secteur | Chargé clientèle | ID | Actif.
 * Simple, lecture seule, aucune administration dans cette vue.
 */
import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getPspChargesClientele } from "@/lib/psp.prep.data.functions";
import type { ChargesClienteleReferentiel } from "@/lib/psp.prep.data";

export default function PspChargesClienteleDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const fetchFn = useServerFn(getPspChargesClientele);
  const [lignes, setLignes] = useState<ChargesClienteleReferentiel[]>([]);
  const [charge, setCharge] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCharge(true);
    void fetchFn().then((data) => {
      setLignes((data ?? []) as ChargesClienteleReferentiel[]);
      setCharge(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[min(92vw,560px)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="size-4 text-primary" />
            Référentiel chargé clientèle
          </DialogTitle>
          <DialogDescription>
            Sous-secteur → chargé de clientèle ACTUEL (source : `psp_charges_clientele`). Résolution
            : tranches.sous_secteur → CC (plus jamais déduit par fréquence des commandes).
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[50vh] overflow-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-[10px] font-black uppercase tracking-widest">
                  Sous-secteur
                </TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">
                  Chargé clientèle
                </TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">
                  ID personnel
                </TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">
                  Actif
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {charge ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-3 text-center text-xs text-muted-foreground">
                    Chargement…
                  </TableCell>
                </TableRow>
              ) : null}
              {!charge &&
                lignes.map((l) => (
                  <TableRow key={l.sous_secteur}>
                    <TableCell className="font-mono text-xs font-bold">{l.sous_secteur}</TableCell>
                    <TableCell className="text-xs">{l.charge_clientele}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {l.identifiant_personnel ?? "—"}
                    </TableCell>
                    <TableCell>
                      {l.actif ? (
                        <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
                          Oui
                        </Badge>
                      ) : (
                        <Badge className="border-red-200 bg-red-50 text-red-700">Non</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              {!charge && lignes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-3 text-center text-xs text-muted-foreground">
                    Aucune entrée — le référentiel n'est pas encore renseigné.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
