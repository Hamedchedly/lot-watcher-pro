import * as XLSX from "xlsx";

export type CommandeTravaux = {
  numero_commande: string;
  secteur: string | null;
  tranche_code: string | null;
  charge_clientele: string | null;
  adresse: string | null;
  nature_analytique: string | null;
  corps_etat: string | null;
  charge_operation: string | null;
  ligne_budget: string | null;
  descriptif: string | null;
  budget: number | null;
  numero_fournisseur: string | null;
  fournisseur: string | null;
  etat_commande: string | null;
  engage: number | null;
  ecart: number | null;
  paye: number | null;
  solde: number | null;
  etat_travaux: string | null;
  date_demarrage: string | null;
  date_fin_travaux: string | null;
  observations: string | null;
  support_communication: string | null;
  date_communication: string | null;
  lot_code: string | null;
  batiment: string | null;
  annee_exercice?: number | null;
  classification_programmation?: string | null;
  classification_secteur?: string | null;
  /** Ligne Excel d'origine (utilisée pour les détails d'import, jamais écrite en base). */
  ligne?: number;
};

export type TravauxParseIssue = { line: number; message: string; numero_commande: string | null };
export type ParsedTravaux = {
  commandes: CommandeTravaux[];
  lignes: number;
  doublons: number;
  doublonsDetails: TravauxParseIssue[];
  conflits: TravauxParseIssue[];
  erreurs: TravauxParseIssue[];
};

type Raw = Record<string, unknown>;
const text = (value: unknown) => {
  if (value === null || value === undefined) return null;
  let result = String(value).trim();
  // Suppression du guillemet simple au début (souvent présent dans Excel pour forcer le texte)
  if (result.startsWith("'")) result = result.substring(1);
  return result === "" || result === "..." ? null : result;
};
const number = (value: unknown) => {
  const result = text(value)?.replace(/\s/g, "").replace(",", ".");
  if (!result) return null;
  const parsed = Number(result);
  return Number.isFinite(parsed) ? parsed : null;
};
const date = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    return parsed
      ? `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`
      : null;
  }
  const valueText = String(value).trim();
  const match = valueText.match(/^(\d{2})[./-](\d{2})[./-](\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
};

const normalizeHeader = (value: unknown) =>
  text(value)
    ?.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim() ?? "";
const headerAliases: Record<string, keyof CommandeTravaux> = {
  secteur: "secteur",
  tranche: "tranche_code",
  "charge de clientele": "charge_clientele",
  adresse: "adresse",
  "nature analytique": "nature_analytique",
  "corps d etat": "corps_etat",
  "charge d op": "charge_operation",
  "charge d operation": "charge_operation",
  "ligne budget": "ligne_budget",
  "descriptif des travaux": "descriptif",
  budget: "budget",
  "no commande": "numero_commande",
  "numero commande": "numero_commande",
  "no fournisseur": "numero_fournisseur",
  "numero fournisseur": "numero_fournisseur",
  fournisseur: "fournisseur",
  "etat de la commande": "etat_commande",
  "etat commande": "etat_commande",
  engage: "engage",
  ecart: "ecart",
  paye: "paye",
  solde: "solde",
  "etat des travaux": "etat_travaux",
  "etat travaux": "etat_travaux",
  "date demarrage": "date_demarrage",
  "date fin des travaux": "date_fin_travaux",
  "date fin travaux": "date_fin_travaux",
  observations: "observations",
  "support communication": "support_communication",
  "date communication": "date_communication",
};
const moneyFields = new Set(["budget", "engage", "ecart", "paye", "solde"]);
const dateFields = new Set(["date_demarrage", "date_fin_travaux", "date_communication"]);

export function parseTravauxWorkbook(data: ArrayBuffer): ParsedTravaux {
  const workbook = XLSX.read(data, { cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]!];
  if (!sheet) throw new Error("Le classeur ne contient aucune feuille.");
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });

  // Recherche de la ligne contenant "No commande"
  const mainHeaderIndex = matrix.findIndex((row) =>
    row.some((cell) => normalizeHeader(cell) === "no commande"),
  );
  if (mainHeaderIndex < 0) throw new Error("Colonne obligatoire introuvable : No commande.");

  // On récupère la ligne principale et la ligne au-dessus pour fusionner les en-têtes
  const rowAbove = (mainHeaderIndex > 0 ? matrix[mainHeaderIndex - 1] : []) as unknown[];
  const rowMain = (matrix[mainHeaderIndex] || []) as unknown[];

  const headers: (keyof CommandeTravaux | null)[] = [];
  const maxCols = Math.max(rowAbove.length, rowMain.length);

  for (let i = 0; i < maxCols; i++) {
    const h1 = normalizeHeader(rowAbove[i]);
    const h2 = normalizeHeader(rowMain[i]);

    // On cherche d'abord dans les alias avec la ligne principale, puis la ligne du dessus
    const alias = headerAliases[h2] || headerAliases[h1];
    headers.push(alias || null);
  }

  const commandes = new Map<string, CommandeTravaux>();
  const conflits: TravauxParseIssue[] = [];
  const erreurs: TravauxParseIssue[] = [];
  const doublonsDetails: TravauxParseIssue[] = [];
  let doublons = 0;

  for (let index = mainHeaderIndex + 1; index < matrix.length; index += 1) {
    const row = matrix[index] ?? [];
    if (row.every((cell) => text(cell) === null)) continue;

    const raw: Raw = {};
    headers.forEach((key, column) => {
      if (key) raw[key] = row[column];
    });

    const numero = text(raw["numero_commande"]);
    if (!numero) {
      erreurs.push({
        line: index + 1,
        message: "Numéro de commande manquant",
        numero_commande: null,
      });
      continue;
    }

    const commande = {
      numero_commande: numero,
      secteur: null,
      tranche_code: null,
      charge_clientele: null,
      adresse: null,
      nature_analytique: null,
      corps_etat: null,
      charge_operation: null,
      ligne_budget: null,
      descriptif: null,
      budget: null,
      numero_fournisseur: null,
      fournisseur: null,
      etat_commande: null,
      engage: null,
      ecart: null,
      paye: null,
      solde: null,
      etat_travaux: null,
      date_demarrage: null,
      date_fin_travaux: null,
      observations: null,
      support_communication: null,
      date_communication: null,
      lot_code: null,
      batiment: null,
    } as CommandeTravaux;

    headers.forEach((key, column) => {
      if (key) {
        const value = row[column];
        const typed = commande as unknown as Record<string, unknown>;
        typed[key] = moneyFields.has(key)
          ? number(value)
          : dateFields.has(key)
            ? date(value)
            : text(value);
      }
    });

    const previous = commandes.get(numero);
    if (previous) {
      doublons += 1;
      // La comparaison ignore la ligne Excel (champ `ligne`), qui diffère toujours entre deux lignes.
      const a = { ...previous };
      delete a.ligne;
      const b = { ...commande };
      delete b.ligne;
      const different = JSON.stringify(a) !== JSON.stringify(b);
      if (different) {
        conflits.push({
          line: index + 1,
          numero_commande: numero,
          message: "Doublon avec des valeurs différentes",
        });
      }
      doublonsDetails.push({
        line: index + 1,
        numero_commande: numero,
        message: different ? "Doublon avec des valeurs différentes" : "Doublon identique",
      });
      continue;
    }
    // Ligne d'origine conservée pour les détails d'import (rattachements/erreurs).
    commande.ligne = index + 1;
    commandes.set(numero, commande);
  }
  return {
    commandes: [...commandes.values()],
    lignes: matrix.length - mainHeaderIndex - 1,
    doublons,
    doublonsDetails,
    conflits,
    erreurs,
  };
}

