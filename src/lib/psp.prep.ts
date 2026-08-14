/**
 * PSP — Module « Préparation PSP » (prototype V1).
 *
 * PROTOTYPE UI : données MOCK, aucun accès Supabase, aucune écriture en base.
 * Ce module est PUR (pas de React, pas d'alias `@/`) : testable en Node
 * (type stripping) et remplaçable à l'identique par les vraies données
 * Supabase plus tard (sources futures : fichiers de programmation Secteur 11,
 * tables psp_*, travaux_commandes).
 *
 * Contrat de conception :
 *  - les totaux sont TOUJOURS calculés, jamais saisis ;
 *  - aucune valeur affichée n'est modifiée : seul le formatage vit côté UI ;
 *  - les champs sont en snake_case pour un branchement Supabase direct.
 */

// ── Constantes de programmation ─────────────────────────────────────────────

/** Années couvertes par la programmation pluriannuelle (2027 → 2031). */
export const PSP_ANNEES = [2027, 2028, 2029, 2030, 2031] as const;
export type PspAnnee = (typeof PSP_ANNEES)[number];

/** Secteur patrimonial (GE / GT / CP). */
export const PSP_SECTEURS = ["GE", "GT", "CP"] as const;
export type PspSecteur = (typeof PSP_SECTEURS)[number];

/**
 * Enveloppe budgétaire annuelle disponible (mock V1).
 * « Budget disponible » = somme des enveloppes ; « Écart disponible » =
 * disponible − programmé. À remplacer par la vraie dotation budgétaire.
 */
export const PSP_BUDGET_DISPONIBLE_PAR_ANNEE: Record<string, number> = {
  "2027": 3_200_000,
  "2028": 3_200_000,
  "2029": 3_200_000,
  "2030": 3_200_000,
  "2031": 3_200_000,
};

// ── Types ───────────────────────────────────────────────────────────────────

/** Devis d'une opération (mock V1 : entreprise + montant). */
export type PspDevis = {
  entreprise: string;
  montant: number;
  remarque: string | null;
};

/**
 * Opération programmée.
 * `programme` : montants par année — clé = "2027"…"2031" (0 si non programmé).
 * `reportee` : opération issue de l'ancienne programmation (ex. 2026).
 * `budget`   : enveloppe totale de l'opération (recalculée si non fournie).
 */
export type PspOperation = {
  id: string;
  annee: PspAnnee;
  tranche: string;
  charge_clientele: string;
  charge_operation: string;
  secteur: PspSecteur;
  corps_etat_code: string;
  corps_etat: string;
  adresse: string;
  ville: string;
  nature_travaux: string;
  budget: number;
  programme: Record<string, number>;
  remarques: string | null;
  devis: PspDevis[];
  reportee: boolean;
  ancienne_annee: number | null;
  ancien_montant: number | null;
};

/** Ligne de l'ancienne programmation (modal « Ancienne programmation »). */
export type AncienneProgrammationItem = {
  id: string;
  nature_travaux: string;
  adresse: string;
  ville: string;
  tranche: string;
  annee: number;
  montant: number;
};

// ── Calculs purs ────────────────────────────────────────────────────────────

/** Montant d'une opération pour une année donnée (0 si non programmé). */
export const montantAnnee = (op: PspOperation, annee: string | number): number =>
  op.programme[String(annee)] ?? 0;

/** Total programmé d'une opération (somme des 5 années, jamais saisi). */
export const totalOperation = (op: PspOperation): number =>
  PSP_ANNEES.reduce((s, a) => s + montantAnnee(op, a), 0);

/** Somme des montants programmés d'un ensemble d'opérations. */
export const totalProgramme = (ops: PspOperation[]): number =>
  ops.reduce((s, op) => s + totalOperation(op), 0);

/** Somme par année d'un ensemble d'opérations (clé "2027"…"2031"). */
export const sommeParAnnee = (ops: PspOperation[]): Record<string, number> => {
  const result: Record<string, number> = {};
  for (const a of PSP_ANNEES) result[String(a)] = 0;
  for (const op of ops) {
    for (const a of PSP_ANNEES) result[String(a)] = (result[String(a)] ?? 0) + montantAnnee(op, a);
  }
  return result;
};

/** Statistiques d'un groupe d'opérations (totaux calculés automatiquement). */
export type StatsGroupe = {
  nbOperations: number;
  parAnnee: Record<string, number>;
  total: number;
};

export const statsOperations = (ops: PspOperation[]): StatsGroupe => {
  const parAnnee = sommeParAnnee(ops);
  return {
    nbOperations: ops.length,
    parAnnee,
    total: PSP_ANNEES.reduce((s, a) => s + (parAnnee[String(a)] ?? 0), 0),
  };
};

