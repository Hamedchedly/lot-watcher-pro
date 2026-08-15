/**
 * PSP V7 — Logique PUR réutilisable pour la préparation (saisie directe,
 * recherche patrimoine, enveloppes, filtres annuels, export).
 *
 * Aucune dépendance Supabase / React : testable en Node (type stripping).
 *
 * Règle absolue V7 : ne JAMAIS dupliquer les moteurs existants. Ce module :
 *  · centralise la règle corps d'état → catégorie GE/GT/CP (dérivée des 114
 *    lignes réelles du fichier « Prog_Secteur_11_2026.xlsx ») ;
 *  · filtre annuel CUMULATIF avec désélection individuelle (visualisation seule,
 *    ne modifie JAMAIS la programmation) ;
 *  · calcule l'enveloppe (programmé / restant / %) — rien n'est stocké ;
 *  · formate l'adresse d'export depuis les relations structurées
 *    (psp_ligne_patrimoine) — la chaîne n'est jamais stockée.
 */
import { PSP_ANNEES, type PspAnnee, type PspCategorie, type PspOperation } from "./psp.prep.ts";
import { entreeDe, rueDe } from "./adresses.ts";

// ── 1. Corps d'état → catégorie (mapping centralisé, réutilisable) ──────────────
// Source : fichier de programmation 2026 réel (code lettre entre parenthèses).
export const CORPS_ETAT_CATEGORIE: Record<string, PspCategorie> = {
  // GT
  c: "GT",
  d: "GT",
  e: "GT",
  // GE
  f: "GE",
  g: "GE",
  h: "GE",
  j: "GE",
  // CP
  m: "CP",
  o: "CP",
  p: "CP",
  q: "CP",
  r: "CP",
  u: "CP",
  w: "CP",
  y: "CP",
  z: "CP",
};

export const CATEGORIE_CORPS_ETAT_DEFAUT: PspCategorie = "GT";

/** Extrait le code lettre d'un libellé corps d'état : « (u) Etanchéité » → « u ». */
export function extraireCodeCorpsEtat(corpsEtat: string | null | undefined): string | null {
  const m = /\(([A-Za-zÀ-ÿ]+)\)/.exec(corpsEtat ?? "");
  if (!m?.[1]) return null;
  const code = m[1].toLowerCase();
  return code in CORPS_ETAT_CATEGORIE ? code : null;
}

/** Catégorie GE/GT/CP depuis le corps d'état (règle unique — jamais dupliquée dans l'UI). */
export function categorieDepuisCorpsEtat(corpsEtat: string | null | undefined): PspCategorie {
  const code = extraireCodeCorpsEtat(corpsEtat);
  return (code ? CORPS_ETAT_CATEGORIE[code] : undefined) ?? CATEGORIE_CORPS_ETAT_DEFAUT;
}

// ── 2. Filtre annuel CUMULATIF (visualisation seule) ────────────────────────────
/** Une opération est concernée par une année si son montant y est > 0. */
export const operationConcerneAnnee = (op: PspOperation, annee: PspAnnee): boolean =>
  (op.programme?.[String(annee)] ?? 0) > 0;

/**
 * Filtre cumulatif : les années sélectionnées sont réunies (2027+2028 = lignes
 * avec montant > 0 en 2027 OU 2028). Chaque année est désélectionnable.
 * Aucune sélection → toutes les opérations. Ne modifie JAMAIS la programmation.
 */
export function filtrerParAnneesCumulatif(ops: PspOperation[], annees: PspAnnee[]): PspOperation[] {
  if (!annees || annees.length === 0) return ops;
  const set = new Set(annees.map(String));
  return ops.filter((op) =>
    PSP_ANNEES.some((a) => set.has(String(a)) && operationConcerneAnnee(op, a)),
  );
}

// ── 3. Enveloppes (calculs — jamais stockés) ────────────────────────────────────
export type CalculEnveloppe = {
  enveloppe: number;
  programme: number;
  restant: number;
  pourcentage: number | null; // null si enveloppe = 0 (non définie)
  depassement: boolean;
};

export function calculEnveloppe(enveloppe: number, programme: number): CalculEnveloppe {
  const restant = enveloppe - programme;
  return {
    enveloppe,
    programme,
    restant,
    pourcentage: enveloppe > 0 ? programme / enveloppe : null,
    depassement: enveloppe > 0 && restant < 0,
  };
}

// ── 4. Export — chaîne d'adresse depuis les relations structurées ───────────────
export type PerimetreExport = {
  niveau: "tranche" | "rue" | "adresse" | "lot";
  rue?: string | null;
  numero?: string | null;
  ville?: string | null;
  /** Adresse enrichie du lot ou de la tranche (affichage) — jamais stockée en base. */
  adresseReference?: string | null;
  lots?: Array<{ code_patrimoine: string | null }>;
};

