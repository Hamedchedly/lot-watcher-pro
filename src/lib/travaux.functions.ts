import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  TRAVAUX_FIELDS,
  commandesAAArchiver,
  travauxComparable,
  travauxIdentiques,
} from "./travaux";

const nullableText = z.string().nullable().optional();
const nullableNumber = z.number().nullable().optional();
const commandeSchema = z.object({
  numero_commande: z.string().min(1),
  secteur: nullableText,
  tranche_code: nullableText,
  lot_code: nullableText,
  batiment: nullableText,
  charge_clientele: nullableText,
  adresse: nullableText,
  nature_analytique: nullableText,
  corps_etat: nullableText,
  charge_operation: nullableText,
  ligne_budget: nullableText,
  descriptif: nullableText,
  budget: nullableNumber,
  numero_fournisseur: nullableText,
  fournisseur: nullableText,
  etat_commande: nullableText,
  engage: nullableNumber,
  ecart: nullableNumber,
  paye: nullableNumber,
  solde: nullableNumber,
  etat_travaux: nullableText,
  date_demarrage: nullableText,
  date_fin_travaux: nullableText,
  observations: nullableText,
  support_communication: nullableText,
  date_communication: nullableText,
  classification_programmation: nullableText,
  classification_secteur: nullableText,
});
const importIdSchema = z.object({ importId: z.string().uuid() });
const finalizeSchema = z.object({
  importId: z.string().uuid(),
  creees: z.number().optional(),
  modifiees: z.number().optional(),
  inchangees: z.number().optional(),
  ignorees: z.number().optional(),
  conflits: z.number().optional(),
});
const batchSchema = z.object({
  importId: z.string().uuid(),
  annee_exercice: z.number().optional(),
  commandes: z.array(commandeSchema),
});

export const createTravauxImport = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z
      .object({
        fichier: z.string().min(1),
        lignes: z.number(),
        doublons: z.number(),
        erreurs: z.number(),
        annee_exercice: z.number(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase-ext/client.server");
    const db = supabaseAdmin as any;
    // annee_exercice est écrit directement : la colonne existe en production (migration appliquée).
    // En cas de colonne manquante, l'import s'arrête explicitement au lieu de dégrader l'année.
    const insertData: any = {
      fichier: data.fichier,
      lignes: data.lignes,
      doublons: data.doublons,
      erreurs: data.erreurs,
      annee_exercice: data.annee_exercice,
    };

    const { data: execution, error } = await db
      .from("import_travaux")
      .insert(insertData)
      .select("id")
      .single();
    if (error) throw new Error(`Création de l'import : ${error.message}`);

    return { id: execution.id, annee_exercice: data.annee_exercice } as {
      id: string;
      annee_exercice: number;
    };
  });

export const importTravauxBatch = createServerFn({ method: "POST" })
  .validator((d: unknown) => batchSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase-ext/client.server");
    const db = supabaseAdmin as any;
    const numbers = data.commandes.map((row) => row.numero_commande);
    const { data: existingRows, error: existingError } = await db
      .from("travaux_commandes")
      .select("*")
      .in("numero_commande", numbers);
    if (existingError) throw new Error(`Lecture des commandes : ${existingError.message}`);
    const existing = new Map(
      (existingRows ?? []).map((row: Record<string, unknown>) => [row["numero_commande"], row]),
    );
    const trancheCodes = [
      ...new Set(data.commandes.map((row) => row.tranche_code).filter(Boolean)),
    ];
    const { data: tranches, error: trancheError } = trancheCodes.length
      ? await db.from("tranches").select("code").in("code", trancheCodes)
      : { data: [], error: null };
    if (trancheError) throw new Error(`Validation des tranches : ${trancheError.message}`);
    const validTranches = new Set((tranches ?? []).map((row: { code: string }) => row.code));
    let creees = 0;
    let conflits = 0;
    let inchangees = 0;
    let ignorees = 0;
    // Colonnes réellement présentes dans travaux_commandes (schéma de production).
    // Les colonnes classification_* n'existent pas en base : on ne les écrit jamais.
    const VALID_COLUMNS: string[] = [...TRAVAUX_FIELDS, "vu_dans_import_id", "actif"];

    for (const source of data.commandes) {
      const fullRow: Record<string, unknown> = {
        ...source,
        tranche_code:
          source.tranche_code && validTranches.has(source.tranche_code)
            ? source.tranche_code
            : null,
        vu_dans_import_id: data.importId,
        annee_exercice: data.annee_exercice,
        actif: true,
      };

      // Filtrage strict pour ne garder que les colonnes valides
      const row = Object.fromEntries(
        Object.entries(fullRow).filter(([key]) => VALID_COLUMNS.includes(key)),
      );

      if (source.tranche_code && !validTranches.has(source.tranche_code)) ignorees += 1;
      const before = existing.get(source.numero_commande) as Record<string, unknown> | undefined;

      // Aucune commande existante : création pure.
      if (!before) {
        const result = await db.from("travaux_commandes").insert(row).select("*").single();
        if (result.error)
          throw new Error(`Écriture ${source.numero_commande} : ${result.error.message}`);
        const commande = result.data as Record<string, unknown>;
        await db.from("travaux_commandes_historique").insert({
          import_id: data.importId,
          commande_id: commande["id"],
          operation: "creation",
          avant: null,
          apres: travauxComparable(commande),
        });
        creees += 1;
        continue;
      }

      // La commande existe déjà en base.
      // On la marque comme « vue dans cet import » (elle ne sera pas archivée), mais on ne
      // modifie JAMAIS ses données : la version actuelle reste active tant que l'utilisateur
      // n'a pas tranché le conflit.
      if (travauxIdentiques(before, row)) {
        await db
          .from("travaux_commandes")
          .update({ vu_dans_import_id: data.importId, actif: true })
          .eq("id", before["id"]);
        inchangees += 1;
        continue;
      }

      // Version différente → CONFLIT : la nouvelle version est conservée comme proposition
      // dans l'historique (operation = 'conflit', resolu = false) et l'alerte apparaîtra
      // dans le journal tant que l'utilisateur n'aura pas choisi la version à conserver.
      conflits += 1;
      await db
        .from("travaux_commandes")
        .update({ vu_dans_import_id: data.importId })
        .eq("id", before["id"]);
      await db.from("travaux_commandes_historique").insert({
        import_id: data.importId,
        commande_id: before["id"],
        operation: "conflit",
        avant: travauxComparable(before),
        apres: travauxComparable(row),
      });
    }
    return { creees, modifiees: 0, conflits, inchangees, ignorees };
  });

