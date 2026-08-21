// ═══════════════════════════════════════════════════════════════════════════════
// V8.11 — NOUVEAU MODÈLE DE SUIVI ANNUEL (ANM_SUIVTRXSECT) : tests PURS.
// Exécution : node scripts/test-psp-v811-modele-anm.mjs
// ═══════════════════════════════════════════════════════════════════════════════
// Points :
//   A. détection automatique du modèle ANM (en-têtes « *.ANA_SUIVTRXSECT ») ;
//   B. mapping ANM → travaux_commandes (budget, engage, paye, solde, corps d'état,
//      TR, nature, adresse, ligne budgétaire, fournisseur, n° commande) ;
//   C. ligne sans n° de commande → « Numéro de commande manquant » (matérialisable) ;
//   D. normalisation des états ANM (« TERMINES » → « Terminés », « PLANIFIES »…) ;
//   E. non-régression du modèle « classique » (No commande + en-têtes groupés) ;
//   F. fichier réel « ANM_SUIVTRXSECT 2026.xlsx » : 73 lignes, budget 333 000 €,
//      engagé 261 080,65 €, 23 lignes sans commande (si présent en local).
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as XLSX from "xlsx";

import { parseTravauxWorkbook } from "../src/lib/travaux.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = (p) => join(__dirname, "..", "src", p);
const fichier = (p) => readFileSync(src(p), "utf8");
const travauxFn = fichier("lib/travaux.ts");