/** Budget disponible total sur la période (mock V1). */
export const budgetDisponibleTotal = (): number =>
  PSP_ANNEES.reduce((s, a) => s + (PSP_BUDGET_DISPONIBLE_PAR_ANNEE[String(a)] ?? 0), 0);

/** KPI globaux du module : disponible / programmé / écart / nb opérations. */
export const kpiGlobal = (ops: PspOperation[]) => {
  const stats = statsOperations(ops);
  const disponible = budgetDisponibleTotal();
  return {
    disponible,
    programme: stats.total,
    ecart: disponible - stats.total,
    nbOperations: stats.nbOperations,
    parAnnee: stats.parAnnee,
  };
};

// ── Regroupements (modes d'affichage) ───────────────────────────────────────

/** Tri métier stable : numériquement pour les tranches, alphabétique sinon. */
const comparerValeurs = (a: string, b: string): number => {
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  return a.localeCompare(b, "fr", { sensitivity: "base" });
};

/** Trie les opérations d'un groupe : année croissante, puis tranche, puis nature. */
const trierOperations = (ops: PspOperation[]): PspOperation[] =>
  [...ops].sort(
    (a, b) =>
      a.annee - b.annee ||
      comparerValeurs(a.tranche, b.tranche) ||
      a.nature_travaux.localeCompare(b.nature_travaux, "fr"),
  );

/** Niveau 2 (par tranche) : chargé de clientèle → opérations. */
export type SousGroupeCharge = {
  charge_clientele: string;
  operations: PspOperation[];
  stats: StatsGroupe;
};

/** Niveau 1 (par tranche) : tranche → chargés de clientèle. */
export type GroupeTranche = {
  tranche: string;
  charges: SousGroupeCharge[];
  stats: StatsGroupe;
};

/** Mode « Par tranche » : TRANCHE → Chargé de clientèle → opérations. */
export const grouperParTranche = (ops: PspOperation[]): GroupeTranche[] => {
  const map = new Map<string, Map<string, PspOperation[]>>();
  for (const op of ops) {
    const parCharge = map.get(op.tranche) ?? new Map<string, PspOperation[]>();
    const liste = parCharge.get(op.charge_clientele) ?? [];
    liste.push(op);
    parCharge.set(op.charge_clientele, liste);
    map.set(op.tranche, parCharge);
  }
  return [...map.entries()]
    .sort(([a], [b]) => comparerValeurs(a, b))
    .map(([tranche, parCharge]) => {
      const charges = [...parCharge.entries()]
        .sort(([a], [b]) => comparerValeurs(a, b))
        .map(([charge_clientele, liste]) => ({
          charge_clientele,
          operations: trierOperations(liste),
          stats: statsOperations(liste),
        }));
      return {
        tranche,
        charges,
        stats: statsOperations(charges.flatMap((c) => c.operations)),
      };
    });
};

/** Niveau 2 (par chargé de clientèle) : tranche → opérations. */
export type SousGroupeTranche = {
  tranche: string;
  operations: PspOperation[];
  stats: StatsGroupe;
};

/** Niveau 1 (par chargé de clientèle) : chargé → tranches. */
export type GroupeChargé = {
  charge_clientele: string;
  tranches: SousGroupeTranche[];
  stats: StatsGroupe;
};

/** Mode « Par chargé de clientèle » : CHARGÉ → Tranche → opérations. */
export const grouperParChargéClientele = (ops: PspOperation[]): GroupeChargé[] => {
  const map = new Map<string, Map<string, PspOperation[]>>();
  for (const op of ops) {
    const parTranche = map.get(op.charge_clientele) ?? new Map<string, PspOperation[]>();
    const liste = parTranche.get(op.tranche) ?? [];
    liste.push(op);
    parTranche.set(op.tranche, liste);
    map.set(op.charge_clientele, parTranche);
  }
  return [...map.entries()]
    .sort(([a], [b]) => comparerValeurs(a, b))
    .map(([charge_clientele, parTranche]) => {
      const tranches = [...parTranche.entries()]
        .sort(([a], [b]) => comparerValeurs(a, b))
        .map(([tranche, liste]) => ({
          tranche,
          operations: trierOperations(liste),
          stats: statsOperations(liste),
        }));
      return {
        charge_clientele,
        tranches,
        stats: statsOperations(tranches.flatMap((t) => t.operations)),
      };
    });
};

// ── Filtres (mode Détail) ───────────────────────────────────────────────────

/** Filtres du tableau Détail (chaîne vide = filtre inactif). */
export type FiltresDetail = {
  q: string;
  secteur: string;
  tranche: string;
  charge_clientele: string;
  corps_etat: string;
  annee: string;
};

export const FILTRES_VIDES: FiltresDetail = {
  q: "",
  secteur: "",
  tranche: "",
  charge_clientele: "",
  corps_etat: "",
  annee: "",
};