export const failTravauxImport = createServerFn({ method: "POST" })
  .validator((d: unknown) => importIdSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase-ext/client.server");
    const db = supabaseAdmin as any;
    const { data: execution, error } = await db
      .from("import_travaux")
      .update({ statut: "erreur", termine_at: new Date().toISOString() })
      .eq("id", data.importId)
      .select("*")
      .single();
    if (error) throw new Error(`Échec de l'import : ${error.message}`);
    return execution;
  });

export const finalizeTravauxImport = createServerFn({ method: "POST" })
  .validator((d: unknown) => finalizeSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase-ext/client.server");
    const db = supabaseAdmin as any;

    // L'archivage est limité à l'ANNÉE D'EXERCICE de l'import : une commande 2023 ne doit
    // jamais être archivée parce qu'elle est absente d'un fichier 2024.
    const { data: execution, error: executionError } = await db
      .from("import_travaux")
      .select("*")
      .eq("id", data.importId)
      .single();
    if (executionError) throw new Error(executionError.message);
    const annee = (execution?.annee_exercice as number | null) ?? null;

    // Commandes actives de la même année que l'import.
    let active: { id: string; numero_commande: string; annee_exercice: number | null }[] = [];
    if (annee != null) {
      const result = await db
        .from("travaux_commandes")
        .select("id, numero_commande, annee_exercice")
        .eq("actif", true)
        .eq("annee_exercice", annee);
      if (result.error) throw new Error(`Recherche des commandes absentes : ${result.error.message}`);
      active = (result.data ?? []) as typeof active;
    }

    const { data: seen, error: seenError } = await db
      .from("travaux_commandes")
      .select("id")
      .eq("vu_dans_import_id", data.importId);
    if (seenError) throw new Error(seenError.message);
    const seenIds = new Set<string>((seen ?? []).map((row: { id: string }) => row.id));
    const missing = commandesAAArchiver(active, annee, seenIds);

    for (const row of missing) {
      const archived = await db
        .from("travaux_commandes")
        .update({ actif: false })
        .eq("id", row.id)
        .select("*")
        .single();
      if (archived.error)
        throw new Error(`Archivage ${row.id} : ${archived.error.message}`);
      // Snapshot complet de la commande avant/après archivage (timeline exploitable).
      const snapshot = travauxComparable(archived.data);
      const avant = { ...snapshot, actif: true };
      const apres = { ...snapshot, actif: false };
      const history = await db.from("travaux_commandes_historique").insert({
        import_id: data.importId,
        commande_id: row.id,
        operation: "archivage",
        avant,
        apres,
      });
      if (history.error) throw new Error(history.error.message);
    }

    // Persistance des compteurs du rapport dans le journal d'import.
    const updated = await db
      .from("import_travaux")
      .update({
        statut: "termine",
        creees: data.creees ?? 0,
        modifiees: data.modifiees ?? 0,
        inchangees: data.inchangees ?? 0,
        ignorees: data.ignorees ?? 0,
        conflits: data.conflits ?? 0,
        archivees: missing.length,
        termine_at: new Date().toISOString(),
      })
      .eq("id", data.importId)
      .select("*")
      .single();
    if (updated.error) throw new Error(updated.error.message);
    return { ...execution, ...updated.data, archivees: missing.length };
  });
