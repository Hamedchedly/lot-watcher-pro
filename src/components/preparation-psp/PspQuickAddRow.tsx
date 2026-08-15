/**
 * V7.1 — Ligne de saisie directe TOUT EN BAS du tableau (aucun formulaire,
 * aucun overlay). Recherche patrimoine hiérarchique : TR → rues → numéros →
 * lots (multi-sélection, « toute la rue »), ER / locataire par recherche
 * globale. Corps d'état avec recherche → catégorie automatique. Ch. Op. =
 * HCHEDLY (fixe). Une ligne = UNE seule tranche (message explicite sinon).
 * Validation → INSERT psp_lignes + psp_ligne_patrimoine (+ devis éventuel).
 * Aucune donnée patrimoniale recopiée : seule la relation est persistée.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Loader2, Search, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";

import { Button } from "@/components/ui/button";
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
import { PSP_ANNEES, type PspAnnee, type PspCategorie } from "@/lib/psp.prep";
import {
  createPspDevis,
  createPspLigne,
  createPspPerimetres,
  getCorpsEtats,
  rechercherLotsAdresse,
  rechercherLotsV7,
  rechercherNumerosRue,
  rechercherRuesTranche,
  rechercherTranches,
} from "@/lib/psp.prep.supabase.functions";
import { PRIORITE_LABELS, STATUT_LABELS, categorieDepuisCorpsEtat } from "@/lib/psp.prep.v7";
import { entreeDe, rueDe } from "@/lib/adresses";
import type { ReferencePatrimoine } from "@/lib/psp.prep.data";

type SuggestionTranche = { code: string; libelle: string | null; localite: string | null };
type SuggestionLot = {
  id: string;
  code_patrimoine: string;
  tranche_code: string;
  adresse: string | null;
  ville: string | null;
  locataire_nom?: string | null;
};

const CHARGE_OPERATION = "HCHEDLY";

export default function PspQuickAddRow({
  programmationId,
  reference,
  onSaved,
  figee,
}: {
  programmationId: string;
  reference: ReferencePatrimoine | null;
  onSaved: () => void;
  figee: boolean;
}) {
  const rechercheTranchesFn = useServerFn(rechercherTranches);
  const rechercheLotsFn = useServerFn(rechercherLotsV7);
  const rechercheRuesFn = useServerFn(rechercherRuesTranche);
  const rechercheNumerosFn = useServerFn(rechercherNumerosRue);
  const rechercheLotsAdresseFn = useServerFn(rechercherLotsAdresse);
  const corpsEtatsFn = useServerFn(getCorpsEtats);

  const [q, setQ] = useState("");
  const [sugTranches, setSugTranches] = useState<SuggestionTranche[]>([]);
  const [sugLots, setSugLots] = useState<SuggestionLot[]>([]);
  const [tranche, setTranche] = useState<string | null>(null);
  const [cc, setCc] = useState("");
  const [alerteTranche, setAlerteTranche] = useState<string | null>(null);
  const [conflit, setConflit] = useState<string | null>(null);

  // Hiérarchie adresse (TR → rues → numéros → lots)
  const [qRue, setQRue] = useState("");
  const [rues, setRues] = useState<Array<{ rue: string; ville: string | null; nb_lots: number }>>(
    [],
  );
  const [rue, setRue] = useState<string | null>(null);
  const [numeros, setNumeros] = useState<string[]>([]);
  const [adresseChoisie, setAdresseChoisie] = useState<string | null>(null);
  const [lotsDeAdresse, setLotsDeAdresse] = useState<SuggestionLot[]>([]);
  const [lotsChoisis, setLotsChoisis] = useState<SuggestionLot[]>([]);

  const [corpsEtat, setCorpsEtat] = useState("");
  const [sugCorps, setSugCorps] = useState<string[]>([]);
  const [nature, setNature] = useState("");
  const [montants, setMontants] = useState<Record<string, number>>({});
  const [devisRecu, setDevisRecu] = useState<"non" | "oui">("non");
  const [devisEntreprise, setDevisEntreprise] = useState("");
  const [devisMontant, setDevisMontant] = useState("");
  const [statut, setStatut] = useState("a_definir");
  const [priorite, setPriorite] = useState("normale");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const referenceTranche = tranche ? reference?.tranches.get(tranche) : undefined;
  const categorie: PspCategorie = categorieDepuisCorpsEtat(corpsEtat);

  // ── Recherche globale : chiffres → TR ; ER… / nom → lots ──
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const valeur = q.trim();
    if (valeur.length < 2) {
      setSugTranches([]);
      setSugLots([]);
      setAlerteTranche(null);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        if (/^\d/.test(valeur)) {
          const t = (await rechercheTranchesFn({ data: { q: valeur } })) ?? [];
          setSugTranches(t as SuggestionTranche[]);
          setSugLots([]);
          setAlerteTranche(t.length === 0 ? `Tranche « ${valeur} » introuvable` : null);
        } else {
          setSugTranches([]);
          setAlerteTranche(null);
          const l =
            (await rechercheLotsFn({
              data: { q: valeur, tranche: tranche ?? undefined },
            })) ?? [];
          setSugLots(l as SuggestionLot[]);
        }
      } catch {
        // la recherche ne bloque jamais la saisie
      }
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, tranche]);

  // ── Rues de la tranche sélectionnée ──
  useEffect(() => {
    if (!tranche) {
      setRues([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const r = (await rechercheRuesFn({ data: { tranche, q: qRue } })) ?? [];
        setRues(r as Array<{ rue: string; ville: string | null; nb_lots: number }>);
      } catch {
        setRues([]);
      }
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tranche, qRue]);

  // ── Corps d'état (sélection avec recherche — jamais de saisie libre) ──
  useEffect(() => {
    if (corpsEtat.trim().length < 2) {
      setSugCorps([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const r = (await corpsEtatsFn({ data: { q: corpsEtat } })) ?? [];
        setSugCorps(r as string[]);
      } catch {
        setSugCorps([]);
      }
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [corpsEtat]);

  /** Sélection d'une tranche via la recherche progressive. */
  const choisirTranche = (code: string) => {
    setTranche(code);
    setCc(reference?.tranches.get(code)?.charge_clientele ?? "");
    setQ("");
    setSugTranches([]);
    setAlerteTranche(null);
    setConflit(null);
    // Réinitialise la hiérarchie adresse.
    setRue(null);
    setNumeros([]);
    setAdresseChoisie(null);
    setLotsDeAdresse([]);
    setLotsChoisis([]);
  };

  /** Sélection d'un lot via la recherche globale (ER / locataire / adresse). */
  const choisirLotGlobal = (l: SuggestionLot) => {
    if (tranche && l.tranche_code !== tranche) {
      setConflit(
        `Ce lot (${l.code_patrimoine}) appartient à la tranche ${l.tranche_code} — une ligne ne peut couvrir qu'une seule tranche.`,
      );
      return;
    }
    setTranche(l.tranche_code);
    setCc(reference?.tranches.get(l.tranche_code)?.charge_clientele ?? "");
    setConflit(null);
    if (!lotsChoisis.some((x) => x.id === l.id)) setLotsChoisis((prev) => [...prev, l]);
    setQ("");
    setSugLots([]);
    setRue(rueDe(l.adresse));
    setAdresseChoisie(entreeDe(l.adresse));
  };

  const choisirRue = (r: string) => {
    setRue(r);
    setAdresseChoisie(null);
    setLotsDeAdresse([]);
    setLotsChoisis([]);
    void rechercheNumerosFn({ data: { tranche: tranche ?? "", rue: r } }).then((n) =>
      setNumeros((n ?? []) as string[]),
    );
  };

  const choisirNumero = async (entree: string) => {
    setAdresseChoisie(entree);
    setLotsChoisis([]);
    const l =
      (await rechercheLotsAdresseFn({
        data: { tranche: tranche ?? "", adresse: entree },
      })) ?? [];
    setLotsDeAdresse(l as SuggestionLot[]);
  };

  const basculerLot = (l: SuggestionLot) => {
    setLotsChoisis((prev) =>
      prev.some((x) => x.id === l.id) ? prev.filter((x) => x.id !== l.id) : [...prev, l],
    );
  };

  const retirerLot = (id: string) => setLotsChoisis((prev) => prev.filter((x) => x.id !== id));

  /** Extrait le numéro d'une entrée : « 25-27 RUE DE RUZE » → « 25-27 ». */
  const numeroDeEntree = (entree: string): string => {
    const m = entree.match(/^([\d.\-/]+)\s*(BIS|TER|QUATER)?\s/i);
    return m ? `${m[1]?.trim() ?? ""}${m[2] ? ` ${m[2].toUpperCase()}` : ""}` : entree;
  };

  const enregistrer = async () => {
    if (figee || !tranche) return;
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
          remarques: notes.trim() || null,
          statut: statut as "a_definir" | "attente_agence" | "attente_confirmation",
          priorite: priorite as "prioritaire" | "normale" | "non_prioritaire",
          origine: "preparation",
        },
      });

      // Périmètre patrimonial — une seule tranche, niveaux structurés.
      const perimetres: Array<{
        niveau: "tranche" | "rue" | "adresse" | "lot";
        rue?: string | null;
        numero?: string | null;
        lotId?: string | null;
      }> = [];
      if (lotsChoisis.length > 0) {
        for (const l of lotsChoisis) perimetres.push({ niveau: "lot", lotId: l.id });
      } else if (adresseChoisie && rue) {
        perimetres.push({ niveau: "adresse", rue, numero: numeroDeEntree(adresseChoisie) });
      } else if (rue) {
        perimetres.push({ niveau: "rue", rue });
      } else {
        perimetres.push({ niveau: "tranche" });
      }
      await createPspPerimetres({
        data: { pspLigneId: ligne.id, trancheCode: tranche, perimetres },
      });

      // Devis éventuel.
      if (devisRecu === "oui" && devisEntreprise.trim()) {
        await createPspDevis({
          data: {
            pspLigneId: ligne.id,
            entreprise: devisEntreprise.trim(),
            dateDevis: null,
            montant: Number(devisMontant) || 0,
            statut: "recu",
            commentaire: null,
            documentReference: null,
          },
        });
      }
      onSaved();
    } catch (e) {
      // onSaved n'est pas appelé : message explicite, l'utilisateur peut corriger.
      console.error("Échec de la saisie directe :", e);
      setConflit(`Enregistrement impossible : ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const total = useMemo(
    () => PSP_ANNEES.reduce((s, a) => s + (montants[String(a)] ?? 0), 0),
    [montants],
  );

  return (
    <div className="rounded-lg border border-primary/40 bg-surface/60 p-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <p className="mr-1 flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          <Search className="size-3" />
          Nouvelle opération
        </p>

        {/* TR — recherche progressive */}
        <div className="min-w-[140px] flex-1">
          <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
            TR (chiffres) · ER · locataire
          </Label>
          <div className="relative">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={
                tranche ? `Tranche ${tranche} — ER / locataire…` : "1976 · ER.123 · DUPONT…"
              }
              className="h-8 pl-6 text-xs"
            />
            <Search className="pointer-events-none absolute left-2 top-2 size-3 text-muted-foreground" />
            {sugTranches.length > 0 || sugLots.length > 0 ? (
              <div className="absolute z-30 mt-1 max-h-48 w-full overflow-auto rounded-lg border bg-popover p-1 shadow-lg">
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
                    onClick={() => choisirLotGlobal(l)}
                  >
                    <span className="font-mono font-bold">{l.code_patrimoine}</span>
                    <span className="truncate text-muted-foreground">
                      {l.locataire_nom ? `${l.locataire_nom} · ` : ""}
                      {l.adresse}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {alerteTranche ? (
            <p className="mt-0.5 flex items-center gap-1 text-[10px] font-bold text-amber-600">
              <AlertTriangle className="size-3" />
              {alerteTranche}
            </p>
          ) : null}
        </div>

        {/* TR sélectionné + CC */}
        <div className="w-28">
          <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
            TR
          </Label>
          <Input value={tranche ?? ""} readOnly placeholder="—" className="h-8 font-mono text-xs" />
          {referenceTranche ? (
            <p
              className="mt-0.5 truncate text-[9px] text-muted-foreground"
              title={referenceTranche.sous_secteur ?? ""}
            >
              {cc || "—"} · {referenceTranche.sous_secteur ?? ""}
            </p>
          ) : null}
        </div>

        {/* CC */}
        <div className="w-28">
          <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
            CC
          </Label>
          <Input value={cc} readOnly placeholder="auto" className="h-8 text-xs" />
        </div>

        {/* Ch. Op. — fixe, jamais saisi */}
        <div className="w-28">
          <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
            Ch. Op.
          </Label>
          <Input value={CHARGE_OPERATION} readOnly className="h-8 text-xs font-black uppercase" />
        </div>

        {/* Adresse — hiérarchie TR → rues → numéros → lots */}
        <div className="min-w-[180px] flex-1">
          <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
            Rue (tranche {tranche ?? "…"})
          </Label>
          <div className="relative">
            <Input
              value={qRue}
              onChange={(e) => setQRue(e.target.value)}
              placeholder={tranche ? "RUE CORNILLIOT…" : "sélectionnez un TR d'abord"}
              disabled={!tranche}
              className="h-8 text-xs"
            />
            {rues.length > 0 ? (
              <div className="absolute z-30 mt-1 max-h-44 w-full overflow-auto rounded-lg border bg-popover p-1 shadow-lg">
                {rues.map((r) => (
                  <button
                    key={r.rue}
                    className={`flex w-full justify-between gap-2 rounded px-2 py-1 text-left text-xs hover:bg-accent ${
                      rue === r.rue ? "bg-primary/10 font-bold" : ""
                    }`}
                    onClick={() => choisirRue(r.rue)}
                  >
                    <span className="truncate">{r.rue}</span>
                    <span className="text-muted-foreground">{r.nb_lots} lots</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {rue ? (
            <>
              <p className="mt-1 text-[10px] font-bold text-primary">
                {rue} —{" "}
                {adresseChoisie
                  ? "numéro sélectionné"
                  : lotsChoisis.length > 0
                    ? `${lotsChoisis.length} lot(s) sélectionné(s)`
                    : "toute la rue"}
              </p>
              {numeros.length > 0 ? (
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  {numeros.map((n) => (
                    <button
                      key={n}
                      onClick={() => void choisirNumero(n)}
                      className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${
                        adresseChoisie === n
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card hover:border-primary/50"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                  <span className="text-[9px] text-muted-foreground">—</span>
                  <button
                    onClick={() => {
                      setAdresseChoisie(null);
                      setLotsChoisis([]);
                    }}
                    className="rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary"
                  >
                    Toute la rue
                  </button>
                </div>
              ) : (
                <p className="mt-1 text-[9px] text-muted-foreground">
                  Aucun numéro détaillé — opération concernant toute la rue.
                </p>
              )}
            </>
          ) : null}

          {lotsDeAdresse.length > 0 ? (
            <div className="mt-1 max-h-32 overflow-auto rounded-md border bg-card p-1">
              {lotsDeAdresse.map((l) => (
                <label
                  key={l.id}
                  className="flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-0.5 text-[10px] hover:bg-accent"
                >
                  <input
                    type="checkbox"
                    checked={lotsChoisis.some((x) => x.id === l.id)}
                    onChange={() => basculerLot(l)}
                  />
                  <span className="font-mono font-bold">{l.code_patrimoine}</span>
                  <span className="truncate text-muted-foreground">
                    {l.locataire_nom ? `${l.locataire_nom} · ` : ""}
                    {l.adresse}
                  </span>
                </label>
              ))}
            </div>
          ) : null}
        </div>

        {/* Lot(s) sélectionnés */}
        {lotsChoisis.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1">
            {lotsChoisis.map((l) => (
              <span
                key={l.id}
                className="inline-flex items-center gap-1 rounded border border-primary/40 bg-primary/5 px-1.5 py-0.5 font-mono text-[10px] font-bold"
              >
                {l.code_patrimoine}
                <button
                  onClick={() => retirerLot(l.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        ) : null}

        {/* Corps d'état — sélection avec recherche */}
        <div className="w-56">
          <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
            Corps d'état → <span className="text-primary">{categorie}</span>
          </Label>
          <div className="relative">
            <Input
              value={corpsEtat}
              onChange={(e) => setCorpsEtat(e.target.value)}
              placeholder="elec… → Électricité"
              className="h-8 text-xs"
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
          <p className="mt-0.5 text-[9px] text-muted-foreground">
            Catégorie {categorie} calculée automatiquement — non saisie.
          </p>
        </div>

        {/* Nature travaux — zone large */}
        <div className="min-w-[200px] flex-1">
          <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
            Nature travaux
          </Label>
          <Textarea
            value={nature}
            onChange={(e) => setNature(e.target.value)}
            placeholder="Description métier : remplacement des colonnes montantes, étanchéité de la terrasse…"
            rows={2}
            className="text-xs"
          />
        </div>
      </div>

      {/* Deuxième rangée : montants, devis, statut, priorité, notes */}
      <div className="mt-1.5 flex flex-wrap items-end gap-1.5">
        {PSP_ANNEES.map((a: PspAnnee) => (
          <div key={a} className="w-20">
            <Label className="text-[9px] font-mono font-black text-muted-foreground">{a}</Label>
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

        <div className="w-28">
          <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
            Devis reçu ?
          </Label>
          <Select value={devisRecu} onValueChange={(v) => setDevisRecu(v as "non" | "oui")}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="non">☐ Non</SelectItem>
              <SelectItem value="oui">☑ Oui</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {devisRecu === "oui" ? (
          <>
            <div className="w-44">
              <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                Entreprise
              </Label>
              <Input
                value={devisEntreprise}
                onChange={(e) => setDevisEntreprise(e.target.value)}
                placeholder="Nom entreprise"
                className="h-8 text-xs"
              />
            </div>
            <div className="w-28">
              <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                Montant (€)
              </Label>
              <Input
                type="text"
                inputMode="numeric"
                value={devisMontant}
                onChange={(e) => setDevisMontant(e.target.value.replace(/[^\d]/g, ""))}
                placeholder="0"
                className="tabnum h-8"
              />
            </div>
          </>
        ) : null}

        <div className="w-40">
          <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
            Statut
          </Label>
          <Select value={statut} onValueChange={setStatut}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUT_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-36">
          <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
            Priorité
          </Label>
          <Select value={priorite} onValueChange={setPriorite}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PRIORITE_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[160px] flex-1">
          <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
            Notes / remarques
          </Label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Observations libres (psp_lignes.remarques)"
            className="h-8 text-xs"
          />
        </div>
      </div>

      {conflit ? (
        <p className="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-destructive">
          <AlertTriangle className="size-3.5" />
          {conflit}
        </p>
      ) : null}

      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 border-t border-dashed pt-1.5">
        <p className="text-[10px] text-muted-foreground">
          Périmètre :{" "}
          <span className="font-bold">
            {lotsChoisis.length > 0
              ? `${lotsChoisis.length} lot(s) — tranche ${tranche ?? "…"}`
              : adresseChoisie && rue
                ? `${adresseChoisie} — tranche ${tranche ?? "…"}`
                : rue
                  ? `Toute la rue ${rue} — tranche ${tranche ?? "…"}`
                  : tranche
                    ? `Toute la tranche ${tranche}`
                    : "—"}
          </span>{" "}
          · Ch. Op. = {CHARGE_OPERATION} · catégorie {categorie}
        </p>
        <div className="flex items-center gap-1.5">
          <span className="tabnum text-xs font-bold text-muted-foreground">
            Total {total.toLocaleString("fr-FR")} €
          </span>
          <Button
            size="sm"
            onClick={() => void enregistrer()}
            disabled={!tranche || saving || figee}
          >
            {saving ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Check className="size-3.5" />
            )}
            Enregistrer
          </Button>
        </div>
      </div>
    </div>
  );
}