/** Normalisation de recherche : majuscules, sans accents, ponctuation → espace. */
const normaliser = (v: string): string =>
  v
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();

/** Applique les filtres du mode Détail (pur, déterministe). */
export const filtrerOperations = (ops: PspOperation[], filtres: FiltresDetail): PspOperation[] => {
  const q = normaliser(filtres.q);
  return ops.filter((op) => {
    if (filtres.secteur && op.secteur !== filtres.secteur) return false;
    if (filtres.tranche && op.tranche !== filtres.tranche) return false;
    if (filtres.charge_clientele && op.charge_clientele !== filtres.charge_clientele) return false;
    if (filtres.corps_etat && op.corps_etat !== filtres.corps_etat) return false;
    if (filtres.annee && montantAnnee(op, filtres.annee) <= 0) return false;
    if (!q) return true;
    const cible = normaliser(
      [
        op.nature_travaux,
        op.adresse,
        op.ville,
        op.corps_etat,
        op.tranche,
        op.charge_clientele,
      ].join(" "),
    );
    return cible.includes(q);
  });
};

/** Colonnes triables du mode Détail (années incluses, pour comparer facilement). */
export type CleTri =
  | "annee"
  | "tranche"
  | "charge_clientele"
  | "secteur"
  | "corps_etat"
  | "adresse"
  | "nature_travaux"
  | "2027"
  | "2028"
  | "2029"
  | "2030"
  | "2031"
  | "total";

/** Valeur numérique comparée pour le tri d'une opération (0 sinon). */
export const valeurTriOperation = (op: PspOperation, cle: CleTri): string | number => {
  if (cle === "total") return totalOperation(op);
  if (cle === "annee") return op.annee;
  if (cle === "secteur") return op.secteur;
  if (cle === "tranche") return op.tranche;
  if (cle === "charge_clientele") return op.charge_clientele;
  if (cle === "corps_etat") return op.corps_etat;
  if (cle === "adresse") return op.adresse;
  if (cle === "nature_travaux") return op.nature_travaux;
  return montantAnnee(op, cle);
};

/** Tri des opérations du mode Détail (pur). */
export const trierOperationsDetail = (
  ops: PspOperation[],
  cle: CleTri,
  asc: boolean,
): PspOperation[] => {
  const result = [...ops];
  result.sort((a, b) => {
    const va = valeurTriOperation(a, cle);
    const vb = valeurTriOperation(b, cle);
    const cmp =
      typeof va === "number" && typeof vb === "number"
        ? va - vb
        : String(va).localeCompare(String(vb), "fr", { numeric: true, sensitivity: "base" });
    return asc ? cmp : -cmp;
  });
  return result;
};

// ── Devis (fiche opération) ─────────────────────────────────────────────────

export type StatsDevis = { min: number; moyenne: number; max: number };

/** Min / moyenne / max d'une liste de devis (toujours calculés, jamais saisis). */
export const statsDevis = (devis: PspDevis[]): StatsDevis | null => {
  if (devis.length === 0) return null;
  const montants = devis.map((d) => d.montant);
  return {
    min: Math.min(...montants),
    moyenne: montants.reduce((s, m) => s + m, 0) / montants.length,
    max: Math.max(...montants),
  };
};

// ── Export CSV (client, aucune écriture serveur) ────────────────────────────

/** Construit le CSV (séparateur « ; » pour Excel FR) des opérations fournies. */
export const construireCsvProgrammation = (ops: PspOperation[]): string => {
  const entete = [
    "Année",
    "Tranche",
    "Chargé clientèle",
    "Secteur",
    "C",
    "Corps d'état",
    "Adresse",
    "Nature des travaux",
    ...PSP_ANNEES.map(String),
    "Total",
  ];
  const cell = (v: string | number): string => `"${String(v).replace(/"/g, '""')}"`;
  const lignes = ops.map((op) =>
    [
      op.annee,
      op.tranche,
      op.charge_clientele,
      op.secteur,
      op.corps_etat_code,
      op.corps_etat,
      `${op.adresse}, ${op.ville}`,
      op.nature_travaux,
      ...PSP_ANNEES.map((a) => String(montantAnnee(op, a))),
      String(totalOperation(op)),
    ]
      .map(cell)
      .join(";"),
  );
  return [entete.map(cell).join(";"), ...lignes].join("\r\n");
};

// ── Données MOCK (prototype V1 — inspirées des fichiers Secteur 11) ─────────

/**
 * Constructeur compact des opérations mock. `programme` = 5 montants pour les
 * années 2027→2031. `budget` est déduit du total programmé si non fourni :
 * les totaux ne sont JAMAIS saisis à la main.
 */
