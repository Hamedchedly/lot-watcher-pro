import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import {
  rechercherLotsAdresse,
  rechercherLotsV7,
  rechercherNumerosRue,
  rechercherPatrimoineGlobal,
  rechercherRuesTranche,
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
 * V7.3 — Recherche patrimoine partagée (saisie directe + formulaire).
 * Corrections apportées :
 *  · `searchQuery` (texte temporaire) séparé de `selectedTranche` : la TR
 *    sélectionnée reste visible (chip) et ne dépend pas du texte de recherche ;
 *  · recherche globale détectée proprement (numéro/TR/ville/libellé → tranches ;
 *    ER → lots ; texte libre → les deux, regroupés) via `rechercherPatrimoineGlobal` ;
 *  · les panneaux de suggestions sont FERMABLES sans annuler la sélection ;
 *  · recherche de lot (ER / locataire) dans la tranche courante ;
 *  · contrainte UNE seule tranche par ligne ;
 *  · périmètre construit via `construirePerimetres` (règle unique).
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

  const rechercheGlobaleFn = useServerFn(rechercherPatrimoineGlobal);
  const rechercheLotsFn = useServerFn(rechercherLotsV7);
  const rechercheRuesFn = useServerFn(rechercherRuesTranche);
  const rechercheNumerosFn = useServerFn(rechercherNumerosRue);
  const rechercheLotsAdresseFn = useServerFn(rechercherLotsAdresse);

  // ── TR : searchQuery (temporaire) vs selectedTranche (persistant) ──
  const [searchQuery, setSearchQuery] = useState("");
  const [sugTranches, setSugTranches] = useState<SuggestionTranche[]>([]);
  const [sugLots, setSugLots] = useState<SuggestionLot[]>([]);
  const [trPanelOuvert, setTrPanelOuvert] = useState(false);
  const [tranche, setTranche] = useState<string | null>(options.initial?.tranche ?? null);
  const [cc, setCc] = useState(
    (options.initial?.tranche
      ? reference?.tranches.get(options.initial.tranche)?.charge_clientele
      : "") ?? "",
  );
  const [alerteTranche, setAlerteTranche] = useState<string | null>(null);
  const [conflit, setConflit] = useState<string | null>(null);

  // ── Hiérarchie adresse ──
  const [adressePanelOuvert, setAdressePanelOuvert] = useState(false);
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

  // ── Recherche de lot dans la tranche (ER / locataire) ──
  const [qLot, setQLot] = useState("");
  const [sugLotsTranche, setSugLotsTranche] = useState<SuggestionLot[]>([]);

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

  // ── Recherche GLOBALE (active tant qu'aucune TR n'est sélectionnée) ──
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const valeur = searchQuery.trim();
    if (valeur.length < 2 || tranche) {
      setSugTranches([]);
      setSugLots([]);
      setAlerteTranche(null);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        const r = ((await rechercheGlobaleFn({ data: { q: valeur } })) ?? {
          tranches: [],
          lots: [],
        }) as { tranches: SuggestionTranche[]; lots: SuggestionLot[] };
        setSugTranches((r.tranches ?? []) as SuggestionTranche[]);
        setSugLots((r.lots ?? []) as SuggestionLot[]);
        setAlerteTranche(
          r.tranches.length === 0 && r.lots.length === 0
            ? `Aucune tranche ni lot pour « ${valeur} »`
            : null,
        );
      } catch {
        // la recherche ne bloque jamais la saisie
      }
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, tranche]);

  // ── Rues de la tranche sélectionnée (progressive) ──
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

  // ── Recherche de lot dans la tranche (ER / locataire) — progressive ──
  useEffect(() => {
    if (!tranche || qLot.trim().length < 2) {
      setSugLotsTranche([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const r = (await rechercheLotsFn({ data: { q: qLot, tranche } })) ?? [];
        setSugLotsTranche(r as SuggestionLot[]);
      } catch {
        setSugLotsTranche([]);
      }
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qLot, tranche]);

  /** Sélection d'une tranche → la valeur reste visible (chip), texte de recherche vidé. */
  const choisirTranche = (code: string) => {
    setTranche(code);
    setCc(reference?.tranches.get(code)?.charge_clientele ?? "");
    setSearchQuery("");
    setSugTranches([]);
    setSugLots([]);
    setTrPanelOuvert(false);
    setAlerteTranche(null);
    setConflit(null);
    setRue(null);
    setNumeros([]);
    setAdressesChoisies([]);
    setLotsDeAdresse(new Map());
    setLotsChoisis([]);
    setAdressePanelOuvert(false);
    setModifie(true);
  };

  /** Efface la TR sélectionnée (bouton X) — le texte de recherche réapparaît. */
  const effacerTranche = () => {
    setTranche(null);
    setCc("");
    setRue(null);
    setNumeros([]);
    setAdressesChoisies([]);
    setLotsDeAdresse(new Map());
    setLotsChoisis([]);
    setModifie(true);
  };

  /** Sélection d'un lot via la recherche globale (ER / locataire, sans TR encore choisie). */
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
    setSearchQuery("");
    setSugLots([]);
    setTrPanelOuvert(false);
    setRue(rueDe(l.adresse));
    setAdressesChoisies([entreeDe(l.adresse)]);
    setModifie(true);
  };

  /** Sélection d'un lot trouvé dans la tranche (recherche ER / locataire intra-tranche). */
  const choisirLotTranche = (l: SuggestionLot) => {
    if (l.tranche_code !== tranche) {
      setConflit(
        `Ce lot (${l.code_patrimoine}) appartient à la tranche ${l.tranche_code} — une ligne ne peut couvrir qu'une seule tranche.`,
      );
      return;
    }
    setModifie(true);
    setConflit(null);
    if (!lotsChoisis.some((x) => x.id === l.id)) setLotsChoisis((prev) => [...prev, l]);
    setQLot("");
    setSugLotsTranche([]);
  };

  /** Sélection d'une rue → numéros disponibles. Le panneau peut être fermé ensuite. */
  const choisirRue = (r: string) => {
    setRue(r);
    setAdressesChoisies([]);
    setLotsDeAdresse(new Map());
    setLotsChoisis([]);
    setModifie(true);
    setAdressePanelOuvert(true);
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
    // recherche TR globale (searchQuery ≠ selectedTranche)
    searchQuery,
    setSearchQuery,
    trPanelOuvert,
    setTrPanelOuvert,
    sugTranches,
    sugLots,
    alerteTranche,
    conflit,
    setConflit,
    // tranche + CC (persistants)
    tranche,
    cc,
    referenceTranche,
    choisirTranche,
    effacerTranche,
    choisirLotGlobal,
    // hiérarchie adresse
    adressePanelOuvert,
    setAdressePanelOuvert,
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
    // recherche lot intra-tranche (ER / locataire)
    qLot,
    setQLot,
    sugLotsTranche,
    choisirLotTranche,
    // périmètre
    perimetres,
    modifie,
  };
}
