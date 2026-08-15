/**
 * V7 — Ligne de saisie directe sous l'en-tête du tableau.
 * Recherche patrimoine (TR / ER / locataire / adresse), corps d'état → catégorie
 * automatique, montants par année (2027-2031). Validation → INSERT psp_lignes +
 * psp_ligne_patrimoine. Aucune donnée patrimoniale recopiée.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, Search, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PSP_ANNEES, type PspAnnee, type PspCategorie } from "@/lib/psp.prep";
import {
  createPspLigne,
  createPspPerimetres,
  getCorpsEtats,
  rechercherLotsV7,
  rechercherTranches,
} from "@/lib/psp.prep.supabase.functions";
import { categorieDepuisCorpsEtat } from "@/lib/psp.prep.v7";
import type { ReferencePatrimoine } from "@/lib/psp.prep.data";

type SuggestionTranche = { code: string; libelle: string | null; localite: string | null };
type SuggestionLot = {
  id: string;
  code_patrimoine: string;
  tranche_code: string;
  adresse: string | null;
  ville: string | null;
};

export default function PspQuickAddRow({
  programmationId,
  reference,
  onSaved,
  onCancel,
}: {
  programmationId: string;
  reference: ReferencePatrimoine | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const rechercheTranchesFn = useServerFn(rechercherTranches);
  const rechercheLotsFn = useServerFn(rechercherLotsV7);
  const corpsEtatsFn = useServerFn(getCorpsEtats);

  const [q, setQ] = useState("");
  const [sugTranches, setSugTranches] = useState<SuggestionTranche[]>([]);
  const [sugLots, setSugLots] = useState<SuggestionLot[]>([]);
  const [tranche, setTranche] = useState<string | null>(null);
  const [lot, setLot] = useState<SuggestionLot | null>(null);
  const [rue, setRue] = useState("");
  const [numero, setNumero] = useState("");
  const [corpsEtat, setCorpsEtat] = useState("");
  const [sugCorps, setSugCorps] = useState<string[]>([]);
  const [nature, setNature] = useState("");
  const [montants, setMontants] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const referenceTranche = tranche ? reference?.tranches.get(tranche) : undefined;
  const categorie: PspCategorie = categorieDepuisCorpsEtat(corpsEtat);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const valeur = q.trim();
    if (valeur.length < 2) {
      setSugTranches([]);
      setSugLots([]);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        if (/^\d/.test(valeur)) {
          const t = await rechercheTranchesFn({ data: { q: valeur } });
          setSugTranches((t ?? []) as SuggestionTranche[]);
        } else {
          setSugTranches([]);
        }
        const l = await rechercheLotsFn({ data: { q: valeur, tranche: tranche ?? undefined } });
        setSugLots((l ?? []) as SuggestionLot[]);
      } catch {
        // la recherche ne bloque jamais la saisie
      }
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, tranche]);
  useEffect(() => {
    if (corpsEtat.trim().length < 2) {
      setSugCorps([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const r = await corpsEtatsFn({ data: { q: corpsEtat } });
        setSugCorps((r ?? []) as string[]);
      } catch {
        setSugCorps([]);
      }
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [corpsEtat]);

  const choisirTranche = (code: string) => {
    setTranche(code);
    setLot(null);
    setRue("");
    setNumero("");
    setQ(`${code} — ${reference?.tranches.get(code)?.localite ?? ""}`.trim());
    setSugTranches([]);
  };

  const choisirLot = (l: SuggestionLot) => {
    setLot(l);
    setTranche(l.tranche_code);
    setRue("");
    setNumero("");
    setQ(`${l.code_patrimoine} — ${l.adresse ?? ""}`.trim());
    setSugLots([]);
  };

  const enregistrer = async () => {
    if (!tranche) return;
    setSaving(true);
    try {
      const programme: Record<string, number> = {};
      for (const a of PSP_ANNEES) programme[String(a)] = montants[String(a)] ?? 0;
      const ligne = await createPspLigne({
        data: {
          programmationId,
          trancheCode: tranche,
          categorie,
          corpsEtatCode: (corpsEtat.match(/\(([^)]+)\)/)?.[1] ?? null) as string | null,
          corpsEtat: corpsEtat || null,
          natureTravaux: nature || null,
          programme,
          ligneBudget: null,
          remarques: null,
          origine: "preparation",
        },
      });
      const perimetres: Array<{
        niveau: "tranche" | "rue" | "adresse" | "lot";
        rue?: string | null;
        numero?: string | null;
        lotId?: string | null;
      }> = [];
      if (lot) {
        perimetres.push({ niveau: "lot", lotId: lot.id });
      } else if (numero.trim() && rue.trim()) {
        perimetres.push({ niveau: "adresse", rue: rue.trim(), numero: numero.trim() });
      } else if (rue.trim()) {
        perimetres.push({ niveau: "rue", rue: rue.trim() });
      } else {
        perimetres.push({ niveau: "tranche" });
      }
      await createPspPerimetres({
        data: { pspLigneId: ligne.id, trancheCode: tranche, perimetres },
      });
      onSaved();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const total = useMemo(
    () => PSP_ANNEES.reduce((s, a) => s + (montants[String(a)] ?? 0), 0),
    [montants],
  );
  return (
    <div className="rounded-xl border border-primary/40 bg-surface/60 p-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[220px] flex-1">
          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Patrimoine (TR / ER / locataire / adresse)
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="1976 · ER.123 · DUPONT · CORNILLIOT…"
              className="pl-7"
            />
            {sugTranches.length > 0 || sugLots.length > 0 ? (
              <div className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-lg border bg-popover p-1 shadow-lg">
                {sugTranches.map((t) => (
                  <button
                    key={t.code}
                    className="flex w-full justify-between gap-2 rounded px-2 py-1 text-left text-xs hover:bg-accent"
                    onClick={() => choisirTranche(t.code)}
                  >
                    <span className="font-mono font-bold">{t.code}</span>
                    <span className="text-muted-foreground">{t.localite ?? t.libelle}</span>
                  </button>
                ))}
                {sugLots.map((l) => (
                  <button
                    key={l.id}
                    className="flex w-full justify-between gap-2 rounded px-2 py-1 text-left text-xs hover:bg-accent"
                    onClick={() => choisirLot(l)}
                  >
                    <span className="font-mono font-bold">{l.code_patrimoine}</span>
                    <span className="truncate text-muted-foreground">{l.adresse}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="w-32">
          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            TR
          </label>
          <Input value={tranche ?? ""} readOnly placeholder="—" />
          {referenceTranche ? (
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {referenceTranche.charge_clientele ?? "—"} · {referenceTranche.sous_secteur ?? ""}
            </p>
          ) : null}
        </div>

        <div className="w-40">
          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Rue
          </label>
          <Input
            value={rue}
            onChange={(e) => setRue(e.target.value)}
            placeholder="RUE…"
            disabled={!!lot}
          />
        </div>
        <div className="w-20">
          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            N°
          </label>
          <Input
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            placeholder="12"
            disabled={!!lot}
          />
        </div>

        <div className="w-48">
          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Corps d'état → <span className="font-black text-primary">{categorie}</span>
          </label>
          <div className="relative">
            <Input
              value={corpsEtat}
              onChange={(e) => setCorpsEtat(e.target.value)}
              placeholder="(u) Etanchéité…"
            />
            {sugCorps.length > 0 ? (
              <div className="absolute z-30 mt-1 max-h-40 w-full overflow-auto rounded-lg border bg-popover p-1 shadow-lg">
                {sugCorps.map((c) => (
                  <button
                    key={c}
                    className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-accent"
                    onClick={() => {
                      setCorpsEtat(c);
                      setSugCorps([]);
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex-1">
          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Nature travaux
          </label>
          <Input
            value={nature}
            onChange={(e) => setNature(e.target.value)}
            placeholder="Remplacement…"
          />
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {PSP_ANNEES.map((a: PspAnnee) => (
          <div key={a} className="w-24">
            <label className="text-[10px] font-mono font-black text-muted-foreground">{a}</label>
            <Input
              type="text"
              inputMode="numeric"
              className="tabnum h-8"
              value={montants[String(a)] ?? ""}
              onChange={(e) => {
                const n = Number(e.target.value.replace(/[^\d]/g, "")) || 0;
                setMontants((prev) => ({ ...prev, [String(a)]: n }));
              }}
              placeholder="0"
            />
          </div>
        ))}
        <div className="ml-auto flex items-center gap-1.5">
          <span className="tabnum text-xs font-bold text-muted-foreground">
            Total {total.toLocaleString("fr-FR")} €
          </span>
          <Button size="sm" onClick={() => void enregistrer()} disabled={!tranche || saving}>
            {saving ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Check className="size-3.5" />
            )}
            Enregistrer
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
            <X className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