const O = (
  id: string,
  annee: PspAnnee,
  tranche: string,
  charge_clientele: string,
  charge_operation: string,
  secteur: PspSecteur,
  corps_etat_code: string,
  corps_etat: string,
  adresse: string,
  ville: string,
  nature_travaux: string,
  programme: number[],
  extra?: {
    devis?: PspDevis[];
    remarques?: string | null;
    reportee?: boolean;
    ancienne_annee?: number | null;
    ancien_montant?: number | null;
  },
  budget?: number,
): PspOperation => {
  const parAnnee: Record<string, number> = {};
  PSP_ANNEES.forEach((a, i) => {
    parAnnee[String(a)] = programme[i] ?? 0;
  });
  const total = PSP_ANNEES.reduce((s, a) => s + (parAnnee[String(a)] ?? 0), 0);
  return {
    id,
    annee,
    tranche,
    charge_clientele,
    charge_operation,
    secteur,
    corps_etat_code,
    corps_etat,
    adresse,
    ville,
    nature_travaux,
    budget: budget ?? total,
    programme: parAnnee,
    remarques: null,
    devis: [],
    reportee: false,
    ancienne_annee: null,
    ancien_montant: null,
    ...extra,
  };
};

/** Devis typés : entreprise + montant (mock). */
const D = (entreprise: string, montant: number, remarque: string | null = null): PspDevis => ({
  entreprise,
  montant,
  remarque,
});

