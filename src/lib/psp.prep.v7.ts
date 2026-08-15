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
