import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Colonnes réellement présentes dans travaux_commandes (schéma de production).
// Les colonnes classification_* n'existent pas encore en base : on les exclut des
// mises à jour pour que la résolution d'une alerte ne casse pas l'UPDATE.
const COMMANDE_UPDATABLE_COLUMNS = [
  "numero_commande",
  "secteur",
  "tranche_code",
  "lot_code",
  "batiment",
  "charge_clientele",
  "adresse",
  "nature_analytique",
  "corps_etat",
  "charge_operation",
  "ligne_budget",
  "descriptif",
  "budget",
  "numero_fournisseur",
  "fournisseur",
  "etat_commande",
  "engage",
  "ecart",
  "paye",
  "solde",
  "etat_travaux",
  "date_demarrage",
  "date_fin_travaux",
  "observations",
  "support_communication",
  "date_communication",
  "annee_exercice",
] as const;

export type CommandeTravaux = {
  id: string;
  numero_commande: string;
  secteur: string | null;
  tranche_code: string | null;
  lot_code: string | null;
  batiment: string | null;
  charge_clientele: string | null;
  adresse: string | null;
  nature_analytique: string | null;
  corps_etat: string | null;
  charge_operation: string | null;
  ligne_budget: string | null;
  descriptif: string | null;
  budget: number | null;
  numero_fournisseur: string | null;
  fournisseur: string | null;
  etat_commande: string | null;
  engage: number | null;
  ecart: number | null;
  paye: number | null;
  solde: number | null;
  etat_travaux: string | null;
  date_demarrage: string | null;
  date_fin_travaux: string | null;
  observations: string | null;
  support_communication: string | null;
  date_communication: string | null;
  annee_exercice: number | null;
  classification_programmation: string | null;
  classification_secteur: string | null;
  actif: boolean;
  created_at: string;
  updated_at: string;
};

export type HistoriqueTravaux = {
  id: string;
  import_id: string;
  commande_id: string;
  operation: string;
  avant: Record<string, string | number | boolean | null> | null;
  apres: Record<string, string | number | boolean | null> | null;
  created_at: string;
  resolu: boolean;
};

export type ImportTravaux = {
  id: string;
  fichier: string;
  lignes: number;
  creees: number;
  modifiees: number;
  conflits?: number;
  reports?: number;
  doublons: number;
  erreurs: number;
  archivees: number;
  statut: string;
  demarre_at: string;
  termine_at: string | null;
  annee_exercice: number | null;
};

export type TrancheDetail = {
  code: string;
  libelle: string | null;
  localite: string | null;
  nb_logements: number;
  lat?: number;
  lng?: number;
};

export type TravauxDashboardData = {
  commandes: CommandeTravaux[];
  historique: HistoriqueTravaux[];
  imports: ImportTravaux[];
  tranchesDetails: TrancheDetail[];
};

export const getTravauxDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase-ext/client.server");
  const db = supabaseAdmin as any;

  // On tente de récupérer l'historique avec resolu=false, mais on replie si la colonne manque.
  // NB : les builders Supabase sont mutables (chaque .eq() s'accumule sur le même objet),
  // donc chaque tentative doit repartir d'une requête neuve pour que le repli soit réel.
  // Seules les opérations « conflit » non résolues exigent une décision utilisateur.
  const buildHistoriqueQuery = () =>
    db
      .from("travaux_commandes_historique")
      .select("*, travaux_commandes(numero_commande)")
      .eq("operation", "conflit");

  // On charge TOUTES les commandes (actives et archivées) : le Dashboard peut ainsi filtrer
  // par année d'exercice et consulter les années historiques sans dépendre de `actif = true`.
  const [commandesResult, importsResult, tranchesResult] = await Promise.all([
    db
      .from("travaux_commandes")
      .select("*")
      .order("engage", { ascending: false, nullsFirst: false }),
    db.from("import_travaux").select("*").order("demarre_at", { ascending: false }).limit(5),
    db.from("tranches").select("code, libelle, localite, nb_logements").eq("actif", true),
  ]);

  let historiqueResult;
  try {
    historiqueResult = await buildHistoriqueQuery()
      .eq("resolu", false)
      .order("created_at", { ascending: false });
    if (historiqueResult.error && historiqueResult.error.message.includes("resolu")) {
      historiqueResult = await buildHistoriqueQuery().order("created_at", { ascending: false });
    }
  } catch (e) {
    historiqueResult = await buildHistoriqueQuery().order("created_at", { ascending: false });
  }

  if (commandesResult.error)
    throw new Error(`Chargement des commandes : ${commandesResult.error.message}`);
  if (historiqueResult.error)
    throw new Error(`Chargement de l'historique : ${historiqueResult.error.message}`);
  if (importsResult.error)
    throw new Error(`Chargement des imports : ${importsResult.error.message}`);
  if (tranchesResult.error)
    throw new Error(`Chargement des tranches : ${tranchesResult.error.message}`);

  return {
    commandes: (commandesResult.data ?? []) as CommandeTravaux[],
    historique: (historiqueResult.data ?? []) as (HistoriqueTravaux & {
      travaux_commandes: { numero_commande: string };
    })[],
    imports: (importsResult.data ?? []) as ImportTravaux[],
    tranchesDetails: (tranchesResult.data ?? []) as TrancheDetail[],
  } satisfies TravauxDashboardData;
});

