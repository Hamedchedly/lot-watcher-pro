// Tests de non-régression — module « Préparation PSP » (src/lib/psp.prep.ts)
// Exécution : node scripts/test-psp-prep.mjs
// Node 24 importe directement les fichiers TypeScript (type stripping).
import {
  PSP_ANNEES,
  PSP_BUDGET_DISPONIBLE_PAR_ANNEE,
  PSP_OPERATIONS,
  ANCIENNE_PROGRAMMATION,
  budgetDisponibleTotal,
  construireCsvProgrammation,
  filtrerOperations,
  grouperParChargéClientele,
  grouperParTranche,
  kpiGlobal,
  montantAnnee,
  statsDevis,
  totalOperation,
  trierOperationsDetail,
} from "../src/lib/psp.prep.ts";

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

// ── 1. Volume et cohérence interne des données mock ────────────────────────
assert("≥ 40 opérations mock", PSP_OPERATIONS.length >= 40, `(${PSP_OPERATIONS.length})`);
assert("≥ 5 tranches distinctes", new Set(PSP_OPERATIONS.map((o) => o.tranche)).size >= 5);
assert(
  "≥ 4 chargés clientèle distincts",
  new Set(PSP_OPERATIONS.map((o) => o.charge_clientele)).size >= 4,
);
assert("≥ 3 secteurs GE/GT/CP présents", new Set(PSP_OPERATIONS.map((o) => o.secteur)).size === 3);

const incohérents = PSP_OPERATIONS.filter((o) => totalOperation(o) !== o.budget);
assert(
  "budget === total programmé pour chaque opération",
  incohérents.length === 0,
  incohérents.map((o) => o.id).join(","),
);

const négatifs = PSP_OPERATIONS.flatMap((o) =>
  PSP_ANNEES.filter((a) => montantAnnee(o, a) < 0).map((a) => `${o.id}/${a}`),
);
assert("aucun montant négatif", négatifs.length === 0, négatifs.join(","));

// ── 2. KPI globaux ─────────────────────────────────────────────────────────
const kpi = kpiGlobal(PSP_OPERATIONS);
assert(
  "KPI : écart disponible = disponible − programmé",
  kpi.ecart === kpi.disponible - kpi.programme,
);
assert("KPI : écart strictement positif (marge disponible)", kpi.ecart > 0, `écart = ${kpi.ecart}`);
assert(
  "KPI : budget disponible = somme des enveloppes annuelles",
  kpi.disponible === budgetDisponibleTotal(),
);
assert("KPI : nb opérations > 40", kpi.nbOperations > 40, `nb = ${kpi.nbOperations}`);

const annéeProgrammée = PSP_ANNEES.filter((a) => (kpi.parAnnee[String(a)] ?? 0) > 0);
assert("chaque année 2027-2031 a un programme > 0", annéeProgrammée.length === 5);
for (const a of PSP_ANNEES) {
  const prog = kpi.parAnnee[String(a)] ?? 0;
  const dispo = PSP_BUDGET_DISPONIBLE_PAR_ANNEE[String(a)] ?? 0;
  assert(`année ${a} : programme < disponible`, prog < dispo, `${prog} >= ${dispo}`);
}

// ── 3. Regroupements — mode « Par tranche » ────────────────────────────────
const parTranche = grouperParTranche(PSP_OPERATIONS);
assert("mode tranche : au moins 5 groupes", parTranche.length >= 5);
assert(
  "mode tranche : tri ascendant des tranches",
  parTranche.every((g, i) => i === 0 || Number(parTranche[i - 1].tranche) < Number(g.tranche)),
);
const opsTranche = parTranche.reduce((s, g) => s + g.stats.nbOperations, 0);
assert(
  "mode tranche : total opérations conservé",
  opsTranche === PSP_OPERATIONS.length,
  `${opsTranche} != ${PSP_OPERATIONS.length}`,
);
const chargesTranche = parTranche.flatMap((g) => g.charges);
assert("mode tranche : au moins 1 sous-groupe chargé clientèle", chargesTranche.length >= 1);
const opsCharges = chargesTranche.reduce((s, c) => s + c.stats.nbOperations, 0);
assert("mode tranche : sous-groupes = total opérations", opsCharges === PSP_OPERATIONS.length);
const totalGroupes = parTranche.reduce((s, g) => s + g.stats.total, 0);
assert(
  "mode tranche : somme groupes === programme total",
  totalGroupes === kpi.programme,
  `${totalGroupes} != ${kpi.programme}`,
);

