// Tests Dashboard Travaux — état métier, « Pas réalisé » et filtre État (logique pure)
// Exécution : node scripts/test-dashboard-travaux.mjs
import {
  isPasRealise,
  etatMetier,
  ETATS_METIER,
  exerciceCourant,
} from "../src/lib/travaux.ts";

let passed = 0;
let failed = 0;

function assert(name, cond, detail = "") {
  if (cond) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const EX = 2026;
const cmd = (annee, paye, etatTravaux = null, etatCommande = null) => ({
  annee_exercice: annee,
  paye,
  etat_travaux: etatTravaux,
  etat_commande: etatCommande,
});

// ---- 1-6 : règle « Pas réalisé » ----
assert("1  2026 + paye=0      → false", isPasRealise(cmd(2026, 0), EX) === false);
assert("2  2026 + paye=NULL   → false", isPasRealise(cmd(2026, null), EX) === false);
assert("3  2025 + paye=0      → true", isPasRealise(cmd(2025, 0), EX) === true);
assert("4  2025 + paye=NULL   → true", isPasRealise(cmd(2025, null), EX) === true);
assert("5  2024 + paye=0      → true", isPasRealise(cmd(2024, 0), EX) === true);
assert("6  2024 + paye=NULL   → true", isPasRealise(cmd(2024, null), EX) === true);

// ---- 7 : paye > 0 → jamais ----
assert("7  paye>0 (2025)      → false", isPasRealise(cmd(2025, 500), EX) === false);
assert("7b paye>0 (2026)      → false", isPasRealise(cmd(2026, 500), EX) === false);

// ---- 8 : report 2025 → 2026 (annee=2026) paye=0 → false ----
assert("8  report 2026 paye=0 → false", isPasRealise(cmd(2026, 0), EX) === false);

// ---- 9 : exerciceCourant injectable ----
assert(
  "9  exerciceCourant(2027-03-01) → 2027",
  exerciceCourant(new Date("2027-03-01T00:00:00Z")) === 2027,
);

// ---- 10 : annee NULL / undefined → false ----
assert("10 annee NULL          → false", isPasRealise(cmd(null, 0), EX) === false);
assert("10b annee undefined    → false", isPasRealise(cmd(undefined, 0), EX) === false);

// ---- 11 : année future + paye 0 → false ----
assert("11 2030 + paye=0       → false", isPasRealise(cmd(2030, 0), EX) === false);

// ---- 12 : valeurs parasites (dates/montants) exclues ----
assert("12 etatMetier montant  → Autre", etatMetier(cmd(2026, 100, null, "2235.32"), EX) === "Autre");
assert("12b etatMetier date    → Autre", etatMetier(cmd(2026, 100, "19.05.2025", null), EX) === "Autre");
assert("12c '2235.32' hors whitelist", !ETATS_METIER.includes("2235.32"));
assert("12d '19.05.2025' hors whitelist", !ETATS_METIER.includes("19.05.2025"));

// ---- etatMetier : états réels conservés ----
assert("etatMetier Terminés        → Terminés", etatMetier(cmd(2026, 100, "Terminés", null), EX) === "Terminés");
assert("etatMetier Planifiés       → Planifiés", etatMetier(cmd(2026, 100, "Planifiés", null), EX) === "Planifiés");
assert("etatMetier Close           → Close", etatMetier(cmd(2026, 100, null, "Close"), EX) === "Close");
assert("etatMetier Attente validation → Attente validation", etatMetier(cmd(2026, 100, null, "Attente validation"), EX) === "Attente validation");
assert("etatMetier Annulée         → Annulée", etatMetier(cmd(2026, 100, null, "Annulée"), EX) === "Annulée");
assert(
  "etatMetier Pas réalisé prioritaire",
  etatMetier(cmd(2025, 0, "Terminés", null), EX) === "Pas réalisé",
);

// ---- Options du filtre État (équivalent dashboard etatOptions) ----
const buildEtatOptions = (commandes, exercice) => {
  const found = new Set(commandes.map((c) => etatMetier(c, exercice)));
  return ETATS_METIER.filter((s) => found.has(s));
};
const sample = [
  cmd(2026, 100, "Terminés", null),
  cmd(2026, 0, "Terminés", null),
  cmd(2025, 0, null, null),
  cmd(2026, 100, null, "2235.32"),
  cmd(2026, 100, "19.05.2025", null),
];
const opts = buildEtatOptions(sample, EX);
assert("options contient Terminés", opts.includes("Terminés"));
assert("options contient Pas réalisé", opts.includes("Pas réalisé"));
assert("options : aucun montant/date parasite", !opts.some((o) => /[0-9]/.test(o)));

console.log("\n==========================================");
console.log(`Résultat : ${passed} PASS, ${failed} FAIL`);
console.log("==========================================");
process.exit(failed > 0 ? 1 : 0);