export const updateCommandeTravaux = createServerFn({ method: "POST" })
  .validator((d: unknown) => {
    return z
      .object({
        id: z.string().uuid(),
        data: z.record(z.any()),
      })
      .parse(d);
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase-ext/client.server");
    const db = supabaseAdmin as any;

    // Liste des colonnes autorisées pour l'update
    const VALID_COLUMNS = [
      "numero_commande",
      "secteur",
      "tranche_code",
      "lot_code",
      "batiment",
      "charge_clientele",
      "adresse",
      "nature_analytique",
      "corps_etat",
      "charge_operation",
      "ligne_budget",
      "descriptif",
      "budget",
      "numero_fournisseur",
      "fournisseur",
      "etat_commande",
      "engage",
      "ecart",
      "paye",
      "solde",
      "etat_travaux",
      "date_demarrage",
      "date_fin_travaux",
      "observations",
      "support_communication",
      "date_communication",
      "annee_exercice",
    ];

    const filteredData = Object.fromEntries(
      Object.entries(data.data).filter(([key]) => VALID_COLUMNS.includes(key)),
    );

    const { data: updated, error } = await db
      .from("travaux_commandes")
      .update(filteredData)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(`Mise à jour échouée : ${error.message}`);
    return updated;
  });

export const getCommandeHistorique = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ commandeId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase-ext/client.server");
    const db = supabaseAdmin as any;
    // Toutes les opérations (creation, modification, archivage, conflit, resolution),
    // ordonnées chronologiquement pour reconstruire la timeline de la commande.
    const { data: rows, error } = await db
      .from("travaux_commandes_historique")
      .select("id, import_id, commande_id, operation, avant, apres, created_at, resolu")
      .eq("commande_id", data.commandeId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(`Chargement de l'historique : ${error.message}`);
    return (rows ?? []) as HistoriqueTravaux[];
  });

export const getTravauxImportDetails = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z
      .object({
        importId: z.string().uuid(),
        type: z.enum(["creee", "conflit", "inchangee", "archivee", "doublon", "ignoree", "erreur", "report"]),
        page: z.number().int().min(1).optional(),
        pageSize: z.number().int().min(1).max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase-ext/client.server");
    const db = supabaseAdmin as any;
    const page = data.page ?? 1;
    const pageSize = data.pageSize ?? 50;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // Import inexistant ou type sans détail → total 0 et liste vide.
    const { count, error: countError } = await db
      .from("travaux_import_details")
      .select("id", { count: "exact", head: true })
      .eq("import_id", data.importId)
      .eq("type", data.type);
    if (countError) return { rows: [], total: 0 };

    const { data: rows, error } = await db
      .from("travaux_import_details")
      .select("*")
      .eq("import_id", data.importId)
      .eq("type", data.type)
      .order("ligne", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true })
      .order("numero_commande", { ascending: true })
      .range(from, to);
    if (error) throw new Error(`Lecture des détails : ${error.message}`);
    return { rows: (rows ?? []) as any[], total: count ?? 0 };
  });

export const getTravauxStats = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase-ext/client.server");
  const db = supabaseAdmin as any;

  // Agrégation par ville, secteur, programmation, etc.
  // Note: Comme on ne peut pas modifier le schéma, on fait l'agrégation sur les données brutes
  // mais on pourrait utiliser des fonctions RPC Supabase pour plus d'efficacité si besoin.
  const { data, error } = await db
    .from("travaux_commandes")
    .select(
      "engage, budget, paye, ligne_budget, corps_etat, secteur, adresse, date_demarrage, date_fin_travaux, date_communication, annee_exercice",
    )
    .eq("actif", true);
  if (error) throw new Error(error.message);
  return data;
});

export const resolveHistoriqueTravaux = createServerFn({ method: "POST" })
  .validator((d: unknown) => {
    return z
      .object({
        id: z.string().uuid(),
        keepVersion: z.enum(["A", "B"]),
        commandeId: z.string().uuid(),
        data: z.record(z.any()),
      })
      .parse(d);
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase-ext/client.server");
    const db = supabaseAdmin as any;

    // 1. Chargement de la ligne de conflit pour lier la résolution à l'import d'origine.
    const { data: conflitRow, error: conflitError } = await db
      .from("travaux_commandes_historique")
      .select("*")
      .eq("id", data.id)
      .single();
    if (conflitError) throw new Error(`Lecture du conflit : ${conflitError.message}`);
    const importId = conflitRow?.import_id as string | undefined;

    // 2. Si l'utilisateur a choisi une version, on applique la version choisie sur la commande.
    //    On filtre sur les colonnes réellement existantes pour éviter qu'une colonne
    //    absente du schéma ne fasse échouer toute la résolution.
    const filteredData = Object.fromEntries(
      Object.entries(data.data ?? {}).filter(([key]) =>
        (COMMANDE_UPDATABLE_COLUMNS as readonly string[]).includes(key),
      ),
    );
    if (Object.keys(filteredData).length > 0) {
      const { error: updateError } = await db
        .from("travaux_commandes")
        .update(filteredData)
        .eq("id", data.commandeId);
      if (updateError) throw new Error(`Mise à jour commande : ${updateError.message}`);
    }

    // 3. On marque le conflit comme résolu
    const { data: updated, error } = await db
      .from("travaux_commandes_historique")
      .update({ resolu: true })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(`Résolution historique échouée : ${error.message}`);

    // 4. Trace de la résolution dans l'historique (timeline) : la version écartée reste
    //    consultable via `avant` de la ligne de conflit, la version conservée via `apres`.
    if (importId) {
      const apres = data.data ?? {};
      const trace = {
        import_id: importId,
        commande_id: data.commandeId,
        operation: "resolution",
        avant: conflitRow?.avant ?? null,
        apres: { ...apres, version_conservee: data.keepVersion === "A" ? "ancienne" : "nouvelle" },
        resolu: true,
      };
      const { error: traceError } = await db.from("travaux_commandes_historique").insert(trace);
      if (traceError) throw new Error(`Trace de résolution : ${traceError.message}`);
    }

    return updated;
  });