/**
 * « 12 RUE CORNILLIOT, THORIGNY-SUR-MARNE - ER.123456 / ER.123457 »
 * Toute une rue → « RUE CORNILLIOT, THORIGNY-SUR-MARNE ».
 * Lot / tranche → adresse de référence enrichie (sinon ville seule).
 * La chaîne est calculée, JAMAIS stockée en base.
 */
export function adresseExportPatrimoine(p: PerimetreExport): string {
  const ville = p.ville?.trim() ?? "";
  const rue = p.rue?.trim() ?? "";
  const numero = p.numero?.trim() ?? "";
  let base: string;
  if (p.niveau === "adresse") base = `${numero} ${rue}`.trim();
  else if (p.niveau === "rue") base = rue;
  else base = p.adresseReference?.trim() ?? "";
  const adresse = base ? (ville ? `${base}, ${ville}` : base) : ville;
  const codes = (p.lots ?? []).map((l) => l.code_patrimoine).filter((c): c is string => !!c);
  const lotsPart = codes.length > 0 ? ` - ${codes.join(" / ")}` : "";
  return `${adresse}${lotsPart}`.trim();
}

// ── 5. Statut / priorité — libellés UNIQUES (affichage + tri partagent ces valeurs) ──
export const STATUT_LABELS: Record<string, string> = {
  a_definir: "À définir",
  attente_agence: "Attente retour agence",
  attente_confirmation: "Attente confirmation",
};
export const PRIORITE_LABELS: Record<string, string> = {
  prioritaire: "Prioritaire",
  normale: "Normale",
  non_prioritaire: "Non prioritaire",
};

/** Libellés des statuts de devis (psp_devis.statut) — affichage + édition. */
export const DEVIS_STATUT_LABELS: Record<string, string> = {
  a_demander: "À demander",
  demande_envoyee: "Demande envoyée",
  recu: "Reçu",
  a_analyser: "À analyser",
  retenu: "Retenu",
  non_retenu: "Non retenu",
  expire: "Expiré",
  annule: "Annulé",
};

// ── 6. Enveloppes — type de la carte clé `${annee}|${categorie}` (jamais stocké) ──
export type EnveloppeMap = Record<string, number>;

// ── 7. Hiérarchie patrimoniale d'une tranche (rues → numéros → lots) ────────────
export type LotAdresse = { adresse: string | null; ville?: string | null };

/**
 * Rues distinctes d'une tranche (réutilise `rueDe` : « 25-27 RUE DE RUZE » →
 * « RUE DE RUZE »). Le libellé d'affichage est le libellé complet (majuscules).
 */
export function ruesDeTranche(
  lots: LotAdresse[],
  q?: string,
): Array<{ rue: string; ville: string | null; nb_lots: number }> {
  const map = new Map<string, { ville: string | null; nb_lots: number }>();
  for (const l of lots) {
    const rue = rueDe(l.adresse);
    if (!rue || rue === "Adresse inconnue") continue;
    const cle = rue.toUpperCase();
    const cur = map.get(cle) ?? { ville: l.ville ?? null, nb_lots: 0 };
    cur.nb_lots += 1;
    if (!cur.ville && l.ville) cur.ville = l.ville;
    map.set(cle, cur);
  }
  const liste = [...map.entries()]
    .map(([rue, v]) => ({ rue, ville: v.ville, nb_lots: v.nb_lots }))
    .sort((a, b) => a.rue.localeCompare(b.rue, "fr", { numeric: true, sensitivity: "base" }));
  const qq = (q ?? "").trim().toLowerCase();
  return qq ? liste.filter((x) => x.rue.toLowerCase().includes(qq)) : liste;
}

/**
 * Numéros/entrées disponibles d'une rue (adresses complètes distinctes).
 * « 12 RUE CORNILLIOT », « 14 RUE CORNILLIOT », « 25-27 RUE DE RUZE »…
 */
export function numerosDeRue(lots: LotAdresse[], rue: string): string[] {
  const cible = rue.trim().toUpperCase();
  const set = new Set<string>();
  for (const l of lots) {
    const entree = entreeDe(l.adresse);
    if (!entree) continue;
    if (rueDe(l.adresse).toUpperCase() !== cible) continue;
    set.add(entree);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "fr", { numeric: true, sensitivity: "base" }));
}

/** Lots correspondant à une entrée précise (« 12 RUE CORNILLIOT »). */
export function lotsDeAdresse<T extends { adresse: string | null }>(
  lots: T[],
  entree: string,
): T[] {
  const cible = entree.trim().toUpperCase();
  return lots.filter((l) => entreeDe(l.adresse).toUpperCase() === cible);
}

// ── 8. Libellé d'adresse affiché dans le tableau depuis le périmètre structuré ──
export type LotInfo = {
  code_patrimoine: string | null;
  adresse: string | null;
  ville: string | null;
};
export type PerimetreLigne = {
  niveau: string;
  rue: string | null;
  numero: string | null;
  lot_id: string | null;
};

