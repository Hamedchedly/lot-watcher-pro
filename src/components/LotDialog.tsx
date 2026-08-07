import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatutBadge } from "@/components/StatutBadge";
import { STATUT_LABELS, uid, type Lot, type StatutTravaux, type Travail } from "@/lib/lots";

const emptyLot = (): Lot => ({
  id: uid(),
  tranche: "",
  copro: "",
  batiment: "",
  entree: "",
  numeroLot: "",
  designation: "",
  travaux: [],
});

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lot: Lot | null;
  onSave: (lot: Lot) => void;
  onDelete?: (id: string) => void;
};

export function LotDialog({ open, onOpenChange, lot, onSave, onDelete }: Props) {
  const [draft, setDraft] = useState<Lot>(emptyLot);

  useEffect(() => {
    if (open) setDraft(lot ? structuredClone(lot) : emptyLot());
  }, [open, lot]);

  const set = <K extends keyof Lot>(key: K, value: Lot[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const setTravail = (id: string, patch: Partial<Travail>) =>
    setDraft((d) => ({
      ...d,
      travaux: d.travaux.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));

  const addTravail = () =>
    setDraft((d) => ({
      ...d,
      travaux: [
        ...d.travaux,
        { id: uid(), libelle: "", statut: "a_prevoir", date: "", cout: 0, note: "" },
      ],
    }));

  const removeTravail = (id: string) =>
    setDraft((d) => ({ ...d, travaux: d.travaux.filter((t) => t.id !== id) }));

  const canSave = draft.numeroLot.trim() !== "" && draft.tranche.trim() !== "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{lot ? `Lot ${lot.numeroLot}` : "Nouveau lot"}</DialogTitle>
          <DialogDescription>
            Identification du lot et suivi des travaux réalisés ou à venir.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Tranche" value={draft.tranche} onChange={(v) => set("tranche", v)} placeholder="T1" />
          <Field label="Copropriété" value={draft.copro} onChange={(v) => set("copro", v)} placeholder="COPRO-014" />
          <Field label="Bâtiment" value={draft.batiment} onChange={(v) => set("batiment", v)} placeholder="A" />
          <Field label="Entrée" value={draft.entree} onChange={(v) => set("entree", v)} placeholder="E1" />
          <Field label="N° de lot" value={draft.numeroLot} onChange={(v) => set("numeroLot", v)} placeholder="0101" />
          <Field
            label="Désignation"
            value={draft.designation}
            onChange={(v) => set("designation", v)}
            placeholder="Appartement T3"
          />
        </div>

        <div className="mt-2 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Travaux ({draft.travaux.length})</h3>
            <Button type="button" variant="outline" size="sm" onClick={addTravail}>
              <Plus className="size-4" /> Ajouter
            </Button>
          </div>

          {draft.travaux.length === 0 ? (
            <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
              Aucun travail enregistré pour ce lot.
            </p>
          ) : (
            draft.travaux.map((t) => (
              <div key={t.id} className="space-y-3 rounded-lg border bg-surface p-3">
                <div className="flex items-start gap-2">
                  <Input
                    value={t.libelle}
                    placeholder="Intitulé du travail"
                    onChange={(e) => setTravail(t.id, { libelle: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Supprimer ce travail"
                    onClick={() => removeTravail(t.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Statut</Label>
                    <Select
                      value={t.statut}
                      onValueChange={(v) => setTravail(t.id, { statut: v as StatutTravaux })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(STATUT_LABELS) as StatutTravaux[]).map((s) => (
                          <SelectItem key={s} value={s}>
                            {STATUT_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Date</Label>
                    <Input
                      type="date"
                      value={t.date}
                      onChange={(e) => setTravail(t.id, { date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Montant (€)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={t.cout}
                      onChange={(e) => setTravail(t.id, { cout: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <Textarea
                  rows={2}
                  placeholder="Note interne"
                  value={t.note}
                  onChange={(e) => setTravail(t.id, { note: e.target.value })}
                />
                <StatutBadge statut={t.statut} />
              </div>
            ))
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {lot && onDelete ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                onDelete(lot.id);
                onOpenChange(false);
              }}
            >
              Supprimer le lot
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button
              type="button"
              disabled={!canSave}
              onClick={() => {
                onSave(draft);
                onOpenChange(false);
              }}
            >
              Enregistrer
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
