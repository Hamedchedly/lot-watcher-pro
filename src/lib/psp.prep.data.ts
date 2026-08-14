/**
 * PSP — Adaptateur « vraies données PAT S11 » (V2) — partie PURE.
 *
 * Lecture en LECTURE SEULE des sources existantes (aucune écriture, aucune
 * table, aucune migration) :
 *  - table `tranches`      → localité, sous-secteur, secteur S11, nb logements ;
 *  - table `lots`          → adresse / ville de référence d'un TR ;
 *  - table `travaux_commandes` → chargé de clientèle (mode par TR) + C
 *    (catégorie budgétaire GE/GT/CP).
 *
 * Règles :
 *  - le TR (tranche) est la clé patrimoniale PRIORITAIRE — l'adresse Excel
 *    n'est jamais une clé d'identification ;
 *  - les regroupements s'appuient sur la référence réelle quand elle existe ;
 *  - ce module est PUR (testable en Node) ; la fonction serveur de lecture
 *    Supabase vit dans `psp.prep.data.functions.ts`.
 *
 * Le fichier « esquisse PSP 2027 » est traité comme une SOURCE DE PRÉPARATION :
 * `parseEsquisse2027Workbook` le convertit en `PspOperation[]` sans rien stocker.
 */
import * as XLSX from "xlsx";

import {
  PSP_ANNEES,
  creerOperation,
  totalOperation,
  type PspAnnee,
  type PspCategorie,
  type PspOperation,
} from "./psp.prep.ts";

// ── Types des sources réelles ───────────────────────────────────────────────

export type TrancheRaw = {
  code: string;
  libelle: string | null;
  localite: string | null;
  sous_secteur: string | null;
  secteur: string | null;
  nb_logements: number | null;
};

export type LotRaw = {
  tranche_code: string | null;
  adresse: string | null;
  ville: string | null;
};

export type CommandeRaw = {
  tranche_code: string | null;
  charge_clientele: string | null;
};

/** Référence patrimoniale d'un TR (résolue à partir des vraies données). */
export type TrancheReference = {
  code: string;
  libelle: string | null;
  localite: string | null;
  sous_secteur: string | null;
  secteur: string | null;
  nb_logements: number | null;
  charge_clientele: string | null;
  adresse_reference: string | null;
  ville: string | null;
};

/** Dictionnaire des références réelles indexé par code de TR. */
export type ReferencePatrimoine = {
  tranches: Map<string, TrancheReference>;
  totalTranches: number;
  totalLots: number;
  totalCommandes: number;
};

/** Valeur la plus fréquente d'une liste (mode) — null si aucune valeur non vide. */
const modeDe = (valeurs: Array<string | null>): string | null => {
  const comptes = new Map<string, number>();
  for (const v of valeurs) {
    if (!v || v.trim() === "") continue;
    comptes.set(v, (comptes.get(v) ?? 0) + 1);
  }
  let meilleur: string | null = null;
  let meilleurCompte = 0;
  for (const [v, c] of comptes) {
    if (c > meilleurCompte) {
      meilleur = v;
      meilleurCompte = c;
    }
  }
  return meilleur;
};

/**
 * Construit la référence patrimoniale réelle (pur, sans accès base).
 * - adresse de référence : adresse la plus fréquente des lots du TR ;
 * - ville : ville la plus fréquente des lots du TR, sinon `tranches.localite` ;
 * - chargé de clientèle : charge la plus fréquente des commandes du TR.
 */
export const construireReferencePatrimoine = (
  tranches: TrancheRaw[],
  lots: LotRaw[],
  commandes: CommandeRaw[],
): ReferencePatrimoine => {
  const adressesParTranche = new Map<string, Array<string | null>>();
  const villesParTranche = new Map<string, Array<string | null>>();
  for (const lot of lots) {
    if (!lot.tranche_code) continue;
    const adresses = adressesParTranche.get(lot.tranche_code) ?? [];
    adresses.push(lot.adresse);
    adressesParTranche.set(lot.tranche_code, adresses);
    const villes = villesParTranche.get(lot.tranche_code) ?? [];
    villes.push(lot.ville);
    villesParTranche.set(lot.tranche_code, villes);
  }
  const chargesParTranche = new Map<string, Array<string | null>>();
  for (const c of commandes) {
    if (!c.tranche_code) continue;
    const charges = chargesParTranche.get(c.tranche_code) ?? [];
    charges.push(c.charge_clientele);
    chargesParTranche.set(c.tranche_code, charges);
  }

  const tranchesMap = new Map<string, TrancheReference>();
  for (const t of tranches) {
    const adresseReference = modeDe(adressesParTranche.get(t.code) ?? []);
    const villeLots = modeDe(villesParTranche.get(t.code) ?? []);
    tranchesMap.set(t.code, {
      code: t.code,
      libelle: t.libelle,
      localite: t.localite,
      sous_secteur: t.sous_secteur,
      secteur: t.secteur,
      nb_logements: t.nb_logements,
      charge_clientele: modeDe(chargesParTranche.get(t.code) ?? []),
      adresse_reference: adresseReference,
      ville: villeLots ?? t.localite,
    });
  }

  return {
    tranches: tranchesMap,
    totalTranches: tranchesMap.size,
    totalLots: lots.length,
    totalCommandes: commandes.length,
  };
};

/** Résout la référence réelle d'un TR (ou null si inconnu). */
export const resoudreTranche = (
  reference: ReferencePatrimoine | null,
  code: string,
): TrancheReference | null => {
  if (!reference) return null;
  return reference.tranches.get(code) ?? null;
};

