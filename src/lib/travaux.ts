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

/** Constructeur de ligne de détail : report d'exercice (seule l'année change). */
export const detailReport = (
  importId: string,
  commande: Record<string, unknown>,
  avant: Record<string, unknown>,
  apres: Record<string, unknown>,
  ligne?: number | null,
): Record<string, unknown> => ({
  import_id: importId,
  type: "report",
  commande_id: commande["id"] ?? null,
  numero_commande: commande["numero_commande"] ?? null,
  lot_code: commande["lot_code"] ?? null,
  annee_exercice: apres["annee_exercice"] ?? null,
  ligne: ligne ?? null,
  details: {
    avant,
    apres,
    champs_differents: ["annee_exercice"],
    report: `${avant["annee_exercice"] ?? "?"} → ${apres["annee_exercice"] ?? "?"}`,
  },
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

export type ImportDecisionType = "creee" | "inchangee" | "report" | "conflit";

/**
 * Décision métier pour une ligne d'import face à la commande existante.
 * Règle validée : `numero_commande` est l'identité UNIQUE et immuable ;
 * `annee_exercice` est une propriété mutable (report d'exercice).
 * - aucune commande existante            → création
 * - toutes les données identiques        → inchangée
 * - SEULE l'année change                 → report d'exercice (UPDATE de la même ligne)
 * - au moins un autre champ change       → conflit (version à valider)
 */
export const decisionImportCommande = (params: {
  source: Record<string, unknown>;
  before?: Record<string, unknown> | null | undefined;
}): ImportDecisionType => {
  if (!params.before) return "creee";
  if (travauxIdentiques(params.before, params.source)) return "inchangee";
  const diffs = champsDifferents(
    travauxComparable(params.before),
    travauxComparable(params.source),
  );
  if (
    diffs.length === 1 &&
    diffs[0] === "annee_exercice" &&
    params.before["annee_exercice"] !== params.source["annee_exercice"]
  ) {
    return "report";
  }
  return "conflit";
};

/** Année d'exercice courante — jamais codée en dur ; avance automatiquement chaque année. */
export const exerciceCourant = (now: Date = new Date()): number => now.getFullYear();

/**
 * États métier réels de l'application.
 * « Planifiés » est normalisé vers « En cours » et « Close » vers « Terminés » (clôturée) :
 * ils ne sont jamais proposés comme états distincts.
 * Les valeurs parasites dates/montants sont exclues.
 */
export const ETATS_METIER = [
  "Terminés",
  "Attente validation",
  "Annulée",
  "En cours",
  "Pas réalisé",
  "Sans état",
] as const;

export type EtatMetier = (typeof ETATS_METIER)[number];

/**
 * « Pas réalisé » — règle métier :
 * 1. annee_exercice renseignée ;
 * 2. annee_exercice < exercice courant (exercice clôturé) ;
 * 3. aucun engagement : engage = 0 / NULL / undefined ;
 * 4. aucun paiement : paye = 0 / NULL / undefined.
 *
 * Exercice courant (ex. 2026) : engage 0/NULL + paye 0/NULL → PAS « Pas réalisé ».
 * Année future ou annee_exercice NULL → jamais « Pas réalisé ».
 * Une commande reportée (ex. 2025 → 2026) porte annee_exercice = 2026 → jamais « Pas réalisé ».
 */
export const isPasRealise = (
  row: Record<string, unknown>,
  exercice: number = exerciceCourant(),
): boolean => {
  const annee = row["annee_exercice"];
  if (annee == null) return false;
  if (typeof annee !== "number" || annee >= exercice) return false;
  const engage = row["engage"];
  const engageNul = engage === null || engage === undefined || engage === 0;
  if (!engageNul) return false;
  const paye = row["paye"];
  return paye === null || paye === undefined || paye === 0;
};

/**
 * État métier d'une commande — source unique de vérité (filtre État, KPI FLUX, compteurs).
 * Priorité (spécification métier) :
 * 1. « Terminés » explicite (prioritaire sur les montants) ; « Close » = clôturée → « Terminés » ;
 * 2. « Attente validation » ;
 * 3. « Annulée » ;
 * 4. « En cours » : état explicite « En cours »/« Planifiés » (normalisé), ou engagement existant
 *    (engage != 0) sans état explicite « Terminés » ;
 * 5. « Pas réalisé » : exercice clôturé + aucun engagement + aucun paiement + aucun état explicite ;
 * 6. sinon → « Sans état ».
 *
 * L'exercice courant n'est PAS une condition d'« En cours » : une commande 2026 sans engagement
 * et sans état → « Sans état ». La règle « paye != engage » est abandonnée :
 * seule engage != 0 (avec absence d'état « Terminés ») qualifie « En cours ».
 * Les valeurs parasites (dates, montants…) ne deviennent jamais un état.
 */
export const etatMetier = (
  row: Record<string, unknown>,
  exercice: number = exerciceCourant(),
): string => {
  const brut = (row["etat_travaux"] || row["etat_commande"]) as string | null | undefined;
  if (brut === "Terminés" || brut === "Close") return "Terminés";
  if (brut === "Attente validation") return "Attente validation";
  if (brut === "Annulée") return "Annulée";
  if (brut === "En cours" || brut === "Planifiés") return "En cours";
  const engage = row["engage"];
  if (typeof engage === "number" && engage !== 0) return "En cours";
  if (isPasRealise(row, exercice)) return "Pas réalisé";
  return "Sans état";
};

/**
 * Inclusion d'une commande selon l'archivage :
 * - actives toujours incluses ;
 * - archivées incluses si « Inclure archivées » ;
 * - archivées « Pas réalisé » incluses si l'utilisateur sélectionne explicitement « Pas réalisé »
 *   (sans modifier globalement le comportement de « Inclure archivées »).
 */
export const visibleArchivage = (
  row: Record<string, unknown>,
  opts: { includeArchived: boolean; selectedEtats: readonly string[]; exercice?: number },
): boolean => {
  if (opts.includeArchived) return true;
  if (row["actif"] === true) return true;
  if (opts.selectedEtats.includes("Pas réalisé") && isPasRealise(row, opts.exercice)) return true;
  return false;
};

export const SECTEURS = ["GT", "GE", "CP"] as const;
export type Secteur = (typeof SECTEURS)[number];

/** Secteur patrimonial (GT/GE/CP) dérivé du corps d'état. */
export const secteurDe = (row: Record<string, unknown>): Secteur => {
  const corps_etat = String(row["corps_etat"] ?? "").toLowerCase();
  if (["maconnerie", "isolation", "divers", "espaces ext"].some((k) => corps_etat.includes(k)))
    return "GT";
  if (["electricite", "couvertures", "halls", "cages"].some((k) => corps_etat.includes(k)))
    return "GE";
  if (
    ["plomberie", "menuiseries", "toitures", "fermetures", "etancheite"].some((k) =>
      corps_etat.includes(k),
    )
  )
    return "CP";
  return "GT"; // Par défaut
};

/**
 * Répartition des commandes par secteur = NOMBRE de commandes (jamais une somme d'engage).
 * `engage` = somme réelle des montants engagés (conservée telle quelle, y compris négative).
 * Un secteur est présent dès qu'il possède au moins une commande, même si la somme engage
 * est négative ou nulle. Un secteur sans commande n'apparaît pas.
 */
export const repartitionCommandesParSecteur = (
  commandes: Record<string, unknown>[],
): { name: string; value: number; engage: number }[] =>
  SECTEURS.map((s) => {
    const rows = commandes.filter((r) => secteurDe(r) === s);
    return {
      name: s,
      value: rows.length,
      engage: rows.reduce((sum, r) => sum + (Number(r["engage"]) || 0), 0),
    };
  }).filter((d) => d.value > 0);

/** Normalisation : majuscules, sans accents ni ponctuation, espaces resserrés. */
const normalizeVillePure = (value: string) =>
  value
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();

// Adresses « malformées » qui ne contiennent pas leur ville en clair.
const VILLE_ALIASES: Record<string, string> = {
  "10 CORNILLES": "CHESSY",
  "2 IMPASSE CALVILLE": "VILLENEUVE SAINT DENIS",
  "3H PL THOMAS LE PILLEUR": "SERRIS",
  "PARKING AERIEN 1 FILOIRS DAMMARTIN": "DAMMARTIN EN GOELE",
};

export type VilleGeoPure = { ville: string; lat: number; lng: number; n?: number };
export type TrancheGeo = { code: string; localite: string | null };
export type DataVille = {
  ville: string;
  lat: number;
  lng: number;
  value: number;
  count: number;
  paye: number;
};

/** Ville extraite d'une adresse (dernier segment après « , »). */
export const villeDepuisAdresse = (adresse: string): string => {
  const parts = adresse
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.at(-1) ?? "";
};

/**
 * Associe une ville extraite d'une adresse à la ville géocodée la plus proche
 * (correspondance par sous-chaîne sur la forme normalisée, plus longue d'abord).
 */
export const matchVille = (raw: string, villes: VilleGeoPure[]): VilleGeoPure | null => {
  const normalized = normalizeVillePure(raw);
  if (!normalized) return null;
  const alias = VILLE_ALIASES[normalized];
  const target = alias ? normalizeVillePure(alias) : normalized;
  const keys = villes
    .map((v) => ({ v, key: normalizeVillePure(v.ville) }))
    .filter((x) => x.key)
    .sort((a, b) => b.key.length - a.key.length);
  const hit = keys.find((x) => target.includes(x.key) || x.key.includes(target));
  return hit?.v ?? null;
};

/**
 * Villes connues du patrimoine (villes_geo + tranches.localite), normalisées et triées par
 * longueur décroissante : le matching d'une adresse privilégie les noms de villes les plus
 * longs et spécifiques (jamais « PARIS » seul face à « PARIS 20 »).
 */
const villesConnues = (
  villesGeo: VilleGeoPure[],
  tranches: TrancheGeo[],
): { key: string; ville: string }[] => {
  const map = new Map<string, string>();
  for (const v of villesGeo) {
    const key = normalizeVillePure(v.ville);
    if (key) map.set(key, v.ville);
  }
  for (const t of tranches) {
    const key = normalizeVillePure(t.localite ?? "");
    if (key) map.set(key, t.localite ?? "");
  }
  return [...map.entries()]
    .sort((a, b) => b[0].length - a[0].length)
    .map(([key, ville]) => ({ key, ville }));
};

/**
 * Ville détectée dans une adresse d'import (source prioritaire) : recherche d'un nom de
 * ville connu dans l'adresse complète. L'analyse ne dépend pas du « dernier segment après
 * virgule » (formats réels : « 109 ALLEE DE LA PYRAMIDE - NANDY », « 61 PLACE DES CHÊNES,
 * NANDY - ER.37062 », « RESIDENCE DE LA TREILLE, SOUPPES-SUR-LOING »). Retourne null si
 * aucune ville fiable n'est trouvée.
 */
const villeDansAdresse = (
  adresse: string,
  villesGeo: VilleGeoPure[],
  tranches: TrancheGeo[],
): string | null => {
  const normalized = normalizeVillePure(adresse);
  if (!normalized) return null;
  const alias = VILLE_ALIASES[normalized];
  if (alias) return alias;
  for (const { key, ville } of villesConnues(villesGeo, tranches)) {
    if (normalized.includes(key)) return ville;
  }
  return null;
};

/**
 * Source de vérité de la ville d'une commande du Dashboard Travaux.
 * Priorité :
 *  1. adresse d'import (recherche d'une ville connue dans l'adresse complète) ;
 *  2. tranche : command.tranche_code → tranches.code → tranches.localite ;
 *  3. sinon null (commande non localisée).
 * Si l'adresse indique une ville différente de tranches.localite, l'adresse prime
 * (conflit à signaler dans les tests/diagnostics, jamais écrasé au runtime).
 */
export const villeDeCommande = (
  command: Record<string, unknown>,
  tranches: TrancheGeo[],
  villesGeo: VilleGeoPure[],
): string | null => {
  const adresse = String(command["adresse"] ?? "").trim();
  if (adresse) {
    const fromAdresse = villeDansAdresse(adresse, villesGeo, tranches);
    if (fromAdresse) return fromAdresse;
  }
  const tranche = tranches.find((t) => t.code === command["tranche_code"]);
  if (tranche?.localite) return tranche.localite.trim();
  return null;
};

/**
 * Villes géocodées avec le montant investi agrégé (engage) pour la cartographie couleur.
 * La ville de chaque commande est déterminée par `villeDeCommande` (adresse d'import puis
 * tranche). Une ville reste présente dès qu'elle possède au moins une commande (count > 0),
 * même si la somme engage est négative ou nulle.
 * `nonLocalisees` = nombre de villes distinctes présentes dans les commandes filtrées mais
 * absentes de `villes_geo` (+1 si au moins une commande n'a aucune ville déterminée).
 * Si `villes_geo` est vide, toutes les villes résolues sont comptées comme non localisées.
 */
export const buildDataVilles = (
  commandes: Record<string, unknown>[],
  tranches: TrancheGeo[],
  villesGeo: VilleGeoPure[],
): { dataVilles: DataVille[]; nonLocalisees: number } => {
  const map = new Map<string, DataVille>();
  const nonLocalisees = new Set<string>();
  let inconnues = 0;
  for (const r of commandes) {
    const ville = villeDeCommande(r, tranches, villesGeo);
    if (!ville) {
      inconnues += 1;
      continue;
    }
    const geo = matchVille(ville, villesGeo);
    if (!geo) {
      nonLocalisees.add(ville);
      continue;
    }
    const g =
      map.get(geo.ville) ??
      ({ ville: geo.ville, lat: geo.lat, lng: geo.lng, value: 0, count: 0, paye: 0 } as DataVille);
    g.value += Number(r["engage"] ?? 0);
    g.paye += Number(r["paye"] ?? 0);
    g.count += 1;
    map.set(geo.ville, g);
  }
  return {
    dataVilles: [...map.values()].filter((d) => d.count > 0),
    nonLocalisees: nonLocalisees.size + (inconnues > 0 ? 1 : 0),
  };
};