/** Liste des opérations de la programmation 2027-2031 (mock V1). */
export const PSP_OPERATIONS: PspOperation[] = [
  // ── Tranche 1976 ─────────────────────────────────────────────────────────
  O(
    "op-001",
    2027,
    "1976",
    "ALOTHORE",
    "HALLEL",
    "CP",
    "(d)",
    "(d) Couvertures",
    "3 RUE DE PARIS",
    "COUPVRAY",
    "Réfection toiture",
    [210000, 0, 0, 0, 0],
    {
      devis: [D("Entreprise A", 198500), D("Entreprise B", 214000), D("Entreprise C", 205800)],
      remarques: "Opération reportée de la programmation 2026 (toiture en urgence).",
      reportee: true,
      ancienne_annee: 2026,
      ancien_montant: 170000,
    },
  ),
  O(
    "op-002",
    2027,
    "1976",
    "ALOTHORE",
    "HALLEL",
    "CP",
    "(o)",
    "(o) Plomberie",
    "3 RUE DE PARIS",
    "COUPVRAY",
    "Remplacement colonnes d'évacuation EU/EP",
    [120000, 0, 0, 0, 0],
    { devis: [D("Entreprise A", 114500), D("Entreprise B", 118900)] },
  ),
  O(
    "op-003",
    2027,
    "1976",
    "ALOTHORE",
    "BOUZID",
    "GE",
    "(r)",
    "(r) Ascenseurs",
    "3 RUE DE PARIS",
    "COUPVRAY",
    "Modernisation ascenseurs",
    [105000, 60000, 0, 0, 0],
    {
      devis: [D("Entreprise A", 158000), D("Entreprise B", 149500), D("Entreprise C", 172000)],
      remarques: "Sur 2 ascenseurs ; le 2e passage en 2028.",
    },
  ),
  O(
    "op-004",
    2027,
    "1976",
    "ALOTHORE",
    "HALLEL",
    "GE",
    "(g)",
    "(g) Halls",
    "BOUCLE BELLE JOSEPHINE",
    "MAGNY-LE-HONGRE",
    "Reprise halls d'entrée",
    [40000, 0, 0, 0, 0],
  ),
  O(
    "op-005",
    2027,
    "1976",
    "ALOTHORE",
    "MAHMOUDI",
    "GT",
    "(a)",
    "(a) Maçonnerie",
    "BOUCLE BELLE JOSEPHINE",
    "MAGNY-LE-HONGRE",
    "Reprise maçonnerie soubassements",
    [28000, 0, 0, 0, 0],
  ),
  O(
    "op-006",
    2028,
    "1976",
    "ALOTHORE",
    "HALLEL",
    "CP",
    "(l)",
    "(l) Chauffage",
    "3 RUE DE PARIS",
    "COUPVRAY",
    "Remplacement chaudières",
    [0, 145000, 0, 0, 0],
    { devis: [D("Entreprise A", 138500), D("Entreprise B", 141200), D("Entreprise C", 152000)] },
  ),
  O(
    "op-007",
    2028,
    "1976",
    "ALOTHORE",
    "CARON",
    "GE",
    "(k)",
    "(k) Électricité",
    "3 RUE DE PARIS",
    "COUPVRAY",
    "Mise en sécurité électricité parties communes",
    [0, 52000, 0, 0, 0],
    { devis: [D("Entreprise A", 49500), D("Entreprise B", 51300)] },
  ),
  O(
    "op-008",
    2029,
    "1976",
    "ALOTHORE",
    "HALLEL",
    "GE",
    "(f)",
    "(f) Façades",
    "3 RUE DE PARIS",
    "COUPVRAY",
    "Ravalement façades",
    [0, 0, 240000, 60000, 0],
    { devis: [D("Entreprise A", 285000), D("Entreprise B", 296500), D("Entreprise C", 311000)] },
  ),
  O(
    "op-009",
    2030,
    "1976",
    "ALOTHORE",
    "BOUZID",
    "CP",
    "(i)",
    "(i) Menuiseries",
    "3 RUE DE PARIS",
    "COUPVRAY",
    "Remplacement menuiseries extérieures",
    [0, 0, 0, 190000, 0],
    { devis: [D("Entreprise A", 178000), D("Entreprise B", 185000)] },
  ),
  O(
    "op-010",
    2031,
    "1976",
    "ALOTHORE",
    "MAHMOUDI",
    "CP",
    "(c)",
    "(c) Isolation",
    "3 RUE DE PARIS",
    "COUPVRAY",
    "Isolation toiture sarking",
    [0, 0, 0, 0, 135000],
    { devis: [D("Entreprise A", 129000), D("Entreprise B", 133500)] },
  ),
  O(
    "op-011",
    2027,
    "1976",
    "BAILLY",
    "HALLEL",
    "GT",
    "(d)",
    "(d) Espaces Ext",
    "PARKING AERIEN 1 FILOIRS",
    "DAMMARTIN EN GOELE",
    "Aménagement espaces extérieurs",
    [32000, 0, 0, 0, 0],
  ),
  O(
    "op-012",
    2028,
    "1976",
    "BAILLY",
    "CARON",
    "GE",
    "(j)",
    "(j) Couvertures",
    "PARKING AERIEN 1 FILOIRS",
    "DAMMARTIN EN GOELE",
    "Réfection couverture atelier",
    [0, 68000, 0, 0, 0],
  ),
  O(
    "op-013",
    2030,
    "1976",
    "BAILLY",
    "HALLEL",
    "GE",
    "(k)",
    "(k) Électricité",
    "PARKING AERIEN 1 FILOIRS",
    "DAMMARTIN EN GOELE",
    "Rénovation éclairage communs",
    [0, 0, 0, 21000, 0],
  ),

  // ── Tranche 2086 ─────────────────────────────────────────────────────────
  O(
    "op-014",
    2027,
    "2086",
    "CHARPENTIER",
    "HALLEL",
    "CP",
    "(o)",
    "(o) Plomberie",
    "10 CORNILLES",
    "CHESSY",
    "Remplacement canalisations eau",
    [115000, 40000, 0, 0, 0],
    { devis: [D("Entreprise A", 147000), D("Entreprise B", 151800), D("Entreprise C", 159000)] },
  ),
  O(
    "op-015",
    2027,
    "2086",
    "CHARPENTIER",
    "BOUZID",
    "GE",
    "(r)",
    "(r) Ascenseurs",
    "10 CORNILLES",
    "CHESSY",
    "Remplacement ascenseur",
    [230000, 0, 0, 0, 0],
    {
      devis: [D("Entreprise A", 218500), D("Entreprise B", 224000), D("Entreprise C", 236500)],
      remarques: "Devis en cours — arbitrage entreprise attendu.",
      reportee: true,
      ancienne_annee: 2026,
      ancien_montant: 215000,
    },
  ),
  O(
    "op-016",
    2028,
    "2086",
    "CHARPENTIER",
    "HALLEL",
    "CP",
    "(d)",
    "(d) Couvertures",
    "10 CORNILLES",
    "CHESSY",
    "Reprise étanchéité toiture-terrasse",
    [0, 175000, 0, 0, 0],
    { devis: [D("Entreprise A", 164000), D("Entreprise B", 170500), D("Entreprise C", 181000)] },
  ),
  O(
    "op-017",
    2028,
    "2086",
    "CHARPENTIER",
    "MAHMOUDI",
    "GE",
    "(g)",
    "(g) Halls",
    "10 CORNILLES",
    "CHESSY",
    "Réfection halls et cages d'escalier",
    [0, 74000, 0, 0, 0],
  ),
  O(
    "op-018",
    2029,
    "2086",
    "CHARPENTIER",
    "HALLEL",
    "GE",
    "(k)",
    "(k) Électricité",
    "10 CORNILLES",
    "CHESSY",
    "Rénovation installation électrique",
    [0, 0, 135000, 0, 0],
    { devis: [D("Entreprise A", 128000), D("Entreprise B", 133000)] },
  ),
  O(
    "op-019",
    2030,
    "2086",
    "CHARPENTIER",
    "CARON",
    "CP",
    "(i)",
    "(i) Menuiseries",
    "10 CORNILLES",
    "CHESSY",
    "Remplacement portes palières",
    [0, 0, 0, 82000, 0],
  ),
  O(
    "op-020",
    2027,
    "2086",
    "DUVAL",
    "HALLEL",
    "GT",
    "(a)",
    "(a) Maçonnerie",
    "10 CORNILLES",
    "CHESSY",
    "Reprise maçonnerie garde-corps",
    [24000, 0, 0, 0, 0],
  ),
  O(
    "op-049",
    2027,
    "2086",
    "CHARPENTIER",
    "HALLEL",
    "CP",
    "(e)",
    "(e) Divers",
    "10 CORNILLES",
    "CHESSY",
    "Remplacement grilles de ventilation",
    [58000, 0, 0, 0, 0],
  ),
  O(
    "op-021",
    2031,
    "2086",
    "DUVAL",
    "BOUZID",
    "GE",
    "(f)",
    "(f) Façades",
    "10 CORNILLES",
    "CHESSY",
    "Ravalement façade sud",
    [0, 0, 0, 0, 88000],
  ),

  // ── Tranche 2100 ─────────────────────────────────────────────────────────
  O(
    "op-022",
    2027,
    "2100",
    "ALOTHORE",
    "HALLEL",
    "CP",
    "(l)",
    "(l) Chauffage",
    "2 IMPASSE CALVILLE",
    "VILLENEUVE SAINT DENIS",
    "Modernisation chaufferie collective",
    [95000, 92000, 0, 0, 0],
    { devis: [D("Entreprise A", 178500), D("Entreprise B", 184000), D("Entreprise C", 192500)] },
  ),
  O(
    "op-023",
    2028,
    "2100",
    "ALOTHORE",
    "MAHMOUDI",
    "GE",
    "(m)",
    "(m) Ventilation",
    "2 IMPASSE CALVILLE",
    "VILLENEUVE SAINT DENIS",
    "Mise en place VMC",
    [0, 43000, 0, 0, 0],
  ),
  O(
    "op-024",
    2029,
    "2100",
    "ALOTHORE",
    "HALLEL",
    "CP",
    "(c)",
    "(c) Isolation",
    "2 IMPASSE CALVILLE",
    "VILLENEUVE SAINT DENIS",
    "Isolation thermique des combles",
    [0, 0, 56000, 0, 0],
  ),
  O(
    "op-025",
    2031,
    "2100",
    "ALOTHORE",
    "CARON",
    "GE",
    "(h)",
    "(h) Peinture",
    "2 IMPASSE CALVILLE",
    "VILLENEUVE SAINT DENIS",
    "Peinture des parties communes",
    [0, 0, 0, 0, 26000],
  ),
  O(
    "op-026",
    2027,
    "2100",
    "GRIMALDI",
    "HALLEL",
    "GE",
    "(d)",
    "(d) Couvertures",
    "2 IMPASSE CALVILLE",
    "VILLENEUVE SAINT DENIS",
    "Réfection toiture bâtiment B",
    [180000, 50000, 0, 0, 0],
    {
      devis: [D("Entreprise A", 219000), D("Entreprise B", 227000)],
      reportee: true,
      ancienne_annee: 2026,
      ancien_montant: 148000,
    },
  ),
  O(
    "op-027",
    2028,
    "2100",
    "GRIMALDI",
    "BOUZID",
    "CP",
    "(o)",
    "(o) Plomberie",
    "2 IMPASSE CALVILLE",
    "VILLENEUVE SAINT DENIS",
    "Remplacement chauffe-eau collectifs",
    [0, 61000, 0, 0, 0],
  ),
  O(
    "op-028",
    2030,
    "2100",
    "GRIMALDI",
    "HALLEL",
    "GT",
    "(d)",
    "(d) Espaces Ext",
    "2 IMPASSE CALVILLE",
    "VILLENEUVE SAINT DENIS",
    "Clôtures et portails",
    [0, 0, 0, 35000, 0],
  ),
  O(
    "op-051",
    2030,
    "2100",
    "GRIMALDI",
    "CARON",
    "GE",
    "(m)",
    "(m) Ventilation",
    "2 IMPASSE CALVILLE",
    "VILLENEUVE SAINT DENIS",
    "Reprise VMC sanitaires",
    [0, 0, 0, 62000, 0],
  ),

  // ── Tranche 2178 ─────────────────────────────────────────────────────────
  O(
    "op-029",
    2027,
    "2178",
    "DUVAL",
    "HALLEL",
    "CP",
    "(d)",
    "(d) Couvertures",
    "3H PL THOMAS LE PILLEUR",
    "SERRIS",
    "Réfection toiture",
    [165000, 0, 0, 0, 0],
    { devis: [D("Entreprise A", 157000), D("Entreprise B", 161500), D("Entreprise C", 171000)] },
  ),
  O(
    "op-030",
    2027,
    "2178",
    "DUVAL",
    "CARON",
    "GE",
    "(k)",
    "(k) Électricité",
    "3H PL THOMAS LE PILLEUR",
    "SERRIS",
    "Rénovation éclairage de sécurité",
    [32000, 0, 0, 0, 0],
  ),
  O(
    "op-031",
    2028,
    "2178",
    "DUVAL",
    "HALLEL",
    "GE",
    "(g)",
    "(g) Halls",
    "3H PL THOMAS LE PILLEUR",
    "SERRIS",
    "Réfection des halls",
    [0, 68000, 0, 0, 0],
  ),
  O(
    "op-032",
    2029,
    "2178",
    "DUVAL",
    "MAHMOUDI",
    "CP",
    "(i)",
    "(i) Menuiseries",
    "3H PL THOMAS LE PILLEUR",
    "SERRIS",
    "Remplacement menuiseries",
    [0, 0, 98000, 0, 0],
    { devis: [D("Entreprise A", 92500), D("Entreprise B", 96000)] },
  ),
  O(
    "op-050",
    2029,
    "2178",
    "DUVAL",
    "HALLEL",
    "GE",
    "(f)",
    "(f) Façades",
    "3H PL THOMAS LE PILLEUR",
    "SERRIS",
    "Ravalement façade nord",
    [0, 0, 110000, 0, 0],
    { devis: [D("Entreprise A", 104500), D("Entreprise B", 108900)] },
  ),
  O(
    "op-033",
    2031,
    "2178",
    "DUVAL",
    "BOUZID",
    "GE",
    "(r)",
    "(r) Ascenseurs",
    "3H PL THOMAS LE PILLEUR",
    "SERRIS",
    "Modernisation ascenseurs (contrôles)",
    [0, 0, 0, 0, 72000],
  ),
  O(
    "op-034",
    2029,
    "2178",
    "BAILLY",
    "HALLEL",
    "GT",
    "(a)",
    "(a) Maçonnerie",
    "3H PL THOMAS LE PILLEUR",
    "SERRIS",
    "Reprise soubassements",
    [0, 0, 38000, 0, 0],
  ),
  O(
    "op-035",
    2030,
    "2178",
    "BAILLY",
    "CARON",
    "CP",
    "(l)",
    "(l) Chauffage",
    "3H PL THOMAS LE PILLEUR",
    "SERRIS",
    "Remplacement chaudières",
    [0, 0, 0, 135000, 0],
    { devis: [D("Entreprise A", 128000), D("Entreprise B", 131500), D("Entreprise C", 139000)] },
  ),

  // ── Tranche 2217 ─────────────────────────────────────────────────────────
  O(
    "op-036",
    2027,
    "2217",
    "CHARPENTIER",
    "HALLEL",
    "CP",
    "(c)",
    "(c) Isolation",
    "10 BIS RUE D'ORSOY",
    "VARREDDES",
    "Isolation des murs ITE",
    [195000, 120000, 0, 0, 0],
    {
      devis: [D("Entreprise A", 301000), D("Entreprise B", 309500), D("Entreprise C", 322000)],
      remarques: "ITE partielle façade nord ; façade sud à chiffrer.",
    },
  ),
  O(
    "op-037",
    2028,
    "2217",
    "CHARPENTIER",
    "BOUZID",
    "GE",
    "(f)",
    "(f) Façades",
    "10 BIS RUE D'ORSOY",
    "VARREDDES",
    "Ravalement façades",
    [0, 130000, 40000, 0, 0],
    { devis: [D("Entreprise A", 162000), D("Entreprise B", 168500)] },
  ),
  O(
    "op-038",
    2030,
    "2217",
    "CHARPENTIER",
    "HALLEL",
    "GE",
    "(m)",
    "(m) Ventilation",
    "10 BIS RUE D'ORSOY",
    "VARREDDES",
    "Reprise ventilation collective",
    [0, 0, 0, 46000, 0],
  ),
  O(
    "op-039",
    2031,
    "2217",
    "CHARPENTIER",
    "MAHMOUDI",
    "CP",
    "(o)",
    "(o) Plomberie",
    "10 BIS RUE D'ORSOY",
    "VARREDDES",
    "Remplacement colonnes",
    [0, 0, 0, 0, 84000],
  ),

  // ── Tranche 3049 ─────────────────────────────────────────────────────────
  O(
    "op-040",
    2027,
    "3049",
    "GRIMALDI",
    "HALLEL",
    "GE",
    "(g)",
    "(g) Halls",
    "12 RUE GAMBETTA",
    "MEAUX",
    "Réfection halls d'entrée",
    [36000, 0, 0, 0, 0],
  ),
  O(
    "op-041",
    2028,
    "3049",
    "GRIMALDI",
    "CARON",
    "GE",
    "(k)",
    "(k) Électricité",
    "12 RUE GAMBETTA",
    "MEAUX",
    "Mise en conformité SSI",
    [0, 58000, 0, 0, 0],
    { devis: [D("Entreprise A", 54900), D("Entreprise B", 56600)] },
  ),
  O(
    "op-042",
    2029,
    "3049",
    "GRIMALDI",
    "HALLEL",
    "CP",
    "(d)",
    "(d) Couvertures",
    "12 RUE GAMBETTA",
    "MEAUX",
    "Reprise étanchéité",
    [0, 0, 92000, 0, 0],
    { devis: [D("Entreprise A", 86500), D("Entreprise B", 90500), D("Entreprise C", 94000)] },
  ),
  O(
    "op-043",
    2030,
    "3049",
    "GRIMALDI",
    "BOUZID",
    "CP",
    "(i)",
    "(i) Menuiseries",
    "12 RUE GAMBETTA",
    "MEAUX",
    "Remplacement fenêtres caves",
    [0, 0, 0, 29000, 0],
  ),
  O(
    "op-044",
    2027,
    "3049",
    "ALOTHORE",
    "MAHMOUDI",
    "GT",
    "(d)",
    "(d) Espaces Ext",
    "12 RUE GAMBETTA",
    "MEAUX",
    "Réfection allées et parkings",
    [45000, 30000, 0, 0, 0],
  ),
  O(
    "op-045",
    2031,
    "3049",
    "ALOTHORE",
    "HALLEL",
    "GE",
    "(h)",
    "(h) Peinture",
    "12 RUE GAMBETTA",
    "MEAUX",
    "Peinture cages d'escalier",
    [0, 0, 0, 0, 22000],
  ),

  // ── Tranche 3329 ─────────────────────────────────────────────────────────
  O(
    "op-046",
    2027,
    "3329",
    "DUVAL",
    "HALLEL",
    "CP",
    "(o)",
    "(o) Plomberie",
    "14 RUE DE LA LIBERTE",
    "OTHIS",
    "Remplacement canalisations",
    [85000, 0, 0, 0, 0],
    { devis: [D("Entreprise A", 80800), D("Entreprise B", 84200)] },
  ),
  O(
    "op-047",
    2029,
    "3329",
    "DUVAL",
    "CARON",
    "GE",
    "(r)",
    "(r) Ascenseurs",
    "14 RUE DE LA LIBERTE",
    "OTHIS",
    "Maintenance lourde ascenseurs",
    [0, 0, 66000, 0, 0],
  ),
  O(
    "op-048",
    2031,
    "3329",
    "DUVAL",
    "BOUZID",
    "GT",
    "(a)",
    "(a) Maçonnerie",
    "14 RUE DE LA LIBERTE",
    "OTHIS",
    "Reprise maçonnerie balcons",
    [0, 0, 0, 0, 46000],
  ),
];