// ── 4. Regroupements — mode « Par chargé de clientèle » ────────────────────
const parChargé = grouperParChargéClientele(PSP_OPERATIONS);
assert("mode chargé : au moins 4 groupes", parChargé.length >= 4);
assert(
  "mode chargé : tri ascendant des chargés",
  parChargé.every(
    (g, i) =>
      i === 0 || parChargé[i - 1].charge_clientele.localeCompare(g.charge_clientele, "fr") <= 0,
  ),
);
const opsChargé = parChargé.reduce((s, g) => s + g.stats.nbOperations, 0);
assert("mode chargé : total opérations conservé", opsChargé === PSP_OPERATIONS.length);
const opsTranchesDeChargé = parChargé
  .flatMap((g) => g.tranches)
  .reduce((s, t) => s + t.stats.nbOperations, 0);
assert(
  "mode chargé : sous-groupes = total opérations",
  opsTranchesDeChargé === PSP_OPERATIONS.length,
);

// ── 5. Filtres (mode Détail) ───────────────────────────────────────────────
const filtreVide = {
  q: "",
  secteur: "",
  tranche: "",
  charge_clientele: "",
  corps_etat: "",
  annee: "",
};
const ge = filtrerOperations(PSP_OPERATIONS, { ...filtreVide, secteur: "GE" });
assert(
  "filtre secteur GE : uniquement des GE",
  ge.length > 0 && ge.every((o) => o.secteur === "GE"),
);
const tr1976 = filtrerOperations(PSP_OPERATIONS, { ...filtreVide, tranche: "1976" });
assert(
  "filtre tranche 1976 : uniquement 1976",
  tr1976.length > 0 && tr1976.every((o) => o.tranche === "1976"),
);
const an2028 = filtrerOperations(PSP_OPERATIONS, { ...filtreVide, annee: "2028" });
assert("filtre année 2028 : au moins 1 opération", an2028.length > 0);
assert(
  "filtre année 2028 : chaque op a du montant en 2028",
  an2028.every((o) => montantAnnee(o, 2028) > 0),
);
const recherche = filtrerOperations(PSP_OPERATIONS, { ...filtreVide, q: "toiture" });
assert("recherche « toiture » : résultats non vides", recherche.length > 0);

// ── 6. Tri (mode Détail) ───────────────────────────────────────────────────
const triMontant = trierOperationsDetail(PSP_OPERATIONS, "total", false);
assert(
  "tri total DESC : premier >= dernier",
  triMontant[0].budget >= triMontant[triMontant.length - 1].budget,
);
const triAnnee = trierOperationsDetail(PSP_OPERATIONS, "annee", true);
assert("tri année ASC : 2027 en tête", triAnnee[0].annee === 2027);

// ── 7. Devis ───────────────────────────────────────────────────────────────
const avecDevis = PSP_OPERATIONS.filter((o) => o.devis.length >= 2);
assert("≥ 10 opérations avec devis", avecDevis.length >= 10, `(${avecDevis.length})`);
const stats = statsDevis(avecDevis[0].devis);
assert("statsDevis : min/moy/max calculés", stats !== null);
if (stats) {
  const montants = avecDevis[0].devis.map((d) => d.montant);
  assert("statsDevis : min exact", stats.min === Math.min(...montants));
  assert("statsDevis : max exact", stats.max === Math.max(...montants));
  assert(
    "statsDevis : moyenne exacte",
    Math.abs(stats.moyenne - montants.reduce((s, m) => s + m, 0) / montants.length) < 0.001,
  );
}

// ── 8. Opérations reportées ────────────────────────────────────────────────
const reportées = PSP_OPERATIONS.filter((o) => o.reportee);
assert("≥ 3 opérations reportées", reportées.length >= 3, `(${reportées.length})`);
assert(
  "reportées : ancienne_annee renseignée",
  reportées.every((o) => o.ancienne_annee !== null && o.ancien_montant !== null),
);

// ── 9. Ancienne programmation ──────────────────────────────────────────────
assert("ancienne programmation : ≥ 5 lignes", ANCIENNE_PROGRAMMATION.length >= 5);

// ── 10. Export CSV ─────────────────────────────────────────────────────────
const csv = construireCsvProgrammation(PSP_OPERATIONS.slice(0, 3));
const lignesCsv = csv.split("\r\n");
assert("CSV : 1 en-tête + 3 lignes", lignesCsv.length === 4);
assert(
  "CSV : en-tête contient les années",
  ["2027", "2031", "Total"].every((h) => lignesCsv[0].includes(h)),
);

// ── 11. Contrat des types (remplaçables Supabase) ──────────────────────────
const première = PSP_OPERATIONS[0];
assert(
  "opération : champs requis renseignés",
  Boolean(première && typeof première.id === "string" && typeof première.budget === "number"),
);
const avecRemarque = PSP_OPERATIONS.find((o) => o.remarques !== null);
assert("au moins une opération avec remarques", Boolean(avecRemarque));

console.log(`\nRésultat : ${passed} PASS, ${failed} FAIL`);
process.exit(failed === 0 ? 0 : 1);