let passed = 0;
let failed = 0;
function check(label, ok, detail = "") {
  if (ok) {
    passed++;
    console.log(`  ✔ ${label}`);
  } else {
    failed++;
    console.error(`  ✘ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

// ── Aide : construire un classeur en mémoire depuis des lignes ────────────────
function parseLignes(rows) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Feuille");
  return parseTravauxWorkbook(XLSX.write(wb, { type: "array", bookType: "xlsx" }));
}

// ════════════ A/B. DÉTECTION + MAPPING DU MODÈLE ANM ═════════════════════════
const anmRows = [
  [
    "B_CMD.ANA_SUIVTRXSECT",
    "COMN_NUM.ANA_SUIVTRXSECT",
    "PATC_N4.ANA_SUIVTRXSECT",
    "STSC_CORPSETAT.ANA_SUIVTRXSECT",
    "STSC_ADRESSE.ANA_SUIVTRXSECT",
    "NAAC_CODE.ANA_SUIVTRXSECT",
    "STSC_DESCTRX.ANA_SUIVTRXSECT",
    "STSN_BUDGET.ANA_SUIVTRXSECT",
    "STSC_LIGNEBUD.ANA_SUIVTRXSECT",
    "STSN_ENGAGE.ANA_SUIVTRXSECT",
    "STSN_PAYE.ANA_SUIVTRXSECT",
    "STSN_SOLDE.ANA_SUIVTRXSECT",
    "STSC_ETATTRX.ANA_SUIVTRXSECT",
    "W_ENTC_EMPLOYEUR.ANA_SUIVTRXSECT",
  ],
  [
    0,
    5063935,
    2292,
    "(h) Cages",
    "RUE RENE MICHEL, CHAUMES-EN-BRIE",
    "GE",
    "REPRISE EN PEINTURE DES CAGES D'ESCALIERS",
    20000,
    547,
    19166.51,
    19166.51,
    0,
    "TERMINES",
    "EVIZIO",
  ],
  [
    0,
    null,
    2086,
    "(o) Plomberie",
    "RUE X, CHELLES",
    "CP",
    "TRAVAUX SUR SDB",
    3000,
    575,
    null,
    null,
    null,
    "",
    null,
  ],
];
const anm = parseLignes(anmRows);
const cmdAnm = anm.commandes[0];
check(
  "A1. détection du modèle ANM (présence d'en-tête ANA_SUIVTRXSECT)",
  travauxFn.includes('cell.includes("ANA_SUIVTRXSECT")') &&
    travauxFn.includes("estModeleAnm") &&
    travauxFn.includes("anmHeaderAliases"),
);
check("B1. n° commande mappé (COMN_NUM → numero_commande)", cmdAnm?.numero_commande === "5063935");
check("B2. budget mappé (STSN_BUDGET → budget)", cmdAnm?.budget === 20000);
check(
  "B3. engagé/payé/solde mappés",
  cmdAnm?.engage === 19166.51 && cmdAnm?.paye === 19166.51 && cmdAnm?.solde === 0,
);
check("B4. corps d'état mappé", cmdAnm?.corps_etat === "(h) Cages");
check("B5. TR mappé (PATC_N4 → tranche_code)", cmdAnm?.tranche_code === "2292");
check("B6. nature analytique mappée (NAAC_CODE)", cmdAnm?.nature_analytique === "GE");
check("B7. adresse mappée", cmdAnm?.adresse === "RUE RENE MICHEL, CHAUMES-EN-BRIE");
check("B8. ligne budgétaire mappée", cmdAnm?.ligne_budget === "547");
check("B9. fournisseur mappé (W_ENTC_EMPLOYEUR)", cmdAnm?.fournisseur === "EVIZIO");
check("B10. état travaux NORMALISÉ (TERMINES → Terminés)", cmdAnm?.etat_travaux === "Terminés");

// ════════════ C. LIGNE SANS N° COMMANDE → « Numéro de commande manquant » ════
const err = anm.sansCommande.find((e) => e.message === "Numéro de commande manquant");
check("C1. ligne sans COMN_NUM → catégorie « sans n° de commande » (non erreur)", !!err);
check(
  "C2. identité portée (TR, corps d'état, nature, budget, ligne budgétaire)",
  err?.tranche_code === "2086" &&
    err?.corps_etat === "(o) Plomberie" &&
    err?.nature_analytique === "CP" &&
    err?.budget === 3000 &&
    err?.ligne_budget === "575",
);
check(
  "C3. une seule commande ; lignes sans commande dans sansCommande (erreurs vides)",
  anm.commandes.length === 1 && anm.sansCommande.length === 1 && anm.erreurs.length === 0,
);

// ════════════ D. NORMALISATION DES ÉTATS ANM ═════════════════════════════════
const etats = parseLignes([
  anmRows[0],
  [0, 1, 1111, null, null, "GT", "A", 1000, 1, 0, 0, 0, "PLANIFIES", "X"],
  [0, 2, 2222, null, null, "GT", "B", 1000, 1, 500, 0, 0, "EN COURS", "X"],
]).commandes;
check(
  "D1. « PLANIFIES » → « Planifiés »",
  etats.find((c) => c.numero_commande === "1")?.etat_travaux === "Planifiés",
);
check(
  "D2. « EN COURS » → « En cours »",
  etats.find((c) => c.numero_commande === "2")?.etat_travaux === "En cours",
);

// ════════════ E. NON-RÉGRESSION MODÈLE CLASSIQUE ═════════════════════════════
const classiqueRows = [
  ["-Société : ER", "-Exercice : 2026", "-Type : secteur", "-Le : 11.08.2026"],
  [
    "Secteur",
    "Tranche",
    "Adresse",
    "Ligne Budget",
    "Descriptif des travaux",
    "Budget",
    null,
    "Suivi budget",
    null,
    null,
    null,
    "Suivi travaux",
    null,
    null,
    null,
    null,
    null,
  ],
  [
    null,
    null,
    null,
    null,
    null,
    null,
    "No commande",
    "No fournisseur",
    "Fournisseur",
    "Etat de la commande",
    "Engagé",
    "Ecart",
    "Payé",
    "Solde",
    "Etat des travaux",
    "Date démarrage",
    "Date fin des travaux",
  ],
  [
    "S11",
    "'2086",
    "AV FRANCOIS MITTERRAND, CHELLES",
    575,
    "TRAVAUX SUR SDB",
    3000,
    5060001,
    8168,
    "EVIZIO",
    null,
    19166.51,
    null,
    19166.51,
    0,
    "Terminés",
    null,
    null,
  ],
];
const classique = parseLignes(classiqueRows);
const cmdCla = classique.commandes[0];
check("E1. modèle classique toujours détecté (No commande)", !!cmdCla);
check(
  "E2. mapping classique intact (n° commande, budget, engagé, état)",
  cmdCla?.numero_commande === "5060001" &&
    cmdCla?.budget === 3000 &&
    cmdCla?.engage === 19166.51 &&
    cmdCla?.etat_travaux === "Terminés",
);
check("E3. TR classique sans apostrophe ('2086 → 2086)", cmdCla?.tranche_code === "2086");

// ════════════ F. FICHIER RÉEL ANM (si présent localement) ═══════════════════
const cheminReel = "C:/Users/Hamed/Downloads/ANM_SUIVTRXSECT 2026.xlsx";
if (existsSync(cheminReel)) {
  const reel = parseTravauxWorkbook(readFileSync(cheminReel));
  const budget = reel.commandes.reduce((s, c) => s + (c.budget || 0), 0);
  const engage = reel.commandes.reduce((s, c) => s + (c.engage || 0), 0);
  const budgetSansCmd = reel.sansCommande.reduce((s, e) => s + (e.budget || 0), 0);
  const sansCmd = reel.sansCommande.length;
  const vraiesErreurs = reel.erreurs.length;
  check(
    "F1. fichier réel : 50 commandes (lignes avec COMN_NUM)",
    reel.commandes.length === 50,
    `got ${reel.commandes.length}`,
  );
  check(
    "F1b. fichier réel : AUCUNE vraie erreur (0 ligne invalide)",
    vraiesErreurs === 0,
    `got ${vraiesErreurs}`,
  );
  check(
    "F2. budget total (commandes + lignes sans commande) = 333 000 €",
    Math.abs(budget + budgetSansCmd - 333000) < 0.01,
    `got ${budget + budgetSansCmd}`,
  );
  check("F2b. budget des commandes = 269 000 €", Math.abs(budget - 269000) < 0.01, `got ${budget}`);
  check("F3. engagé total = 261 080,65 €", Math.abs(engage - 261080.65) < 0.01, `got ${engage}`);
  check("F4. 23 lignes sans n° de commande (à matérialiser)", sansCmd === 23, `got ${sansCmd}`);
} else {
  console.log("  (fichier réel absent — bloc F sauté)");
}

console.log(`\nV8.11 MODÈLE ANM PUR — ${passed} ok / ${failed} échec(s)`);
process.exit(failed === 0 ? 0 : 1);