export const TRAVAUX_FIELDS = [
  "numero_commande",
  "secteur",
  "tranche_code",
  "charge_clientele",
  "adresse",
  "nature_analytique",
  "corps_etat",
  "charge_operation",
  "ligne_budget",
  "descriptif",
  "budget",
  "numero_fournisseur",
  "fournisseur",
  "etat_commande",
  "engage",
  "ecart",
  "paye",
  "solde",
  "etat_travaux",
  "date_demarrage",
  "date_fin_travaux",
  "observations",
  "support_communication",
  "date_communication",
  "lot_code",
  "batiment",
  "annee_exercice",
] as const;

export type TravailComparable = Record<string, string | number | boolean | null>;

/**
 * Snapshot « comparable » d'une commande : seuls les champs métier de TRAVAUX_FIELDS.
 * Utilisé pour la comparaison de versions et l'historique (avant / après).
 */
export const travauxComparable = (row: Record<string, unknown>): TravailComparable =>
  Object.fromEntries(TRAVAUX_FIELDS.map((field) => [field, row[field] ?? null])) as TravailComparable;

/** Deux versions d'une commande sont-elles strictement identiques (champs métier) ? */
export const travauxIdentiques = (a: Record<string, unknown>, b: Record<string, unknown>): boolean =>
  JSON.stringify(travauxComparable(a)) === JSON.stringify(travauxComparable(b));

/**
 * Domaine d'années pour le slider du Dashboard.
 * Indépendant des seules commandes actives : élargi de ±1 an, jamais réduit à une seule année.
 */
export const sliderYearDomain = (years: number[], fallbackStart = 2020): [number, number] => {
  if (!years.length) return [fallbackStart, fallbackStart + 5];
  const min = Math.min(...years);
  const max = Math.max(...years);
  return [Math.max(fallbackStart, min - 1), Math.max(max + 1, min + 1)];
};

/**
 * Commandes actives à archiver à la fin d'un import :
 * uniquement celles de la MÊME année d'exercice que l'import et absentes du fichier.
 * Si l'import n'a pas d'année, on n'archive rien (comportement sûr, non destructif).
 */
