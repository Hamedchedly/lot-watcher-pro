/**
 * V7 — Dialog « Gérer les enveloppes » : montant alloué GE/GT/CP pour chaque
 * année 2027-2031. Sauvegarde via savePspEnveloppes (upsert). BUDGET_SOURCE reste
 * MOCK tant que la dotation officielle n'est pas définie.
 */
import { useState } from "react";

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
import { PSP_ANNEES, type PspAnnee } from "@/lib/psp.prep";
import type { EnveloppeMap } from "@/components/preparation-psp/PspCockpitV7";

const CATEGORIES = ["GE", "GT", "CP"] as const;

export default function PspEnveloppesDialog({
  open,
  onClose,
  enveloppes,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  enveloppes: EnveloppeMap;
  onSave: (map: EnveloppeMap) => Promise<void>;
}) {
  const [valeurs, setValeurs] = useState<EnveloppeMap>(enveloppes);
  const [saving, setSaving] = useState(false);

  // Ré-initialise l'état local à l'ouverture.
  const handleOpenChange = (o: boolean) => {
    if (o) setValeurs({ ...enveloppes });
    if (!o) onClose();
  };

  const setMontant = (annee: PspAnnee, cat: string, value: string) => {
    const n = Number(value.replace(/[^\d]/g, "")) || 0;
    setValeurs((prev) => ({ ...prev, [`${annee}|${cat}`]: n }));
  };

  const enregistrer = async () => {
    setSaving(true);
    try {
      await onSave(valeurs);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[min(94vw,720px)] sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>Gérer les enveloppes</DialogTitle>
          <DialogDescription>
            Enveloppes allouées GE / GT / CP par année. BUDGET_SOURCE = MOCK tant que la dotation
            officielle n'est pas définie — ces montants sont saisis manuellement.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border p-2 text-left text-xs font-black uppercase tracking-widest text-muted-foreground">
                  Catégorie
                </th>
                {PSP_ANNEES.map((a) => (
                  <th key={a} className="border p-2 text-center font-mono">
                    {a}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map((cat) => (
                <tr key={cat}>
                  <td className="border p-2 font-black">{cat}</td>
                  {PSP_ANNEES.map((a) => (
                    <td key={a} className="border p-1.5">
                      <Input
                        type="text"
                        inputMode="numeric"
                        className="tabnum h-8 text-right"
                        value={valeurs[`${a}|${cat}`] ?? 0}
                        onChange={(e) => setMontant(a, cat, e.target.value)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Annuler
          </Button>
          <Button size="sm" onClick={() => void enregistrer()} disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
