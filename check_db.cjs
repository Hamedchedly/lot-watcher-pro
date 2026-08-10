const { createClient } = require("@supabase/supabase-js");

const url = process.env.EXT_SUPABASE_URL;
const key = process.env.EXT_SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing env vars");
  process.exit(1);
}

const supabase = createClient(url, key);

async function check() {
  console.log("Checking columns for 'import_travaux'...");
  const { data: testData, error: testError } = await supabase
    .from("import_travaux")
    .select("*")
    .limit(1);

  if (testError) {
    console.error("Error fetching 'import_travaux':", testError.message);
  } else {
    console.log("Successfully fetched 'import_travaux'. Keys:", Object.keys(testData[0] || {}));
  }

  console.log("\nChecking columns for 'travaux_commandes'...");
  const { data: cmdData, error: cmdError } = await supabase
    .from("travaux_commandes")
    .select("*")
    .limit(1);
  if (cmdError) {
    console.error("Error fetching 'travaux_commandes':", cmdError.message);
  } else {
    console.log("Successfully fetched 'travaux_commandes'. Keys:", Object.keys(cmdData[0] || {}));
  }

  console.log("\nChecking columns for 'travaux_commandes_historique'...");
  const { data: histData, error: histError } = await supabase
    .from("travaux_commandes_historique")
    .select("*")
    .limit(1);
  if (histError) {
    console.error("Error fetching 'travaux_commandes_historique':", histError.message);
  } else {
    console.log(
      "Successfully fetched 'travaux_commandes_historique'. Keys:",
      Object.keys(histData[0] || {}),
    );
  }
}

check();
