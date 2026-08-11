// Tests Dashboard Travaux — état métier, « Pas réalisé » et filtre État (logique pure)
// Exécution : node scripts/test-dashboard-travaux.mjs
import {
  isPasRealise,
  etatMetier,
  ETATS_METIER,
  exerciceCourant,
  repartitionCommandesParSecteur,
  buildDataVilles,
  secteurDe,
  matchVille,
  villeDepuisAdresse,
  visibleArchivage,
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
const cmd = (annee, paye, etatTravaux = null, etatCommande = null, engage = undefined) => ({
  annee_exercice: annee,
  paye,
  etat_travaux: etatTravaux,
  etat_commande: etatCommande,
  engage,
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
assert("12c '2235.32' hors whitelist", !ETATS_METIER.includes("2235.32"));
assert("12d '19.05.2025' hors whitelist", !ETATS_METIER.includes("19.05.2025"));

// =====================================================================
// etatMetier — spécification métier définitive (T1 à T15)
// =====================================================================
// T1 : « Terminés » explicite prioritaire sur les montants (engage=5000, paye=0)
assert("T1 2026 engage=5000 paye=0 Terminés → Terminés", etatMetier(cmd(2026, 0, "Terminés", null, 5000), EX) === "Terminés");
// T2 : « Terminés » explicite + paye NULL
assert("T2 2026 engage=5000 paye=NULL Terminés → Terminés", etatMetier(cmd(2026, null, "Terminés", null, 5000), EX) === "Terminés");
// T3 : engagement sans état → En cours
assert("T3 2026 engage=5000 paye=0 état vide → En cours", etatMetier(cmd(2026, 0, null, null, 5000), EX) === "En cours");
// T4 : engagement + paiement partiel → En cours (règle paye != engage abandonnée)
assert("T4 2026 engage=5000 paye=2000 état vide → En cours", etatMetier(cmd(2026, 2000, null, null, 5000), EX) === "En cours");
// T5 : engagement soldé → En cours (engage != 0, non explicitement terminé)
assert("T5 2026 engage=5000 paye=5000 état vide → En cours", etatMetier(cmd(2026, 5000, null, null, 5000), EX) === "En cours");
// T6 : exercice courant sans engagement ni état → Sans état (plus auto « En cours »)
assert("T6 2026 engage=0 paye=0 état vide → Sans état", etatMetier(cmd(2026, 0, null, null, 0), EX) === "Sans état");
// T7 : exercice courant sans engagement ni état → Sans état
assert("T7 2026 engage=NULL paye=NULL état vide → Sans état", etatMetier(cmd(2026, null, null, null, null), EX) === "Sans état");
// T8 : exercice clôturé + aucun engagement/paiement → Pas réalisé
assert("T8 2025 engage=0 paye=0 état vide → Pas réalisé", etatMetier(cmd(2025, 0, null, null, 0), EX) === "Pas réalisé");
// T9 : exercice clôturé + engagement/paiement NULL → Pas réalisé
assert("T9 2025 engage=NULL paye=NULL état vide → Pas réalisé", etatMetier(cmd(2025, null, null, null, null), EX) === "Pas réalisé");
// T10 : engagement sur exercice clôturé → En cours (et non Pas réalisé)
assert("T10 2025 engage=5000 paye=0 état vide → En cours", etatMetier(cmd(2025, 0, null, null, 5000), EX) === "En cours");
// T11 : « Planifiés » normalisé vers « En cours »
assert("T11 2026 engage=5000 paye=0 Planifiés → En cours", etatMetier(cmd(2026, 0, "Planifiés", null, 5000), EX) === "En cours");
// T12 : état explicite « En cours » conservé
assert("T12 2026 engage=5000 paye=0 En cours → En cours", etatMetier(cmd(2026, 0, "En cours", null, 5000), EX) === "En cours");
// T13 : « Planifiés » sans engagement → En cours (état explicite prime sur les montants)
assert("T13 2026 engage=0 paye=0 Planifiés → En cours", etatMetier(cmd(2026, 0, "Planifiés", null, 0), EX) === "En cours");
// T14 : « Terminés » sur exercice clôturé → Terminés
assert("T14 2025 engage=5000 paye=0 Terminés → Terminés", etatMetier(cmd(2025, 0, "Terminés", null, 5000), EX) === "Terminés");
// T15 : « Attente validation » sans engagement → Attente validation
assert("T15 2025 engage=0 paye=0 Attente validation → Attente validation", etatMetier(cmd(2025, 0, "Attente validation", null, 0), EX) === "Attente validation");

// ---- États explicites restants / normalisations ----
assert("Annulée → Annulée", etatMetier(cmd(2026, 100, null, "Annulée", 5000), EX) === "Annulée");
assert("Close = clôturée → Terminés", etatMetier(cmd(2026, 100, null, "Close", 5000), EX) === "Terminés");
assert("Close + Terminés → Terminés", etatMetier(cmd(2025, 0, "Terminés", "Close", 0), EX) === "Terminés");

// ---- « Planifiés » / « Close » ne sont plus des états distincts ----
assert("Planifiés hors ETATS_METIER", !ETATS_METIER.includes("Planifiés"));
assert("Close hors ETATS_METIER", !ETATS_METIER.includes("Close"));

// ---- KPI « terminées » : source unique = etatMetier (Close normalisé vers Terminés) ----
const terminées = (rows) =>
  rows.filter((r) => ["Terminés", "Close"].includes(etatMetier(r, EX))).length;
const jeu22 = Array.from({ length: 20 }, () => cmd(2026, 100, "Terminés", null, 5000))
  .concat(Array.from({ length: 2 }, () => cmd(2026, 100, null, "Close", 5000)))
  .concat([cmd(2025, 0, null, null, 0)]);
assert("22 terminées (Terminés + Close normalisés)", terminées(jeu22) === 22);

// ---- Options du filtre État (équivalent dashboard etatOptions) ----
const buildEtatOptions = (commandes, exercice) => {
  const found = new Set(commandes.map((c) => etatMetier(c, exercice)));
  return ETATS_METIER.filter((s) => found.has(s));
};
const sample = [
  cmd(2026, 0, "Terminés", null, 5000),
  cmd(2026, 0, null, "Close", 5000), // normalisé Terminés
  cmd(2026, 0, "Planifiés", null, 0), // normalisé En cours
  cmd(2025, 0, null, null, 0), // Pas réalisé
  cmd(2026, 0, null, null, 0), // Sans état
  cmd(2026, 2000, null, null, 5000), // En cours (engagement)
  cmd(2026, 0, "Attente validation", null, 0),
  cmd(2026, 0, null, "Annulée", 0),
  cmd(2026, 100, null, "2235.32", 0), // parasite
  cmd(2026, 100, "19.05.2025", null, 0), // parasite
];
const opts = buildEtatOptions(sample, EX);
assert("options contient Terminés", opts.includes("Terminés"));
assert("options contient Attente validation", opts.includes("Attente validation"));
assert("options contient Annulée", opts.includes("Annulée"));
assert("options contient En cours", opts.includes("En cours"));
assert("options contient Pas réalisé", opts.includes("Pas réalisé"));
assert("options contient Sans état", opts.includes("Sans état"));
assert("options : Planifiés jamais proposé", !opts.includes("Planifiés"));
assert("options : Close jamais proposé", !opts.includes("Close"));
assert("options : aucun montant/date parasite", !opts.some((o) => /[0-9]/.test(o)));

// ---- Inclusion archivage / Pas réalisé (visibleArchivage) ----
const baseCmd = (annee, actif, extra = {}) => ({
  id: `${annee}-${Math.random()}`,
  actif,
  annee_exercice: annee,
  paye: 0,
  ...extra,
});
const jeu = [
  ...Array.from({ length: 50 }, () => baseCmd(2026, true)),
  ...Array.from({ length: 138 }, () => baseCmd(2025, false)),
];
const activesOnly = jeu.filter((r) => visibleArchivage(r, { includeArchived: false, selectedEtats: [], exercice: EX }));
const allIncl = jeu.filter((r) => visibleArchivage(r, { includeArchived: true, selectedEtats: [], exercice: EX }));
assert("aucun filtre + includeArchived=false → seules les actives", activesOnly.length === 50);
assert("aucun filtre + includeArchived=true → actives + archivées", allIncl.length === 188);
const avecPasRealise = jeu.filter((r) =>
  visibleArchivage(r, { includeArchived: false, selectedEtats: ["Pas réalisé"], exercice: EX }),
);
// 50 actives + les archivées 2025 (paye 0) « Pas réalisé »
assert("Pas réalisé + includeArchived=false → archivées Pas réalisé accessibles", avecPasRealise.length === 50 + 138);
const nonPR = [
  baseCmd(2026, false, { paye: 500 }), // archivée non pas-réalisée
  baseCmd(2026, true), // active
];
const avecNonPR = nonPR.filter((r) =>
  visibleArchivage(r, { includeArchived: false, selectedEtats: ["Pas réalisé"], exercice: EX }),
);
assert("Pas réalisé n'inclut pas une archivée non pas-réalisée", avecNonPR.length === 1);
// compteur dynamique (jamais codé en dur)
assert("compteur total dynamique (188 = 50 + 138)", allIncl.length === 50 + 138);

// =====================================================================
// Répartition par secteur = NOMBRE de commandes (jamais une somme engage)
// =====================================================================
const cpRows = Array.from({ length: 15 }, (_, i) => ({
  numero_commande: `CP-${i}`,
  corps_etat: "(o) Plomberie",
  engage: -500,
  annee_exercice: 2026,
}));
const gtRows = [{ numero_commande: "GT-1", corps_etat: "(e) Divers", engage: 1000 }];
const repartition = repartitionCommandesParSecteur([...cpRows, ...gtRows]);
assert(
  "T1 CP = 15 commandes malgré engage négatif",
  repartition.find((d) => d.name === "CP")?.value === 15,
);
assert(
  "T1b CP conserve un montant engage négatif mais compte les commandes",
  repartition.find((d) => d.name === "CP")?.value === 15,
);
assert(
  "T2 secteur sans commande absent",
  !repartition.some((d) => d.name === "GE"),
);
assert(
  "T3 CP engage = -7500 (négatif conservé, sans Math.abs)",
  repartition.find((d) => d.name === "CP")?.engage === -7500,
);
assert(
  "T3b GT engage = 1000",
  repartition.find((d) => d.name === "GT")?.engage === 1000,
);
assert(
  "T3c value = nombre de commandes (jamais une somme engage)",
  repartition.find((d) => d.name === "CP")?.value === 15 &&
    repartition.find((d) => d.name === "CP")?.engage === -7500,
);

// =====================================================================
// Carte des investissements — buildDataVilles
// =====================================================================
const villesGeo = [
  { ville: "MEAUX", lat: 48.95, lng: 2.88, n: 2 },
  { ville: "SERRIS", lat: 48.85, lng: 2.79, n: 1 },
];
const cPos = [{ numero_commande: "1", adresse: "2 RUE BERTRAND FLORNOY, MEAUX", engage: 5000 }];
const cNeg = [{ numero_commande: "2", adresse: "3 RUE X, MEAUX", engage: -2000 }];
const cNonGeo = [{ numero_commande: "3", adresse: "4 RUE Y, VILLEINCONNUE", engage: 9000 }];
const r1 = buildDataVilles([...cPos, ...cNeg, ...cNonGeo], villesGeo);
assert(
  "T3 ville engage positif apparaît",
  r1.dataVilles.some((d) => d.ville === "MEAUX" && d.value === 3000 && d.count === 2),
);
const r2 = buildDataVilles(
  [{ numero_commande: "4", adresse: "5 RUE Z, SERRIS", engage: -100 }],
  villesGeo,
);
assert(
  "T4 ville somme engage négative conservée (count>0)",
  r2.dataVilles.some((d) => d.ville === "SERRIS" && d.count === 1 && d.value === -100),
);
assert(
  "T5 commande sans coordonnées → nonLocalisees",
  r1.nonLocalisees === 1,
);
assert(
  "T6 autres villes restent visibles malgré une ville non localisée",
  r1.dataVilles.length >= 1 && r1.dataVilles[0].ville === "MEAUX",
);
assert("T6b villes géo vide → dataVilles vide, nonLocalisees 0", (() => {
  const r = buildDataVilles(cPos, []);
  return r.dataVilles.length === 0 && r.nonLocalisees === 0;
})());
assert(
  "T6c secteurDe classifie CP via corps_etat",
  secteurDe({ corps_etat: "(o) Plomberie" }) === "CP",
);
assert(
  "T6d villeDepuisAdresse extrait la ville",
  villeDepuisAdresse("2 RUE BERTRAND FLORNOY, MEAUX") === "MEAUX",
);
assert(
  "T6e matchVille correspond par sous-chaîne",
  matchVille("CHESSY PLACE DES CORNILLES", [{ ville: "CHESSY", lat: 1, lng: 2 }])?.ville ===
    "CHESSY",
);

console.log("\n==========================================");
console.log(`Résultat : ${passed} PASS, ${failed} FAIL`);
console.log("==========================================");
process.exit(failed > 0 ? 1 : 0);