/**
 * « RUE CORNILLIOT, THORIGNY-SUR-MARNE » / « 12 RUE CORNILLIOT, … - ER.123456 ».
 * Utilise `adresseExportPatrimoine` (règle unique). Sans périmètre : repli
 * adresse/ville de la ligne. Multi-périmètres : jointure « ; ».
 */
export function libelleAdressePerimetre(
  perimetres: PerimetreLigne[],
  lotsParId: Map<string, LotInfo>,
  contexte: { adresse: string; ville: string },
): string {
  if (!perimetres || perimetres.length === 0) {
    const base = [contexte.adresse, contexte.ville].filter(Boolean).join(", ");
    return base || "—";
  }
  // Les lots d'une MÊME adresse sont regroupés : codes séparés par « / ».
  const lotsParBase = new Map<string, { base: string; ville: string; codes: string[] }>();
  const autres: PerimetreExport[] = [];
  for (const p of perimetres) {
    if (p.niveau === "lot") {
      const lot = p.lot_id ? lotsParId.get(p.lot_id) : undefined;
      const base = lot?.adresse ?? contexte.adresse;
      const ville = lot?.ville ?? contexte.ville;
      const cle = `${base}|${ville}`;
      const cur = lotsParBase.get(cle) ?? { base, ville, codes: [] };
      if (lot?.code_patrimoine) cur.codes.push(lot.code_patrimoine);
      lotsParBase.set(cle, cur);
    } else if (p.niveau === "rue") {
      autres.push({ niveau: "rue", rue: p.rue, ville: contexte.ville });
    } else if (p.niveau === "adresse") {
      autres.push({ niveau: "adresse", rue: p.rue, numero: p.numero, ville: contexte.ville });
    } else {
      autres.push({ niveau: "tranche", adresseReference: contexte.adresse, ville: contexte.ville });
    }
  }
  const parts: string[] = [];
  for (const g of lotsParBase.values()) {
    parts.push(
      adresseExportPatrimoine({
        niveau: "lot",
        adresseReference: g.base,
        ville: g.ville,
        lots: g.codes.map((c) => ({ code_patrimoine: c })),
      }),
    );
  }
  for (const e of autres) parts.push(adresseExportPatrimoine(e));
  return parts.join(" ; ");
}

// ── 9. Construction du périmètre patrimonial depuis la sélection UI (pure) ─────
/** Extrait le numéro d'une entrée : « 25-27 RUE DE RUZE » → « 25-27 ». */
export function numeroDeEntree(entree: string): string {
  const m = entree.match(/^([\d.\-/]+)\s*(BIS|TER|QUATER)?\s/i);
  return m ? `${m[1]?.trim() ?? ""}${m[2] ? ` ${m[2].toUpperCase()}` : ""}` : entree;
}

/**
 * Construit les lignes `psp_ligne_patrimoine` depuis la sélection de la ligne de
 * saisie. Règle : une seule tranche ; lots prioritaire sur adresse ; adresses
 * prioritaire sur rue ; rue prioritaire sur tranche. Tous les niveaux sont
 * structurés (vérifiés par CHECK en base).
 */
export function construirePerimetres(input: {
  lots: Array<{ id: string; adresse?: string | null; code_patrimoine?: string | null }>;
  adresses: string[];
  rue: string | null;
  mode: "auto" | "force";
}): PerimetreLigne[] {
  if (input.mode === "force" && input.lots.length === 0) {
    // Périmètre "toute la tranche" (toujours exprimé avec tranche_code).
    return [{ niveau: "tranche", rue: null, numero: null, lot_id: null }];
  }
  if (input.lots.length > 0) {
    return input.lots.map((l) => ({
      niveau: "lot",
      rue: null,
      numero: null,
      lot_id: l.id,
    }));
  }
  if (input.adresses.length > 0 && input.rue) {
    return input.adresses.map((a) => ({
      niveau: "adresse",
      rue: input.rue,
      numero: numeroDeEntree(a),
      lot_id: null,
    }));
  }
  if (input.rue) {
    return [{ niveau: "rue", rue: input.rue, numero: null, lot_id: null }];
  }
  return [{ niveau: "tranche", rue: null, numero: null, lot_id: null }];
}

/**
 * Programmé par année × catégorie — règle unique utilisée par la répartition
 * annuelle (PspKpi) et testable. Clé `${annee}|${categorie}`. Jamais stocké.
 */
export function programmeParAnneeCategorie(ops: PspOperation[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const op of ops) {
    for (const a of PSP_ANNEES) {
      const v = op.programme?.[String(a)] ?? 0;
      if (v > 0) m[`${a}|${op.categorie}`] = (m[`${a}|${op.categorie}`] ?? 0) + v;
    }
  }
  return m;
}
