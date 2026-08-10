import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { TRAVAUX_FIELDS } from "./travaux";

const nullableText = z.string().nullable().optional();
const nullableNumber = z.number().nullable().optional();
const commandeSchema = z.object({
  numero_commande: z.string().min(1), secteur: nullableText, tranche_code: nullableText, lot_code: nullableText, batiment: nullableText,
  charge_clientele: nullableText, adresse: nullableText, nature_analytique: nullableText, corps_etat: nullableText,
  charge_operation: nullableText, ligne_budget: nullableText, descriptif: nullableText, budget: nullableNumber,
  numero_fournisseur: nullableText, fournisseur: nullableText, etat_commande: nullableText, engage: nullableNumber,
  ecart: nullableNumber, paye: nullableNumber, solde: nullableNumber, etat_travaux: nullableText,
  date_demarrage: nullableText, date_fin_travaux: nullableText, observations: nullableText,
  support_communication: nullableText, date_communication: nullableText,
  classification_programmation: nullableText,
  classification_secteur: nullableText,
});
const importIdSchema = z.object({ importId: z.string().uuid() });
const batchSchema = z.object({ importId: z.string().uuid(), annee_exercice: z.number().optional(), commandes: z.array(commandeSchema) });

const comparable = (row: Record<string, unknown>) => Object.fromEntries(TRAVAUX_FIELDS.map((field) => [field, row[field] ?? null]));

export const createTravauxImport = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ fichier: z.string().min(1), lignes: z.number(), doublons: z.number(), erreurs: z.number(), annee_exercice: z.number() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase-ext/client.server");
    const db = supabaseAdmin as any;
    // On stocke annee_exercice dans import_travaux
    const { data: execution, error } = await db.from("import_travaux").insert({
      fichier: data.fichier, lignes: data.lignes, doublons: data.doublons, erreurs: data.erreurs, annee_exercice: data.annee_exercice,
    }).select("id").single();
    if (error) throw new Error(`Création de l'import : ${error.message}`);
    
    // On stocke l'année dans une métadonnée ou on la passera au batch
    return { id: execution.id, annee_exercice: data.annee_exercice } as { id: string, annee_exercice: number };
  });

export const importTravauxBatch = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => batchSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase-ext/client.server");
    const db = supabaseAdmin as any;
    const numbers = data.commandes.map((row) => row.numero_commande);
    const { data: existingRows, error: existingError } = await db.from("travaux_commandes").select("*").in("numero_commande", numbers);
    if (existingError) throw new Error(`Lecture des commandes : ${existingError.message}`);
    const existing = new Map((existingRows ?? []).map((row: Record<string, unknown>) => [row["numero_commande"], row]));
    const trancheCodes = [...new Set(data.commandes.map((row) => row.tranche_code).filter(Boolean))];
    const { data: tranches, error: trancheError } = trancheCodes.length
      ? await db.from("tranches").select("code").in("code", trancheCodes)
      : { data: [], error: null };
    if (trancheError) throw new Error(`Validation des tranches : ${trancheError.message}`);
    const validTranches = new Set((tranches ?? []).map((row: { code: string }) => row.code));
    let creees = 0;
    let modifiees = 0;
    let inchangees = 0;
    let ignorees = 0;

    const annee_exercice = data.annee_exercice;

    // Liste des colonnes réellement présentes dans la table travaux_commandes selon types.ts
    const VALID_COLUMNS = [
      "numero_commande", "secteur", "tranche_code", "lot_code", "batiment", "charge_clientele", "adresse",
      "nature_analytique", "corps_etat", "charge_operation", "ligne_budget", "descriptif", "budget",
      "numero_fournisseur", "fournisseur", "etat_commande", "engage", "ecart", "paye", "solde",
      "etat_travaux", "date_demarrage", "date_fin_travaux", "observations", "support_communication",
      "date_communication", "vu_dans_import_id", "actif", "annee_exercice", "classification_programmation", "classification_secteur"
    ];

    for (const source of data.commandes) {
      const fullRow = { 
        ...source, 
        tranche_code: source.tranche_code && validTranches.has(source.tranche_code) ? source.tranche_code : null, 
        vu_dans_import_id: data.importId, 
        annee_exercice: data.annee_exercice,
        actif: true,
      };
      
      // Filtrage strict pour ne garder que les colonnes valides
      const row = Object.fromEntries(
        Object.entries(fullRow).filter(([key]) => VALID_COLUMNS.includes(key))
      );

      if (source.tranche_code && !validTranches.has(source.tranche_code)) ignorees += 1;
      const before = existing.get(source.numero_commande) as Record<string, unknown> | undefined;
      const changed = !before || JSON.stringify(comparable(before)) !== JSON.stringify(comparable(row));
      
      if (changed) {
        const result = before
          ? await db.from("travaux_commandes").update(row).eq("id", before["id"]).select("*").single()
          : await db.from("travaux_commandes").insert(row).select("*").single();
        if (result.error) throw new Error(`Écriture ${source.numero_commande} : ${result.error.message}`);
        const commande = result.data as Record<string, unknown>;
        await db.from("travaux_commandes_historique").insert({
          import_id: data.importId, commande_id: commande["id"], operation: before ? "modification" : "creation",
          avant: before ? comparable(before) : null, apres: comparable(commande),
        });
        if (before) modifiees += 1; else creees += 1;
      } else {
        await db.from("travaux_commandes").update({ vu_dans_import_id: data.importId, actif: true }).eq("id", before!["id"]);
        inchangees += 1;
      }
    }
    return { creees, modifiees, inchangees, ignorees };
  });

export const failTravauxImport = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => importIdSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase-ext/client.server");
    const db = supabaseAdmin as any;
    const { data: execution, error } = await db.from("import_travaux").update({ statut: "erreur", termine_at: new Date().toISOString() }).eq("id", data.importId).select("*").single();
    if (error) throw new Error(`Échec de l'import : ${error.message}`);
    return execution;
  });

export const finalizeTravauxImport = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => importIdSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase-ext/client.server");
    const db = supabaseAdmin as any;
    const { data: active, error } = await db.from("travaux_commandes").select("id, numero_commande").eq("actif", true);
    if (error) throw new Error(`Recherche des commandes absentes : ${error.message}`);
    const { data: seen, error: seenError } = await db.from("travaux_commandes").select("id").eq("vu_dans_import_id", data.importId);
    if (seenError) throw new Error(seenError.message);
    const seenIds = new Set((seen ?? []).map((row: { id: string }) => row.id));
    const missing = (active ?? []).filter((row: { id: string }) => !seenIds.has(row.id));
    for (const row of missing) {
      const archived = await db.from("travaux_commandes").update({ actif: false }).eq("id", row.id).select("*").single();
      if (archived.error) throw new Error(`Archivage ${row.numero_commande} : ${archived.error.message}`);
      const history = await db.from("travaux_commandes_historique").insert({ import_id: data.importId, commande_id: row.id, operation: "archivage", avant: { actif: true }, apres: { actif: false } });
      if (history.error) throw new Error(history.error.message);
    }
    const { data: execution, error: executionError } = await db.from("import_travaux").select("*").eq("id", data.importId).single();
    if (executionError) throw new Error(executionError.message);
    const updated = await db.from("import_travaux").update({ statut: "termine", archivees: missing.length, termine_at: new Date().toISOString() }).eq("id", data.importId).select("*").single();
    if (updated.error) throw new Error(updated.error.message);
    return { ...execution, ...updated.data, archivees: missing.length };
  });
