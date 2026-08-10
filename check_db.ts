import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();

const url = process.env.EXT_SUPABASE_URL!;
const key = process.env.EXT_SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(url, key);

async function check() {
  console.log("Checking columns for 'import_travaux'...");
  const { data: importCols, error: importError } = await supabase.rpc("get_table_columns", {
    table_name: "import_travaux",
  });

  // If RPC fails, try a direct query
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
}

check();