export const commandesAAArchiver = (
  actives: { id: string; annee_exercice?: number | null }[],
  annee: number | null,
  vuDansImport: Set<string>,
): { id: string }[] => {
  if (annee == null) return [];
  return actives.filter((row) => row.annee_exercice === annee && !vuDansImport.has(row.id));
};

/** Champs qui diffèrent entre deux snapshots (comparaison stricte JSON). */
export const champsDifferents = (
  avant: Record<string, unknown> | null | undefined,
  apres: Record<string, unknown> | null | undefined,
): string[] => {
  const keys = new Set([...Object.keys(avant ?? {}), ...Object.keys(apres ?? {})]);
  return [...keys].filter(
    (key) => JSON.stringify(avant?.[key]) !== JSON.stringify(apres?.[key]),
  );
};

/**
 * Snapshot d'affichage d'une commande pour les détails d'import (immuable).
 * Porte l'essentiel de l'affichage sans dépendre de l'état futur de travaux_commandes.
 */
export const snapshotCommande = (row: Record<string, unknown>): Record<string, unknown> => ({
  numero_commande: row["numero_commande"] ?? null,
  annee_exercice: row["annee_exercice"] ?? null,
  lot_code: row["lot_code"] ?? null,
  tranche_code: row["tranche_code"] ?? null,
  adresse: row["adresse"] ?? null,
  fournisseur: row["fournisseur"] ?? null,
  montant: row["engage"] ?? row["budget"] ?? null,
  date_demarrage: row["date_demarrage"] ?? null,
  date_fin_travaux: row["date_fin_travaux"] ?? null,
  statut: row["etat_travaux"] ?? row["etat_commande"] ?? null,
  ...travauxComparable(row),
});

/** Constructeur de ligne de détail : commande créée. */
export const detailCreee = (
  importId: string,
  commande: Record<string, unknown>,
  ligne?: number | null,
): Record<string, unknown> => ({
  import_id: importId,
  type: "creee",
  numero_commande: commande["numero_commande"] ?? null,
  lot_code: commande["lot_code"] ?? null,
  annee_exercice: commande["annee_exercice"] ?? null,
  ligne: ligne ?? null,
  details: snapshotCommande(commande),
});

/** Constructeur de ligne de détail : commande inchangée. */
export const detailInchangee = (
  importId: string,
  commande: Record<string, unknown>,
  ligne?: number | null,
): Record<string, unknown> => ({
  import_id: importId,
  type: "inchangee",
  commande_id: commande["id"] ?? null,
  numero_commande: commande["numero_commande"] ?? null,
  lot_code: commande["lot_code"] ?? null,
  annee_exercice: commande["annee_exercice"] ?? null,
  ligne: ligne ?? null,
  details: snapshotCommande(commande),
});

/** Constructeur de ligne de détail : conflit de version (à valider). */
export const detailConflit = (
  importId: string,
  commande: Record<string, unknown>,
  avant: Record<string, unknown>,
  apres: Record<string, unknown>,
  ligne?: number | null,
): Record<string, unknown> => ({
  import_id: importId,
  type: "conflit",
  commande_id: commande["id"] ?? null,
  numero_commande: commande["numero_commande"] ?? null,
  lot_code: commande["lot_code"] ?? null,
  annee_exercice: commande["annee_exercice"] ?? null,
  ligne: ligne ?? null,
  details: { avant, apres, champs_differents: champsDifferents(avant, apres) },
});

/** Constructeur de ligne de détail : rattachement patrimoine non résolu. */
export const detailIgnoree = (
  importId: string,
  source: Record<string, unknown>,
  ligne?: number | null,
): Record<string, unknown> => ({
  import_id: importId,
  type: "ignoree",
  numero_commande: source["numero_commande"] ?? null,
  lot_code: source["lot_code"] ?? null,
  annee_exercice: source["annee_exercice"] ?? null,
  ligne: ligne ?? null,
  message: `Tranche "${source["tranche_code"]}" introuvable dans la base`,
  details: { tranche_fournie: source["tranche_code"] ?? null },
});

/** Constructeur de ligne de détail : commande archivée (snapshot complet + motif). */
export const detailArchivee = (
  importId: string,
  commande: Record<string, unknown>,
): Record<string, unknown> => ({
  import_id: importId,
  type: "archivee",
  commande_id: commande["id"] ?? null,
  numero_commande: commande["numero_commande"] ?? null,
  lot_code: commande["lot_code"] ?? null,
  annee_exercice: commande["annee_exercice"] ?? null,
  message: "Absente du fichier importé",
  details: { ...snapshotCommande(commande), motif: "Absente du fichier importé" },
});

/** Constructeur de ligne de détail : doublon / erreur issus du parseur. */
export const detailIssue = (
  importId: string,
  type: "doublon" | "erreur",
  issue: { line: number; message: string; numero_commande?: string | null | undefined },
): Record<string, unknown> => ({
  import_id: importId,
  type,
  numero_commande: issue.numero_commande ?? null,
  ligne: issue.line ?? null,
  message: issue.message,
});
