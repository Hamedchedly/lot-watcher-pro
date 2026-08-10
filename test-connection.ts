import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://rlawdxadbkelxqjjtipw.supabase.co";
const SUPABASE_KEY = "sb_publishable_CuTdjmNt2NipErtP_ReyYw_qKStJyHI";

async function test() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data, error } = await supabase.from("import_travaux").select("*").limit(5);
  if (error) {
    console.error("Erreur lors de la récupération des données :", error.message);
  } else {
    console.log("Données récupérées :", data);
  }
}

test();
