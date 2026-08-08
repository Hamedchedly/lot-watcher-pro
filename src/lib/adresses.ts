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
};

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
  const others = loadRecents().filter(
    (r) => !(r.rue === entry.rue && r.ville === entry.ville),
  );
  const next = [{ ...entry, at: Date.now() }, ...others].slice(0, 5);
  window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
}
