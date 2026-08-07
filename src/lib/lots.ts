export type StatutTravaux = "realise" | "planifie" | "a_prevoir";

export type Travail = {
  id: string;
  libelle: string;
  statut: StatutTravaux;
  date: string; // ISO yyyy-mm-dd
  cout: number;
  note: string;
};

export type Lot = {
  id: string;
  tranche: string;
  copro: string;
  batiment: string;
  entree: string;
  numeroLot: string;
  designation: string;
  travaux: Travail[];
};

export const STATUT_LABELS: Record<StatutTravaux, string> = {
  realise: "Réalisé",
  planifie: "Planifié",
  a_prevoir: "À prévoir",
};

const STORAGE_KEY = "gestion-lots-v1";

export const uid = () => Math.random().toString(36).slice(2, 10);

/** Ordre métier : tranche → copro → bâtiment → entrée → numéro de lot. */
const collator = new Intl.Collator("fr", { numeric: true, sensitivity: "base" });

export function compareLots(a: Lot, b: Lot): number {
  return (
    collator.compare(a.tranche, b.tranche) ||
    collator.compare(a.copro, b.copro) ||
    collator.compare(a.batiment, b.batiment) ||
    collator.compare(a.entree, b.entree) ||
    collator.compare(a.numeroLot, b.numeroLot)
  );
}

export type LotStats = {
  realises: number;
  planifies: number;
  aPrevoir: number;
  coutRealise: number;
  coutAVenir: number;
  prochaine: Travail | null;
};

export function statsLot(lot: Lot): LotStats {
  const realises = lot.travaux.filter((t) => t.statut === "realise");
  const planifies = lot.travaux.filter((t) => t.statut === "planifie");
  const aPrevoir = lot.travaux.filter((t) => t.statut === "a_prevoir");
  const prochaine =
    [...planifies].sort((x, y) => collator.compare(x.date, y.date))[0] ?? aPrevoir[0] ?? null;
  return {
    realises: realises.length,
    planifies: planifies.length,
    aPrevoir: aPrevoir.length,
    coutRealise: realises.reduce((s, t) => s + (t.cout || 0), 0),
    coutAVenir: [...planifies, ...aPrevoir].reduce((s, t) => s + (t.cout || 0), 0),
    prochaine,
  };
}

export const formatEuro = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

export const formatDate = (d: string) =>
  d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export function loadLots(): Lot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedLots();
    const parsed = JSON.parse(raw) as Lot[];
    return Array.isArray(parsed) ? parsed : seedLots();
  } catch {
    return seedLots();
  }
}

export function saveLots(lots: Lot[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lots));
}

function mk(
  tranche: string,
  copro: string,
  batiment: string,
  entree: string,
  numeroLot: string,
  designation: string,
  travaux: Array<Omit<Travail, "id">>,
): Lot {
  return {
    id: uid(),
    tranche,
    copro,
    batiment,
    entree,
    numeroLot,
    designation,
    travaux: travaux.map((t) => ({ ...t, id: uid() })),
  };
}

function seedLots(): Lot[] {
  return [
    mk("T1", "COPRO-014", "A", "E1", "0101", "Appartement T3", [
      { libelle: "Remplacement menuiseries", statut: "realise", date: "2025-03-12", cout: 8400, note: "Double vitrage" },
      { libelle: "Réfection salle d'eau", statut: "planifie", date: "2026-09-15", cout: 6200, note: "" },
    ]),
    mk("T1", "COPRO-014", "A", "E1", "0102", "Appartement T2", [
      { libelle: "Mise aux normes électrique", statut: "realise", date: "2024-11-04", cout: 3100, note: "" },
      { libelle: "Peinture parties privatives", statut: "a_prevoir", date: "", cout: 1800, note: "Après départ locataire" },
    ]),
    mk("T1", "COPRO-014", "B", "E1", "0210", "Local commercial", [
      { libelle: "Étanchéité toiture terrasse", statut: "planifie", date: "2026-06-01", cout: 14500, note: "Devis validé" },
    ]),
    mk("T2", "COPRO-027", "A", "E2", "0301", "Appartement T4", [
      { libelle: "Chaudière individuelle", statut: "realise", date: "2025-10-22", cout: 4700, note: "Garantie 5 ans" },
      { libelle: "Ravalement façade cour", statut: "a_prevoir", date: "", cout: 22000, note: "Vote AG à obtenir" },
    ]),
    mk("T2", "COPRO-027", "C", "E1", "0405", "Appartement T1", [
      { libelle: "Isolation combles", statut: "planifie", date: "2026-08-20", cout: 5300, note: "" },
    ]),
    mk("T3", "COPRO-041", "A", "E1", "0502", "Parking couvert", []),
  ];
}
