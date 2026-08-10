import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.EXT_SUPABASE_URL;
const key = process.env.EXT_SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(
    "Variables EXT_SUPABASE_URL / EXT_SUPABASE_SERVICE_ROLE_KEY manquantes (fichier .env).",
  );
  process.exit(1);
}

const supabase = createClient(url, key);

const TABLES = [
  "lots",
  "tranches",
  "occupants",
  "travaux",
  "travaux_commandes",
  "travaux_commandes_historique",
  "import_travaux",
  "adresses_geo",
];

// PostgREST plafonne chaque requête à 1000 lignes : on pagine par blocs.
const PAGE = 1000;

async function dumpTable(table) {
  const rows = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order("id", { ascending: true, nullsFirst: false })
      .range(from, from + PAGE - 1);
    if (error) {
      // Table sans colonne `id` (ex. adresses_geo) : on relance sans tri.
      const { data: d2, error: e2 } = await supabase
        .from(table)
        .select("*")
        .range(from, from + PAGE - 1);
      if (e2) throw new Error(`${table} : ${e2.message}`);
      rows.push(...(d2 ?? []));
      if (!d2?.length || d2.length < PAGE) break;
      from += PAGE;
      continue;
    }
    rows.push(...(data ?? []));
    if (!data?.length || data.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
const dir = path.join(process.cwd(), "backups", `db-${stamp}`);
fs.mkdirSync(dir, { recursive: true });

const manifest = { createdAt: new Date().toISOString(), tables: {} };

for (const table of TABLES) {
  try {
    const rows = await dumpTable(table);
    const file = path.join(dir, `${table}.json`);
    fs.writeFileSync(file, JSON.stringify(rows, null, 2), "utf8");
    manifest.tables[table] = { rows: rows.length, file: `${table}.json`, sha256: sha256(file) };
    console.log(`OK  ${table.padEnd(28)} ${rows.length} lignes`);
  } catch (error) {
    manifest.tables[table] = { error: error.message };
    console.log(`ERR ${table.padEnd(28)} ${error.message}`);
  }
}

// Copie du .env (utile pour restaurer) — le dossier backups/ est ignoré par git.
const envSource = path.join(process.cwd(), ".env");
if (fs.existsSync(envSource)) {
  fs.copyFileSync(envSource, path.join(dir, ".env"));
  manifest.env = "inclus (voir .env dans le backup)";
}

fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
console.log("\nBackup terminé →", dir);
console.log("Manifest →", path.join(dir, "manifest.json"));
