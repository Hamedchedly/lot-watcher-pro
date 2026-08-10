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
};

export type TravauxParseIssue = { line: number; message: string; numero_commande: string | null };
export type ParsedTravaux = {
  commandes: CommandeTravaux[];
  lignes: number;
  doublons: number;
  conflits: TravauxParseIssue[];
  erreurs: TravauxParseIssue[];
};

type Raw = Record<string, unknown>;
const text = (value: unknown) => {
  if (value === null || value === undefined) return null;
  const result = String(value).trim();
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
    return parsed ? `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}` : null;
  }
  const valueText = String(value).trim();
  const match = valueText.match(/^(\d{2})[./-](\d{2})[./-](\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
};

const normalizeHeader = (value: unknown) => text(value)?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim() ?? "";
const headerAliases: Record<string, keyof CommandeTravaux> = {
  secteur: "secteur", tranche: "tranche_code", "charge de clientele": "charge_clientele", adresse: "adresse",
  "nature analytique": "nature_analytique", "corps d etat": "corps_etat", "charge d op": "charge_operation",
  "charge d operation": "charge_operation", "ligne budget": "ligne_budget", "descriptif des travaux": "descriptif",
  budget: "budget", "no commande": "numero_commande", "numero commande": "numero_commande",
  "no fournisseur": "numero_fournisseur", "numero fournisseur": "numero_fournisseur", fournisseur: "fournisseur",
  "etat de la commande": "etat_commande", "etat commande": "etat_commande", engage: "engage",
  ecart: "ecart", paye: "paye", solde: "solde", "etat des travaux": "etat_travaux", "etat travaux": "etat_travaux",
  "date demarrage": "date_demarrage", "date fin des travaux": "date_fin_travaux", "date fin travaux": "date_fin_travaux",
  observations: "observations", "support communication": "support_communication", "date communication": "date_communication",
};
const moneyFields = new Set(["budget", "engage", "ecart", "paye", "solde"]);
const dateFields = new Set(["date_demarrage", "date_fin_travaux", "date_communication"]);

export function parseTravauxWorkbook(data: ArrayBuffer): ParsedTravaux {
  const workbook = XLSX.read(data, { cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]!];
  if (!sheet) throw new Error("Le classeur ne contient aucune feuille.");
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });
  const headerIndex = matrix.findIndex((row) => row.some((cell) => normalizeHeader(cell) === "no commande"));
  if (headerIndex < 0) throw new Error("Colonne obligatoire introuvable : No commande.");
  const headers = (matrix[headerIndex] ?? []).map((cell) => headerAliases[normalizeHeader(cell)] ?? null);
  const commandes = new Map<string, CommandeTravaux>();
  const conflits: TravauxParseIssue[] = [];
  const erreurs: TravauxParseIssue[] = [];
  let doublons = 0;

  for (let index = headerIndex + 1; index < matrix.length; index += 1) {
    const row = matrix[index] ?? [];
    if (row.every((cell) => text(cell) === null)) continue;
    const raw: Raw = {};
    headers.forEach((key, column) => { if (key) raw[key] = row[column]; });
    const numero = text(raw["numero_commande"]);
    const hasMappedValue = headers.some((key, column) => key && text(row[column]) !== null);
    if (!numero) {
      if (hasMappedValue) erreurs.push({ line: index + 1, numero_commande: null, message: "Numéro de commande manquant" });
      continue;
    }
    const commande = Object.fromEntries([
      "numero_commande", "secteur", "tranche_code", "charge_clientele", "adresse", "nature_analytique", "corps_etat",
      "charge_operation", "ligne_budget", "descriptif", "budget", "numero_fournisseur", "fournisseur", "etat_commande",
      "engage", "ecart", "paye", "solde", "etat_travaux", "date_demarrage", "date_fin_travaux", "observations",
      "support_communication", "date_communication",
    ].map((key) => [key, null])) as unknown as CommandeTravaux;
    for (const key of Object.values(headerAliases)) {
      const value = raw[key];
      commande[key] = (moneyFields.has(key) ? number(value) : dateFields.has(key) ? date(value) : text(value)) as never;
    }
    commande.numero_commande = numero;
    commande.lot_code = null;
    commande.batiment = null;
    const previous = commandes.get(numero);
    if (previous) {
      doublons += 1;
      if (JSON.stringify(previous) !== JSON.stringify(commande)) conflictos(conflits, index + 1, numero);
      continue;
    }
    commandes.set(numero, commande);
  }
  return { commandes: [...commandes.values()], lignes: matrix.length - headerIndex - 1, doublons, conflits, erreurs };
}

function conflictos(issues: TravauxParseIssue[], line: number, numero: string) {
  issues.push({ line, numero_commande: numero, message: "Doublon avec des valeurs différentes" });
}

export const TRAVAUX_FIELDS = [
  "secteur", "tranche_code", "charge_clientele", "adresse", "nature_analytique", "corps_etat", "charge_operation", "ligne_budget",
  "descriptif", "budget", "numero_fournisseur", "fournisseur", "etat_commande", "engage", "ecart", "paye", "solde", "etat_travaux",
  "date_demarrage", "date_fin_travaux", "observations", "support_communication", "date_communication", "lot_code", "batiment",
  "annee_exercice", "classification_programmation", "classification_secteur",
] as const;