/** Ancienne programmation (mock) : lignes visibles dans la modal « Ancienne programmation ». */
export const ANCIENNE_PROGRAMMATION: AncienneProgrammationItem[] = [
  {
    id: "anc-001",
    nature_travaux: "Réfection toiture",
    adresse: "3 RUE DE PARIS",
    ville: "COUPVRAY",
    tranche: "1976",
    annee: 2026,
    montant: 35000,
  },
  {
    id: "anc-002",
    nature_travaux: "Remplacement ascenseur",
    adresse: "10 CORNILLES",
    ville: "CHESSY",
    tranche: "2086",
    annee: 2026,
    montant: 215000,
  },
  {
    id: "anc-003",
    nature_travaux: "Reprise étanchéité toiture-terrasse",
    adresse: "2 IMPASSE CALVILLE",
    ville: "VILLENEUVE SAINT DENIS",
    tranche: "2100",
    annee: 2026,
    montant: 120000,
  },
  {
    id: "anc-004",
    nature_travaux: "Remplacement chaudières",
    adresse: "3H PL THOMAS LE PILLEUR",
    ville: "SERRIS",
    tranche: "2178",
    annee: 2026,
    montant: 95000,
  },
  {
    id: "anc-005",
    nature_travaux: "Ravalement façades",
    adresse: "10 BIS RUE D'ORSOY",
    ville: "VARREDDES",
    tranche: "2217",
    annee: 2026,
    montant: 148000,
  },
  {
    id: "anc-006",
    nature_travaux: "Remplacement menuiseries",
    adresse: "14 RUE DE LA LIBERTE",
    ville: "OTHIS",
    tranche: "3329",
    annee: 2026,
    montant: 78000,
  },
];
