import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import {
  rechercherLotsAdresse,
  rechercherLotsV7,
  rechercherNumerosRue,
  rechercherRuesTranche,
  rechercherTranches,
} from "@/lib/psp.prep.supabase.functions";
import { construirePerimetres, type PerimetreLigne } from "@/lib/psp.prep.v7";
import { entreeDe, rueDe } from "@/lib/adresses";
import type { ReferencePatrimoine } from "@/lib/psp.prep.data";

export type SuggestionTranche = { code: string; libelle: string | null; localite: string | null };
export type SuggestionLot = {
  id: string;
  code_patrimoine: string;
  tranche_code: string;
  adresse: string | null;
  ville: string | null;
  locataire_nom?: string | null;
};

/**
 * V7.2 — Recherche patrimoine partagée (saisie directe + formulaire) :
 *  · recherche globale TR (chiffres) / ER / locataire (progressive, debouncée) ;
 *  · CC automatique depuis la référence (jamais saisi) ;
 *  · hiérarchie adresse TR → rues → numéros (multi) → lots (multi) + « Toute la rue » ;
 *  · contrainte UNE SEULE tranche par ligne (message explicite sinon) ;
 *  · périmètre structuré produit via `construirePerimetres` (règle unique).
 * Réutilise uniquement les fonctions existantes (aucun second moteur).
 */
export function useRecherchePatrimoine(options: {
  reference: ReferencePatrimoine | null;
  initial?: { tranche: string | null; perimetres?: PerimetreLigne[] };
}) {
  const { reference } = options;
  const initialPerimetres = useMemo(
    () => options.initial?.perimetres ?? [],
    [options.initial?.perimetres],
  );

  const rechercheTranchesFn = useServerFn(rechercherTranches);
  const rechercheLotsFn = useServerFn(rechercherLotsV7);
  const rechercheRuesFn = useServerFn(rechercherRuesTranche);
  const rechercheNumerosFn = useServerFn(rechercherNumerosRue);
  const rechercheLotsAdresseFn = useServerFn(rechercherLotsAdresse);

  const [q, setQ] = useState("");
  const [sugTranches, setSugTranches] = useState<SuggestionTranche[]>([]);
  const [sugLots, setSugLots] = useState<SuggestionLot[]>([]);
  const [tranche, setTranche] = useState<string | null>(options.initial?.tranche ?? null);
  const [cc, setCc] = useState(
    (options.initial?.tranche
      ? reference?.tranches.get(options.initial.tranche)?.charge_clientele
      : "") ?? "",
  );
  const [alerteTranche, setAlerteTranche] = useState<string | null>(null);
  const [conflit, setConflit] = useState<string | null>(null);

  // Hiérarchie adresse
  const [qRue, setQRue] = useState("");
  const [rues, setRues] = useState<Array<{ rue: string; ville: string | null; nb_lots: number }>>(
    [],
  );
  const [rue, setRue] = useState<string | null>(initialPerimetres.find((p) => p.rue)?.rue ?? null);
  const [numeros, setNumeros] = useState<string[]>([]);
  const [adressesChoisies, setAdressesChoisies] = useState<string[]>(
    initialPerimetres
      .filter((p) => p.niveau === "adresse" && p.rue && p.numero)
      .map((p) => `${p.numero} ${p.rue}`.trim()),
  );
  const [lotsDeAdresse, setLotsDeAdresse] = useState<Map<string, SuggestionLot[]>>(new Map());
  const [lotsChoisis, setLotsChoisis] = useState<SuggestionLot[]>([]);
  const [modifie, setModifie] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const referenceTranche = tranche ? reference?.tranches.get(tranche) : undefined;

  /** Périmètre effectif : initial tant que l'utilisateur n'a rien modifié. */
  const perimetres = useMemo<PerimetreLigne[]>(() => {
    if (!modifie) return initialPerimetres;
    return construirePerimetres({
      lots: lotsChoisis,
      adresses: adressesChoisies,
      rue,
      mode: "auto",
    });
  }, [modifie, lotsChoisis, adressesChoisies, rue, initialPerimetres]);

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

  /** Sélection d'une tranche (TR). CC automatique, périmètre réinitialisé. */
  const choisirTranche = (code: string) => {
    setTranche(code);
    setCc(reference?.tranches.get(code)?.charge_clientele ?? "");
    setQ("");
    setSugTranches([]);
    setAlerteTranche(null);
    setConflit(null);
    setRue(null);
    setNumeros([]);
    setAdressesChoisies([]);
    setLotsDeAdresse(new Map());
    setLotsChoisis([]);
    setModifie(true);
  };

  /** Sélection d'un lot via la recherche globale (ER / locataire). */
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
    setAdressesChoisies([entreeDe(l.adresse)]);
    setModifie(true);
  };

  /** Sélection d'une rue → chargement des numéros disponibles. */
  const choisirRue = (r: string) => {
    setRue(r);
    setAdressesChoisies([]);
    setLotsDeAdresse(new Map());
    setLotsChoisis([]);
    setModifie(true);
    void rechercheNumerosFn({ data: { tranche: tranche ?? "", rue: r } }).then((n) =>
      setNumeros((n ?? []) as string[]),
    );
  };

  /** « Toute la rue » : aucun numéro, aucun lot. */
  const touteLaRue = () => {
    setAdressesChoisies([]);
    setLotsDeAdresse(new Map());
    setLotsChoisis([]);
    setModifie(true);
  };

  /** Multi-adresses : coche/décoche une adresse (même tranche uniquement). */
  const basculerAdresse = async (entree: string) => {
    setModifie(true);
    const present = adressesChoisies.includes(entree);
    setAdressesChoisies((prev) => (present ? prev.filter((a) => a !== entree) : [...prev, entree]));
    if (present) {
      setLotsChoisis((prev) =>
        prev.filter((l) => entreeDe(l.adresse).toUpperCase() !== entree.toUpperCase()),
      );
      return;
    }
    try {
      const l =
        (await rechercheLotsAdresseFn({
          data: { tranche: tranche ?? "", adresse: entree },
        })) ?? [];
      setLotsDeAdresse((prev) => new Map(prev).set(entree, l as SuggestionLot[]));
    } catch {
      setLotsDeAdresse((prev) => new Map(prev).set(entree, []));
    }
  };

  /** Multi-lots (tous de la même tranche). */
  const basculerLot = (l: SuggestionLot) => {
    if (tranche && l.tranche_code !== tranche) {
      setConflit(
        `Ce lot (${l.code_patrimoine}) appartient à la tranche ${l.tranche_code} — une ligne ne peut couvrir qu'une seule tranche.`,
      );
      return;
    }
    setModifie(true);
    setLotsChoisis((prev) =>
      prev.some((x) => x.id === l.id) ? prev.filter((x) => x.id !== l.id) : [...prev, l],
    );
  };

  const retirerLot = (id: string) => setLotsChoisis((prev) => prev.filter((x) => x.id !== id));

  return {
    // recherche globale
    q,
    setQ,
    sugTranches,
    sugLots,
    alerteTranche,
    conflit,
    setConflit,
    // tranche + CC
    tranche,
    cc,
    referenceTranche,
    choisirTranche,
    choisirLotGlobal,
    // hiérarchie adresse
    qRue,
    setQRue,
    rues,
    rue,
    numeros,
    adressesChoisies,
    lotsDeAdresse,
    lotsChoisis,
    choisirRue,
    touteLaRue,
    basculerAdresse,
    basculerLot,
    retirerLot,
    // périmètre
    perimetres,
    modifie,
  };
}