/**
 * Enrichit les opérations avec la référence réelle PAT S11.
 * Quand un TR est connu : CC / adresse de référence / ville / sous-secteur
 * sont alignés sur les vraies données (jamais l'adresse Excel comme clé).
 * Les montants et la programmation restent inchangés.
 */
export const enrichirOperationsAvecReference = (
  ops: PspOperation[],
  reference: ReferencePatrimoine | null,
): PspOperation[] => {
  if (!reference) return ops;
  return ops.map((op) => {
    const ref = reference.tranches.get(op.tranche);
    if (!ref) return op;
    return {
      ...op,
      charge_clientele: ref.charge_clientele ?? op.charge_clientele,
      adresse: ref.adresse_reference ?? op.adresse,
      ville: ref.ville ?? op.ville,
      sous_secteur: ref.sous_secteur,
    };
  });
};

// ── Esquisse PSP 2027 (source de préparation, fichier Excel) ────────────────

export type ResultatEsquisse = {
  operations: PspOperation[];
  lignes: number;
  erreurs: string[];
  source: string;
};

/** Normalise un en-tête : minuscules, sans accents, ponctuation → espace. */
const normaliserEnTete = (v: unknown): string =>
  String(v ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Numérique d'une cellule Excel (texte ou nombre, « 35 000 » ou « 35000 »). */
const numerique = (v: unknown): number => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const texte = String(v ?? "")
    .replace(/[\s\u00a0\u202f€]/g, "")
    .replace(",", ".");
  const n = Number(texte);
  return Number.isFinite(n) ? n : 0;
};

/** Normalise la catégorie budgétaire C (accepte « ge », « GE », « g e »…). */
const normaliserCategorie = (v: unknown): PspCategorie | null => {
  const texte = String(v ?? "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  return texte === "GE" || texte === "GT" || texte === "CP" ? texte : null;
};

/**
 * Parse le fichier « esquisse de programmation 2027 » dans le modèle
 * `PspOperation` — SANS rien stocker en base. Colonnes attendues :
 * TR · Arl/sect · ADRESSE · Ville · C · CORPS D'ETAT · NATURE TRAVAUX ·
 * 2027…2031 · Remarques · devis si existant.
 * C = catégorie budgétaire (GE/GT/CP) — jamais le code corps d'état.
 */
export const parseEsquisse2027Workbook = (
  data: ArrayBuffer,
  fileName = "esquisse-psp-2027.xlsx",
): ResultatEsquisse => {
  const classeur = XLSX.read(data, { type: "array" });
  const feuille = classeur.Sheets[classeur.SheetNames[0] ?? ""];
  const erreurs: string[] = [];
  if (!feuille) {
    return {
      operations: [],
      lignes: 0,
      erreurs: ["Aucune feuille lisible dans le fichier."],
      source: fileName,
    };
  }
  const lignes = XLSX.utils.sheet_to_json<Record<string, unknown>>(feuille, { defval: "" });

  // Résolution des colonnes par en-tête normalisé.
  const enTetes = Object.keys(lignes[0] ?? {});
  const index = (noms: string[]): string | null => {
    for (const nom of noms) {
      const trouve = enTetes.find((e) => normaliserEnTete(e) === nom);
      if (trouve) return trouve;
    }
    return null;
  };
  const colTranche = index(["tr", "tranche"]);
  const colC = index(["c"]);
  const colCorps = index(["corps d etat", "corps etat"]);
  const colNature = index(["nature travaux", "nature des travaux"]);
  const colAdresse = index(["adresse"]);
  const colVille = index(["ville"]);
  const colRemarques = index(["remarques", "remarque"]);

  const operations: PspOperation[] = [];
  lignes.forEach((row, i) => {
    const numero = i + 2; // ligne Excel (1 = en-tête)
    const tranche = String(row[colTranche ?? ""] ?? "").trim();
    if (!tranche) return; // ligne vide

    const categorie = normaliserCategorie(row[colC ?? ""]);
    if (!categorie) {
      erreurs.push(
        `Ligne ${numero} : C invalide (« ${String(row[colC ?? ""])} ») — attendu GE/GT/CP.`,
      );
    }

    const programme = PSP_ANNEES.map((a) => {
      const cle = String(a);
      const col = enTetes.find((e) => normaliserEnTete(e) === cle);
      return col ? numerique(row[col]) : 0;
    });

    const premier = PSP_ANNEES.findIndex(
      (a, i2) => programme[i2] !== undefined && (programme[i2] ?? 0) > 0,
    );
    const annee: PspAnnee = premier >= 0 ? (PSP_ANNEES[premier] ?? 2027) : 2027;

    const operation = creerOperation(
      {
        tranche,
        categorie: categorie ?? "GT",
        charge_clientele: "",
        charge_operation: "",
        corps_etat: String(row[colCorps ?? ""] ?? "").trim() || "—",
        adresse: String(row[colAdresse ?? ""] ?? "").trim(),
        ville: String(row[colVille ?? ""] ?? "").trim(),
        nature_travaux: String(row[colNature ?? ""] ?? "").trim() || "Opération sans nature",
        annee,
        programme,
        remarques: colRemarques ? String(row[colRemarques] ?? "").trim() || null : null,
      },
      `esq-${String(numero).padStart(4, "0")}`,
    );
    operations.push(operation);
  });

  return { operations, lignes: operations.length, erreurs, source: fileName };
};

/** Total programmé d'une liste (rappel pratique pour la comparaison). */
export const totalProgrammeListe = (ops: PspOperation[]): number =>
  ops.reduce((s, op) => s + totalOperation(op), 0);
