import { useEffect, useMemo, useState } from "react";
import { MapPin, Wand2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";

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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { money0 } from "@/lib/formats";
import {
  PSP_ANNEES,
  type PspAnnee,
  type PspCategorie,
  type PspOperation,
  type SaisieOperation,
} from "@/lib/psp.prep";
import { resoudreTranche, type ReferencePatrimoine } from "@/lib/psp.prep.data";
import { categorieDepuisCorpsEtat } from "@/lib/psp.prep.v7";
import { getCorpsEtats } from "@/lib/psp.prep.supabase.functions";

/** Chargé d'opération FIXE pour la programmation — jamais saisi. */
const CHARGE_OPERATION = "HCHEDLY";

const saisieVide = (): SaisieOperation => ({
  tranche: "",
  categorie: "GT",
  charge_clientele: "",
  charge_operation: CHARGE_OPERATION,
  corps_etat: "",
  adresse: "",
  ville: "",
  nature_travaux: "",
  annee: 2027,
  programme: [0, 0, 0, 0, 0],
  remarques: null,
});

const saisieDepuisOperation = (op: PspOperation): SaisieOperation => ({
  tranche: op.tranche,
  categorie: op.categorie,
  charge_clientele: op.charge_clientele,
  charge_operation: CHARGE_OPERATION,
  corps_etat: op.corps_etat,
  adresse: op.adresse,
  ville: op.ville,
  nature_travaux: op.nature_travaux,
  annee: op.annee,
  programme: PSP_ANNEES.map((a) => op.programme[String(a)] ?? 0),
  remarques: op.remarques,
});

/**
 * Formulaire d'ajout / modification d'opération (V7.1).
 * Corps d'état = sélection avec recherche → catégorie automatique (jamais
 * saisie). Ch. Op. = HCHEDLY fixe. La nature des travaux dispose d'une zone
 * large. Les montants 2027-2031 et les remarques restent modifiables.
 */
export default function PspOperationForm({
  open,
  mode,
  operation,
  reference,
  onSave,
  onClose,
}: {
  open: boolean;
  mode: "ajout" | "modification";
  operation: PspOperation | null;
  reference: ReferencePatrimoine | null;
  onSave: (saisie: SaisieOperation) => void;
  onClose: () => void;
}) {
  const corpsEtatsFn = useServerFn(getCorpsEtats);
  const [saisie, setSaisie] = useState<SaisieOperation>(saisieVide());
  const [sugCorps, setSugCorps] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setSaisie(
      mode === "modification" && operation ? saisieDepuisOperation(operation) : saisieVide(),
    );
  }, [open, mode, operation]);

  const referenceTranche = useMemo(
    () => (saisie.tranche ? resoudreTranche(reference, saisie.tranche) : null),
    [saisie.tranche, reference],
  );

  const total = useMemo(
    () => PSP_ANNEES.reduce((s, a, i) => s + (Number(saisie.programme[i]) || 0), 0),
    [saisie.programme],
  );

  /** Catégorie dérivée du corps d'état — jamais saisie manuellement. */
  const categorie: PspCategorie = categorieDepuisCorpsEtat(saisie.corps_etat);

  // Recherche progressive des corps d'état.
  useEffect(() => {
    if (saisie.corps_etat.trim().length < 2) {
      setSugCorps([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const r = (await corpsEtatsFn({ data: { q: saisie.corps_etat } })) ?? [];
        setSugCorps(r as string[]);
      } catch {
        setSugCorps([]);
      }
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saisie.corps_etat]);

  const changerTranche = (valeur: string) => {
    const tr = valeur.trim().toUpperCase();
    setSaisie((prev) => ({ ...prev, tranche: tr }));
    const ref = reference ? reference.tranches.get(tr) : undefined;
    if (ref) {
      setSaisie((prev) => ({
        ...prev,
        tranche: tr,
        charge_clientele: ref.charge_clientele ?? prev.charge_clientele,
        adresse: ref.adresse_reference ?? prev.adresse,
        ville: ref.ville ?? prev.ville,
      }));
    }
  };

  const enregistrer = () => {
    onSave({
      ...saisie,
      tranche: saisie.tranche.trim().toUpperCase(),
      categorie,
      charge_operation: CHARGE_OPERATION,
      corps_etat: saisie.corps_etat.trim(),
      nature_travaux: saisie.nature_travaux.trim(),
    });
    onClose();
  };

  const valide = saisie.tranche.trim() !== "" && saisie.nature_travaux.trim() !== "";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] w-[min(92vw,720px)] gap-0 p-0 sm:max-w-[720px]">
        <div className="max-h-[calc(90vh-4rem)] overflow-y-auto p-5">
          <DialogHeader>
            <DialogTitle>
              {mode === "ajout" ? "Ajouter une opération" : "Modifier l'opération"}
            </DialogTitle>
            <DialogDescription>
              Saisie persistée (brouillon Supabase). TR prioritaire : CC / adresse / ville complétés
              depuis la référence réelle PAT S11. Corps d'état → catégorie automatique.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="space-y-1">
                <Label
                  htmlFor="tr"
                  className="text-[10px] font-black uppercase tracking-widest text-muted-foreground"
                >
                  TR *
                </Label>
                <Input
                  id="tr"
                  value={saisie.tranche}
                  onChange={(e) => changerTranche(e.target.value)}
                  placeholder="1976"
                  className="h-8 font-mono text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  C — catégorie (auto)
                </Label>
                <div className="flex h-8 items-center rounded-md border bg-surface px-2 font-mono text-xs font-black text-primary">
                  {categorie}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Année principale
                </Label>
                <Select
                  value={String(saisie.annee)}
                  onValueChange={(v) => setSaisie((p) => ({ ...p, annee: Number(v) as PspAnnee }))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PSP_ANNEES.map((a) => (
                      <SelectItem key={a} value={String(a)}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Chargé opération
                </Label>
                <Input
                  value={CHARGE_OPERATION}
                  readOnly
                  className="h-8 text-xs font-black uppercase"
                  title="Chargé d'opération fixe pour cette programmation"
                />
              </div>
            </div>

            {referenceTranche ? (
              <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-xs">
                <Wand2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <span>
                  Référence réelle — {referenceTranche.localite ?? "ville inconnue"} · sous-secteur{" "}
                  {referenceTranche.sous_secteur ?? "—"} · {referenceTranche.nb_logements ?? "—"}{" "}
                  logements
                </span>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Chargé clientèle *
                </Label>
                <Input
                  value={saisie.charge_clientele}
                  onChange={(e) =>
                    setSaisie((p) => ({ ...p, charge_clientele: e.target.value.toUpperCase() }))
                  }
                  placeholder="ALOTHORE"
                  className="h-8 text-xs uppercase"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Adresse
                </Label>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={saisie.adresse}
                    onChange={(e) => setSaisie((p) => ({ ...p, adresse: e.target.value }))}
                    placeholder="Adresse de référence (auto depuis TR)"
                    className="h-8 pl-8 text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Ville
                </Label>
                <Input
                  value={saisie.ville}
                  onChange={(e) => setSaisie((p) => ({ ...p, ville: e.target.value }))}
                  placeholder="VILLE"
                  className="h-8 text-xs uppercase"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Corps d'état (recherche) → <span className="text-primary">{categorie}</span>
                </Label>
                <div className="relative">
                  <Input
                    value={saisie.corps_etat}
                    onChange={(e) => setSaisie((p) => ({ ...p, corps_etat: e.target.value }))}
                    placeholder="elec… → (e) Électricité"
                    className="h-8 text-xs"
                  />
                  {sugCorps.length > 0 ? (
                    <div className="absolute z-30 mt-1 max-h-40 w-full overflow-auto rounded-lg border bg-popover p-1 shadow-lg">
                      {sugCorps.map((c) => (
                        <button
                          key={c}
                          type="button"
                          className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-accent"
                          onClick={() => setSaisie((p) => ({ ...p, corps_etat: c }))}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <p className="text-[9px] text-muted-foreground">
                  Sélection avec recherche — la catégorie GE/GT/CP est recalculée automatiquement.
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Nature des travaux *
              </Label>
              <Textarea
                value={saisie.nature_travaux}
                onChange={(e) => setSaisie((p) => ({ ...p, nature_travaux: e.target.value }))}
                placeholder="Description métier des travaux (zone large)…"
                rows={3}
                className="text-xs"
              />
            </div>

            <div>
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Montants programmés 2027-2031 (€)
              </Label>
              <div className="mt-1 grid grid-cols-5 gap-1.5">
                {PSP_ANNEES.map((a, i) => (
                  <div key={a} className="space-y-1">
                    <span className="block text-center font-mono text-[10px] font-black text-muted-foreground">
                      {a}
                    </span>
                    <Input
                      type="number"
                      min={0}
                      step={1000}
                      value={Number(saisie.programme[i]) || ""}
                      onChange={(e) =>
                        setSaisie((p) => {
                          const programme = [...p.programme];
                          programme[i] = Math.max(0, Number(e.target.value) || 0);
                          return { ...p, programme };
                        })
                      }
                      className="h-8 text-center text-xs tabular-nums"
                    />
                  </div>
                ))}
              </div>
              <p className="tabnum mt-1.5 text-right text-xs font-black text-primary">
                Total : {money0(total)}
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Remarques
              </Label>
              <Textarea
                value={saisie.remarques ?? ""}
                onChange={(e) => setSaisie((p) => ({ ...p, remarques: e.target.value || null }))}
                rows={2}
                className="text-xs"
                placeholder="Observations libres (persistées dans psp_lignes.remarques)"
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Annuler
            </Button>
            <Button size="sm" disabled={!valide} onClick={enregistrer}>
              {mode === "ajout" ? "Ajouter l'opération" : "Enregistrer les modifications"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
