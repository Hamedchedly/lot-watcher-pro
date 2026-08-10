import { createServerFn } from "@tanstack/react-start";

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
};

export type ImportTravaux = {
  id: string;
  fichier: string;
  lignes: number;
  creees: number;
  modifiees: number;
  doublons: number;
  erreurs: number;
  archivees: number;
  statut: string;
  demarre_at: string;
  termine_at: string | null;
};

export type TravauxDashboardData = {
  commandes: CommandeTravaux[];
  historique: HistoriqueTravaux[];
  imports: ImportTravaux[];
};

export const getTravauxDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase-ext/client.server");
  const db = supabaseAdmin as any;
  const [commandesResult, historiqueResult, importsResult] = await Promise.all([
    db.from("travaux_commandes").select("*").eq("actif", true).order("engage", { ascending: false, nullsFirst: false }),
    db.from("travaux_commandes_historique").select("*, travaux_commandes(numero_commande)").eq("operation", "modification").order("created_at", { ascending: false }),
    db.from("import_travaux").select("*").order("demarre_at", { ascending: false }).limit(5),
  ]);
  if (commandesResult.error) throw new Error(`Chargement des commandes : ${commandesResult.error.message}`);
  if (historiqueResult.error) throw new Error(`Chargement de l'historique : ${historiqueResult.error.message}`);
  if (importsResult.error) throw new Error(`Chargement des imports : ${importsResult.error.message}`);
  
  return {
    commandes: (commandesResult.data ?? []) as CommandeTravaux[],
    historique: (historiqueResult.data ?? []) as (HistoriqueTravaux & { travaux_commandes: { numero_commande: string } })[],
    imports: (importsResult.data ?? []) as ImportTravaux[],
  } satisfies TravauxDashboardData;
});

export const updateCommandeTravaux = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    const { z } = require("zod");
    return z.object({
      id: z.string().uuid(),
      data: z.record(z.any())
    }).parse(d);
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase-ext/client.server");
    const db = supabaseAdmin as any;
    
    // Liste des colonnes autorisées pour l'update (basée sur VALID_COLUMNS de travaux.functions.ts)
    const VALID_COLUMNS = [
      "numero_commande", "secteur", "tranche_code", "lot_code", "batiment", "charge_clientele", "adresse",
      "nature_analytique", "corps_etat", "charge_operation", "ligne_budget", "descriptif", "budget",
      "numero_fournisseur", "fournisseur", "etat_commande", "engage", "ecart", "paye", "solde",
      "etat_travaux", "date_demarrage", "date_fin_travaux", "observations", "support_communication",
      "date_communication"
    ];
    
    const filteredData = Object.fromEntries(
      Object.entries(data.data).filter(([key]) => VALID_COLUMNS.includes(key))
    );
    
    const { data: updated, error } = await db.from("travaux_commandes").update(filteredData).eq("id", data.id).select("*").single();
    if (error) throw new Error(`Mise à jour échouée : ${error.message}`);
    return updated;
  });

export const getTravauxStats = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase-ext/client.server");
  const db = supabaseAdmin as any;
  
  // Agrégation par ville, secteur, programmation, etc.
  // Note: Comme on ne peut pas modifier le schéma, on fait l'agrégation sur les données brutes
  // mais on pourrait utiliser des fonctions RPC Supabase pour plus d'efficacité si besoin.
  const { data, error } = await db.from("travaux_commandes").select("engage, budget, paye, ligne_budget, corps_etat, secteur, adresse, date_demarrage, date_fin_travaux, date_communication").eq("actif", true);
  if (error) throw new Error(error.message);
  return data;
});
