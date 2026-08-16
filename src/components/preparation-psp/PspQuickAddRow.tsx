/**
 * V7.3 — Saisie directe : VRAIE LIGNE du tableau (une cellule par colonne).
 * Corrections apportées :
 *  · la TR sélectionnée reste visible (chip [TR 1976 — THORIGNY ✕]) —
 *    indépendante du texte de recherche ;
 *  · les panneaux de suggestions se ferment sans annuler la sélection ;
 *  · recherche lot (ER / locataire) dans la tranche, adresse sans ER obligatoire ;
 *  · devis = case à cocher → Entreprise (recherche fournisseurs) / Montant /
 *    N° devis / Date ;
 *  · colonnes : … Total, Devis, Priorité, Statut / Notes, Actions ;
 *  · au moins une année > 0 obligatoire ;
 *  · création ATOMIQUE via createPspOperationComplete (ligne + périmètre + devis).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Loader2, Search, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";

import PspSecteurBadge from "@/components/preparation-psp/PspSecteurBadge";
import { useRecherchePatrimoine } from "@/components/preparation-psp/useRecherchePatrimoine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableCell, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { PSP_ANNEES, type PspAnnee, type PspCategorie } from "@/lib/psp.prep";
import {
  createPspOperationComplete,
  getCorpsEtats,
  rechercherFournisseursDevis,
} from "@/lib/psp.prep.supabase.functions";
import { PRIORITE_LABELS, STATUT_LABELS, categorieDepuisCorpsEtat } from "@/lib/psp.prep.v7";
import type { ReferencePatrimoine } from "@/lib/psp.prep.data";

const CHARGE_OPERATION = "HCHEDLY";

type SuggestionFournisseur = { id: string; nom: string; ville: string | null; codes: string[] };

/**
 * Ligne de saisie directe — rend un <TableRow> aligné sur les colonnes du tableau.
 * Enregistre de façon ATOMIQUE : psp_lignes + psp_ligne_patrimoine + psp_devis.
 */
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
  const rec = useRecherchePatrimoine({ reference });
  const corpsEtatsFn = useServerFn(getCorpsEtats);
  const fournisseursFn = useServerFn(rechercherFournisseursDevis);
  const timerCorps = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [corpsEtat, setCorpsEtat] = useState("");
  const [sugCorps, setSugCorps] = useState<string[]>([]);
  const [nature, setNature] = useState("");
  const [montants, setMontants] = useState<Record<string, number>>({});
  const [devisCoche, setDevisCoche] = useState(false);
  const [fournisseurQ, setFournisseurQ] = useState("");
  const [sugFournisseurs, setSugFournisseurs] = useState<SuggestionFournisseur[]>([]);
  const [fournisseur, setFournisseur] = useState<SuggestionFournisseur | null>(null);
  const [devisMontant, setDevisMontant] = useState("");
  const [devisNumero, setDevisNumero] = useState("");
  const [devisDate, setDevisDate] = useState("");
  const [priorite, setPriorite] = useState("normale");
  const [statut, setStatut] = useState("a_definir");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const categorie: PspCategorie = categorieDepuisCorpsEtat(corpsEtat);
  const total = useMemo(
    () => PSP_ANNEES.reduce((s, a) => s + (montants[String(a)] ?? 0), 0),
    [montants],
  );
  const anneeValide = PSP_ANNEES.some((a) => (montants[String(a)] ?? 0) > 0);

  // Corps d'état — sélection avec recherche (aucune saisie arbitraire).
  useEffect(() => {
    if (timerCorps.current) clearTimeout(timerCorps.current);
    if (corpsEtat.trim().length < 2) {
      setSugCorps([]);
      return;
    }
    timerCorps.current = setTimeout(async () => {
      try {
        const r = (await corpsEtatsFn({ data: { q: corpsEtat } })) ?? [];
        setSugCorps(r as string[]);
      } catch {
        setSugCorps([]);
      }
    }, 200);
    return () => {
      if (timerCorps.current) clearTimeout(timerCorps.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [corpsEtat]);

  // Fournisseurs (devis) — recherche progressive nom OU code/alias.
  useEffect(() => {
    if (!devisCoche || fournisseurQ.trim().length < 2) {
      setSugFournisseurs([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const r = (await fournisseursFn({ data: { q: fournisseurQ } })) ?? [];
        setSugFournisseurs(r as SuggestionFournisseur[]);
      } catch {
        setSugFournisseurs([]);
      }
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devisCoche, fournisseurQ]);

  const enregistrer = async () => {
    if (figee || !rec.tranche || !anneeValide) return;
    setSaving(true);
    try {
      const programme: Record<string, number> = {};
      for (const a of PSP_ANNEES) programme[String(a)] = montants[String(a)] ?? 0;
      await createPspOperationComplete({
        data: {
          programmationId,
          trancheCode: rec.tranche,
          categorie,
          corpsEtatCode: (corpsEtat.match(/\(([^)]+)\)/)?.[1] ?? null) as string | null,
          corpsEtat: corpsEtat || null,
          natureTravaux: nature || null,
          programme,
          ligneBudget: null,
          remarques: notes.trim() || null,
          statut,
          priorite,
          origine: "preparation",
          perimetres: rec.perimetres.map((p) => ({
            niveau: p.niveau as "tranche" | "rue" | "adresse" | "lot",
            rue: p.rue,
            numero: p.numero,
            lotId: p.lot_id,
          })),
          devis: devisCoche
            ? [
                {
                  fournisseurId: fournisseur?.id,
                  entreprise: fournisseur?.nom ?? null,
                  dateDevis: devisDate || null,
                  montant: Number(devisMontant) || 0,
                  statut: "recu",
                  commentaire: null,
                  documentReference: devisNumero.trim() || null,
                },
              ]
            : undefined,
        },
      });
      onSaved();
    } catch (e) {
      console.error("Échec de la saisie directe :", e);
      rec.setConflit(`Enregistrement impossible : ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <TableRow className="bg-primary/5 align-top hover:bg-primary/5">
      {/* TR — sélectionnée (chip persistante) ou recherche globale */}
      <TableCell className="min-w-[150px] py-1.5">
        {rec.tranche ? (
          <div className="flex items-center justify-between gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-1">
            <span className="font-mono text-xs font-black">
              {rec.tranche}
              {rec.referenceTranche?.localite ? ` — ${rec.referenceTranche.localite}` : ""}
            </span>
            <button
              onClick={rec.effacerTranche}
              className="text-muted-foreground hover:text-destructive"
              title="Changer de TR"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <Input
              value={rec.searchQuery}
              onChange={(e) => {
                rec.setSearchQuery(e.target.value);
                rec.setTrPanelOuvert(true);
              }}
              onFocus={() => rec.setTrPanelOuvert(true)}
              placeholder="TR · ER · locataire…"
              className="h-8 pl-6 text-xs"
            />
            <Search className="pointer-events-none absolute left-2 top-2 size-3 text-muted-foreground" />
            {rec.trPanelOuvert && (rec.sugTranches.length > 0 || rec.sugLots.length > 0) ? (
              <div className="absolute z-40 mt-1 max-h-52 w-72 overflow-auto rounded-lg border bg-popover p-1 shadow-lg">
                <div className="flex items-center justify-between px-1 py-0.5">
                  <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                    Suggestions
                  </span>
                  <button
                    onClick={() => rec.setTrPanelOuvert(false)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-3" />
                  </button>
                </div>
                {rec.sugTranches.length > 0 ? (
                  <>
                    <p className="px-1 text-[9px] font-black uppercase text-primary">Tranches</p>
                    {rec.sugTranches.map((t) => (
                      <button
                        key={t.code}
                        className="flex w-full justify-between gap-2 rounded px-2 py-1 text-left text-xs hover:bg-accent"
                        onClick={() => rec.choisirTranche(t.code)}
                      >
                        <span className="font-mono font-bold">{t.code}</span>
                        <span className="text-muted-foreground">
                          {t.localite ?? t.libelle ?? ""}
                        </span>
                      </button>
                    ))}
                  </>
                ) : null}
                {rec.sugLots.length > 0 ? (
                  <>
                    <p className="px-1 text-[9px] font-black uppercase text-primary">Lots</p>
                    {rec.sugLots.map((l) => (
                      <button
                        key={l.id}
                        className="flex w-full justify-between gap-2 rounded px-2 py-1 text-left text-xs hover:bg-accent"
                        onClick={() => rec.choisirLotGlobal(l)}
                      >
                        <span className="font-mono font-bold">{l.code_patrimoine}</span>
                        <span className="truncate text-muted-foreground">
                          {l.locataire_nom ? `${l.locataire_nom} · ` : ""}
                          {l.adresse}
                        </span>
                      </button>
                    ))}
                  </>
                ) : null}
              </div>
            ) : null}
            {rec.alerteTranche ? (
              <p className="mt-0.5 flex items-center gap-1 text-[10px] font-bold text-amber-600">
                <AlertTriangle className="size-3" />
                {rec.alerteTranche}
              </p>
            ) : null}
          </div>
        )}
      </TableCell>

      {/* CC — calculé automatiquement */}
      <TableCell className="min-w-[90px] py-1.5">
        <Input value={rec.cc} readOnly placeholder="auto" className="h-8 text-xs" />
      </TableCell>

      {/* Adresse / périmètre — hiérarchie TR → rues → numéros → lots (ER non obligatoire) */}
      <TableCell className="min-w-[240px] py-1.5">
        {rec.tranche ? (
          <>
            <div className="relative">
              <Input
                value={rec.qRue}
                onChange={(e) => {
                  rec.setQRue(e.target.value);
                  rec.setAdressePanelOuvert(true);
                }}
                onFocus={() => rec.setAdressePanelOuvert(true)}
                placeholder="RUE…"
                className="h-8 pr-7 text-xs"
              />
              {rec.adressePanelOuvert ? (
                <button
                  onClick={() => rec.setAdressePanelOuvert(false)}
                  className="absolute right-1.5 top-2 text-muted-foreground hover:text-destructive"
                  title="Fermer les suggestions (la sélection est conservée)"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
              {rec.adressePanelOuvert && rec.rues.length > 0 ? (
                <div className="absolute z-40 mt-1 max-h-40 w-72 overflow-auto rounded-lg border bg-popover p-1 shadow-lg">
                  {rec.rues.map((r) => (
                    <button
                      key={r.rue}
                      className={`flex w-full justify-between gap-2 rounded px-2 py-1 text-left text-xs hover:bg-accent ${
                        rec.rue === r.rue ? "bg-primary/10 font-bold" : ""
                      }`}
                      onClick={() => rec.choisirRue(r.rue)}
                    >
                      <span className="truncate">{r.rue}</span>
                      <span className="text-muted-foreground">{r.nb_lots}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {rec.adressePanelOuvert && rec.rue ? (
              <div className="mt-1 max-h-36 overflow-auto rounded-md border bg-card p-1">
                <label className="flex items-center gap-1.5 rounded px-1 py-0.5 text-[10px] font-bold text-primary hover:bg-accent">
                  <input
                    type="checkbox"
                    checked={rec.adressesChoisies.length === 0 && rec.lotsChoisis.length === 0}
                    onChange={rec.touteLaRue}
                  />
                  Toute la rue
                </label>
                {rec.numeros.map((n) => (
                  <div key={n}>
                    <label className="flex items-center gap-1.5 rounded px-1 py-0.5 text-[10px] hover:bg-accent">
                      <input
                        type="checkbox"
                        checked={rec.adressesChoisies.includes(n)}
                        onChange={() => void rec.basculerAdresse(n)}
                      />
                      <span className="font-mono font-bold">{n}</span>
                    </label>
                    {(rec.lotsDeAdresse.get(n) ?? []).length > 0 &&
                    rec.adressesChoisies.includes(n) ? (
                      <div className="ml-4 border-l border-dashed pl-2">
                        {(rec.lotsDeAdresse.get(n) ?? []).map((l) => (
                          <label
                            key={l.id}
                            className="flex items-center gap-1.5 rounded px-1 py-0.5 text-[9px] hover:bg-accent"
                          >
                            <input
                              type="checkbox"
                              checked={rec.lotsChoisis.some((x) => x.id === l.id)}
                              onChange={() => rec.basculerLot(l)}
                            />
                            <span className="font-mono font-bold">{l.code_patrimoine}</span>
                            <span className="truncate text-muted-foreground">
                              {l.locataire_nom ? `— ${l.locataire_nom}` : ""}
                            </span>
                          </label>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
                {rec.numeros.length === 0 ? (
                  <p className="px-1 py-0.5 text-[9px] text-muted-foreground">
                    Aucun numéro détaillé — toute la rue.
                  </p>
                ) : null}
              </div>
            ) : null}

            {/* Recherche lot intra-tranche (ER / locataire) */}
            <div className="relative mt-1">
              <Input
                value={rec.qLot}
                onChange={(e) => rec.setQLot(e.target.value)}
                placeholder="ER.123 · DUPONT (lot)"
                className="h-7 pr-7 text-[10px]"
              />
              {rec.sugLotsTranche.length > 0 ? (
                <button
                  onClick={() => rec.setQLot("")}
                  className="absolute right-1.5 top-1.5 text-muted-foreground hover:text-destructive"
                >
                  <X className="size-3" />
                </button>
              ) : null}
              {rec.sugLotsTranche.length > 0 ? (
                <div className="absolute z-40 mt-1 max-h-36 w-72 overflow-auto rounded-lg border bg-popover p-1 shadow-lg">
                  {rec.sugLotsTranche.map((l) => (
                    <button
                      key={l.id}
                      className="flex w-full justify-between gap-2 rounded px-2 py-1 text-left text-[10px] hover:bg-accent"
                      onClick={() => rec.choisirLotTranche(l)}
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

            {rec.lotsChoisis.length > 0 ? (
              <div className="mt-1 flex flex-wrap items-center gap-1">
                {rec.lotsChoisis.map((l) => (
                  <span
                    key={l.id}
                    className="inline-flex items-center gap-1 rounded border border-primary/40 bg-primary/5 px-1.5 py-0.5 font-mono text-[9px] font-bold"
                  >
                    {l.code_patrimoine}
                    <button
                      onClick={() => rec.retirerLot(l.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="size-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-[10px] text-muted-foreground">choisissez un TR d'abord</p>
        )}
      </TableCell>

      {/* Corps d'état — sélection avec recherche */}
      <TableCell className="min-w-[150px] py-1.5">
        <div className="relative">
          <Input
            value={corpsEtat}
            onChange={(e) => setCorpsEtat(e.target.value)}
            placeholder="elec…"
            className="h-8 text-xs"
          />
          {sugCorps.length > 0 ? (
            <div className="absolute z-40 mt-1 max-h-40 w-64 overflow-auto rounded-lg border bg-popover p-1 shadow-lg">
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
      </TableCell>

      {/* C — calculée automatiquement */}
      <TableCell className="py-1.5">
        <PspSecteurBadge categorie={categorie} />
      </TableCell>

      {/* Nature travaux — zone multi-ligne */}
      <TableCell className="min-w-[200px] py-1.5">
        <Textarea
          value={nature}
          onChange={(e) => setNature(e.target.value)}
          placeholder="Description métier…"
          rows={2}
          className="text-xs"
        />
      </TableCell>

      {/* Montants 2027-2031 */}
      {PSP_ANNEES.map((a: PspAnnee) => (
        <TableCell key={a} className="py-1.5">
          <Input
            type="text"
            inputMode="numeric"
            className="tabnum h-8 w-20 text-right text-xs"
            value={montants[String(a)] ?? ""}
            onChange={(e) => {
              const n = Number(e.target.value.replace(/[^\d]/g, "")) || 0;
              setMontants((prev) => ({ ...prev, [String(a)]: n }));
            }}
            placeholder="0"
          />
        </TableCell>
      ))}

      {/* Total — calculé */}
      <TableCell className="py-1.5 text-right">
        <span className="tabnum text-xs font-black text-primary">
          {total.toLocaleString("fr-FR")}
        </span>
      </TableCell>

      {/* Devis — case à cocher ; si cochée : Entreprise / Montant / N° / Date */}
      <TableCell className="min-w-[170px] py-1.5">
        <label className="flex items-center gap-1.5 text-xs font-bold">
          <input
            type="checkbox"
            checked={devisCoche}
            onChange={(e) => setDevisCoche(e.target.checked)}
          />
          Devis
        </label>
        {devisCoche ? (
          <div className="mt-1 space-y-1">
            <div className="relative">
              <Input
                value={fournisseurQ}
                onChange={(e) => setFournisseurQ(e.target.value)}
                placeholder="Entreprise…"
                className="h-7 text-[10px]"
              />
              {sugFournisseurs.length > 0 ? (
                <div className="absolute z-40 mt-1 max-h-36 w-64 overflow-auto rounded-lg border bg-popover p-1 shadow-lg">
                  {sugFournisseurs.map((f) => (
                    <button
                      key={f.id}
                      className="flex w-full justify-between gap-2 rounded px-2 py-1 text-left text-[10px] hover:bg-accent"
                      onClick={() => {
                        setFournisseur(f);
                        setFournisseurQ(f.nom);
                        setSugFournisseurs([]);
                      }}
                    >
                      <span className="truncate font-medium">{f.nom}</span>
                      <span className="text-muted-foreground">
                        {f.codes[0] ? `#${f.codes[0]}` : ""}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            {fournisseur ? (
              <p className="text-[9px] text-muted-foreground">
                {fournisseur.nom}
                {fournisseur.codes.length > 0 ? ` · ${fournisseur.codes.join(" / ")}` : ""}
                {fournisseur.ville ? ` · ${fournisseur.ville}` : ""}
              </p>
            ) : null}
            <Input
              type="text"
              inputMode="numeric"
              value={devisMontant}
              onChange={(e) => setDevisMontant(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="Montant"
              className="tabnum h-7 text-[10px]"
            />
            <Input
              value={devisNumero}
              onChange={(e) => setDevisNumero(e.target.value)}
              placeholder="N° devis"
              className="h-7 text-[10px]"
            />
            <Input
              type="date"
              value={devisDate}
              onChange={(e) => setDevisDate(e.target.value)}
              className="h-7 text-[10px]"
            />
          </div>
        ) : null}
      </TableCell>

      {/* Priorité — AVANT Statut */}
      <TableCell className="min-w-[100px] py-1.5">
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
      </TableCell>

      {/* Statut / Notes — UNE seule cellule (statut structuré + texte libre) */}
      <TableCell className="min-w-[170px] py-1.5">
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
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Note libre…"
          className="mt-1 h-7 text-[10px]"
        />
      </TableCell>

      {/* Actions */}
      <TableCell className="py-1.5">
        <div className="flex flex-col items-start gap-1">
          <Button
            size="sm"
            className="h-8"
            onClick={() => void enregistrer()}
            disabled={!rec.tranche || !anneeValide || saving || figee}
          >
            {saving ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Check className="size-3.5" />
            )}
            Enregistrer
          </Button>
          {!anneeValide && rec.tranche ? (
            <p className="max-w-[180px] text-[9px] font-bold leading-tight text-amber-600">
              Indiquez au moins une année de programmation avec un montant supérieur à 0.
            </p>
          ) : null}
          {rec.conflit ? (
            <p className="max-w-[180px] text-[9px] font-bold leading-tight text-destructive">
              {rec.conflit}
            </p>
          ) : null}
          <span className="text-[9px] text-muted-foreground">
            Ch. Op. = {CHARGE_OPERATION} · cat. {categorie}
          </span>
        </div>
      </TableCell>
    </TableRow>
  );
}
