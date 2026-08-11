export type LotItem = {
  code_patrimoine: string;
  tranche_code: string;
  type_lot: string | null;
  batiment: string | null;
  etage: string | null;
  porte: string | null;
  surface_utile: number | null;
  dpe: string | null;
  ville: string | null;
  code_postal: string | null;
  adresse: string | null;
  locataire_nom: string | null;
  locataire_telephone?: string | null;
  locataire_email?: string | null;
  date_entree?: string | null;
};

/** Garages, boxes et parkings : code lot en ER.G… ou type PAR/GAR/BOX/MOT. */
export function estGarage(lot: Pick<LotItem, "code_patrimoine" | "type_lot">) {
  if (/^ER\.G/i.test(lot.code_patrimoine)) return true;
  return ["PAR", "GAR", "BOX", "MOT"].includes((lot.type_lot ?? "").toUpperCase());
}

export const collator = new Intl.Collator("fr", { numeric: true, sensitivity: "base" });

/** « 25-27  RUE DE RUZE » → « RUE DE RUZE » : on retire le numéro pour regrouper la rue. */
export function rueDe(adresse: string | null) {
  const a = (adresse ?? "").replace(/\s+/g, " ").trim();
  if (!a) return "Adresse inconnue";
  const m = a.match(/^[\d.\-/]+\s*(BIS|TER|QUATER)?\s+(.*)$/i);
  return (m?.[2] ?? a).trim();
}

export function entreeDe(adresse: string | null) {
  return (adresse ?? "").replace(/\s+/g, " ").trim() || "Entrée inconnue";
}

export const cleAdresse = (adresse: string, ville: string) =>
  `${adresse.replace(/\s+/g, " ").trim()}|${ville.trim()}`.toUpperCase();

export type AdresseParTranche = {
  code: string;
  adresses: { adresse: string; lots: number }[];
  nbAdresses: number;
  nbLots: number;
};

/**
 * Regroupement des adresses par tranche (page /adresses, niveau ville).
 * `tranches` = hiérarchie { codeTranche: { adresse: LotItem[] } } déjà filtrée des garages
 * masqués : une tranche sans adresse visible n'apparaît pas.
 */
export function adressesParTranche(
  tranches: Record<string, Record<string, LotItem[]>>,
): AdresseParTranche[] {
  return Object.entries(tranches)
    .map(([code, rues]) => {
      const adresses = Object.entries(rues).map(([adresse, lots]) => ({
        adresse,
        lots: lots.length,
      }));
      return {
        code,
        adresses,
        nbAdresses: adresses.length,
        nbLots: adresses.reduce((s, a) => s + a.lots, 0),
      };
    })
    .filter((g) => g.nbAdresses > 0);
}

/* ---------- Recherches récentes (local) ---------- */

export type RecentAdresse = { rue: string; ville: string; lots: number; at: number };

const RECENTS_KEY = "patrimoine-recents-v1";

export function loadRecents(): RecentAdresse[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    const parsed = raw ? (JSON.parse(raw) as RecentAdresse[]) : [];
    return Array.isArray(parsed) ? parsed.slice(0, 5) : [];
  } catch {
    return [];
  }
}

export function pushRecent(entry: Omit<RecentAdresse, "at">) {
  if (typeof window === "undefined") return;
  const others = loadRecents().filter((r) => !(r.rue === entry.rue && r.ville === entry.ville));
  const next = [{ ...entry, at: Date.now() }, ...others].slice(0, 5);
  window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
}
