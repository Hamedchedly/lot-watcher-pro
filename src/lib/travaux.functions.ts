import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  TRAVAUX_FIELDS,
  commandesAAArchiver,
  detailArchivee,
  detailConflit,
  detailCreee,
  detailIgnoree,
  detailInchangee,
  detailIssue,
  travauxComparable,
  travauxIdentiques,
} from "./travaux";

const nullableText = z.string().nullable().optional();
const nullableNumber = z.number().nullable().optional();
const issueSchema = z.object({
  line: z.number(),
  message: z.string(),
  numero_commande: z.string().nullable().optional(),
});
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
  ligne: z.number().optional(),
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
        doublonsDetails: z.array(issueSchema).default([]),
        erreursDetails: z.array(issueSchema).default([]),
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

    // Persistance immédiate des détails connus dès l'analyse du fichier (doublons, erreurs).
    const detailsRows: Record<string, unknown>[] = [
      ...data.doublonsDetails.map((issue) => detailIssue(execution.id, "doublon", issue)),
      ...data.erreursDetails.map((issue) => detailIssue(execution.id, "erreur", issue)),
    ];
    if (detailsRows.length) {
      const { error: detailsError } = await db
        .from("travaux_import_details")
        .insert(detailsRows);
      if (detailsError) throw new Error(`Détails de l'import : ${detailsError.message}`);
    }

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
      const ligne = typeof source["ligne"] === "number" ? source["ligne"] : null;
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

      // Rattachement patrimoine impossible : on l'enregistre sans bloquer la commande.
      if (source.tranche_code && !validTranches.has(source.tranche_code)) {
        ignorees += 1;
        await db
          .from("travaux_import_details")
          .insert(detailIgnoree(data.importId, source as Record<string, unknown>, ligne));
      }
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
        await db
          .from("travaux_import_details")
          .insert({ ...detailCreee(data.importId, commande, ligne), commande_id: commande["id"] });
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
        await db
          .from("travaux_import_details")
          .insert(detailInchangee(data.importId, before, ligne));
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
      await db
        .from("travaux_import_details")
        .insert(
          detailConflit(
            data.importId,
            before,
            travauxComparable(before),
            travauxComparable(row),
            ligne,
          ),
        );
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
    let active: Record<string, unknown>[] = [];
    if (annee != null) {
      const result = await db
        .from("travaux_commandes")
        .select("*")
        .eq("actif", true)
        .eq("annee_exercice", annee);
      if (result.error) throw new Error(`Recherche des commandes absentes : ${result.error.message}`);
      active = (result.data ?? []) as Record<string, unknown>[];
    }

    const { data: seen, error: seenError } = await db
      .from("travaux_commandes")
      .select("id")
      .eq("vu_dans_import_id", data.importId);
    if (seenError) throw new Error(seenError.message);
    const seenIds = new Set<string>((seen ?? []).map((row: { id: string }) => row.id));
    const missing = commandesAAArchiver(
      active as { id: string; annee_exercice?: number | null }[],
      annee,
      seenIds,
    );

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
      // Détail d'import : snapshot immuable + motif d'archivage.
      await db
        .from("travaux_import_details")
        .insert(detailArchivee(data.importId, archived.data as Record<string, unknown>));
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
