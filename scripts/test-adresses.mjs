// Tests page /adresses — regroupement Ville → Tranches → Adresses (logique pure)
// Exécution : node scripts/test-adresses.mjs
import { adressesParTranche, estGarage, rueDe, entreeDe } from "../src/lib/adresses.ts";

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

const lot = (code, tranche, adresse) => ({
  code_patrimoine: code,
  tranche_code: tranche,
  adresse,
  type_lot: "LOG",
  ville: "SERRIS",
  code_postal: null,
  batiment: null,
  etage: null,
  porte: null,
  surface_utile: null,
  dpe: null,
  locataire_nom: null,
});

// Hiérarchie ville → tranche → adresse (déjà filtrée des garages masqués).
const tranches = {
  "1400": {
    "AVENUE DE SARIA": [lot("L1", "1400", "AVENUE DE SARIA"), lot("L2", "1400", "AVENUE DE SARIA")],
    "RUE ROBERT THIBOUST": [lot("L3", "1400", "RUE ROBERT THIBOUST")],
  },
  "1401": {
    "PLACE THOMAS LE PILLEUR": [
      lot("L4", "1401", "PLACE THOMAS LE PILLEUR"),
      lot("L5", "1401", "PLACE THOMAS LE PILLEUR"),
      lot("L6", "1401", "PLACE THOMAS LE PILLEUR"),
    ],
  },
};

const groupes = adressesParTranche(tranches);

// Regroupement : une section par tranche, adresses directement listées dedans.
assert("regroupement → 2 tranches (sections)", groupes.length === 2);
assert("Tranches triées par ordre d'apparition (1400, 1401)", groupes[0].code === "1400" && groupes[1].code === "1401");

// Conservation des compteurs par tranche.
const t1400 = groupes.find((g) => g.code === "1400");
assert("TRANCHE 1400 → 2 adresses", t1400?.nbAdresses === 2);
assert("TRANCHE 1400 → 3 lots", t1400?.nbLots === 3);
assert(
  "TRANCHE 1400 → adresse AVENUE DE SARIA = 2 lots",
  t1400?.adresses.find((a) => a.adresse === "AVENUE DE SARIA")?.lots === 2,
);
assert(
  "TRANCHE 1400 → adresse RUE ROBERT THIBOUST = 1 lot",
  t1400?.adresses.find((a) => a.adresse === "RUE ROBERT THIBOUST")?.lots === 1,
);
const t1401 = groupes.find((g) => g.code === "1401");
assert("TRANCHE 1401 → 1 adresse / 3 lots", t1401?.nbAdresses === 1 && t1401?.nbLots === 3);

// Les tranches sans adresse visible (ex. uniquement des garages masqués) ne sont pas affichées.
assert("tranche sans adresse visible → absente", adressesParTranche({}).length === 0);
assert(
  "adresses d'une tranche → 0 ligne quand vide",
  adressesParTranche({ "9999": {} }).length === 0,
);

// Helpers patrimoine inchangés (réutilisés par la page).
assert("estGarage code ER.G → true", estGarage({ code_patrimoine: "ER.G12", type_lot: "LOG" }));
assert("estGarage type PAR → true", estGarage({ code_patrimoine: "L7", type_lot: "PAR" }));
assert("estGarage lot standard → false", estGarage({ code_patrimoine: "L7", type_lot: "LOG" }) === false);
assert("rueDe retire le numéro", rueDe("25-27  RUE DE RUZE") === "RUE DE RUZE");
assert("entreeDe normalise les espaces", entreeDe("  PLACE  THOMAS  ") === "PLACE THOMAS");

console.log("\n==========================================");
console.log(`Résultat : ${passed} PASS, ${failed} FAIL`);
console.log("==========================================");
process.exit(failed > 0 ? 1 : 0);
