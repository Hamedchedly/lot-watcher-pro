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

export type TravauxDashboardData = {
  commandes: CommandeTravaux[];
  historique: HistoriqueTravaux[];
};

export const getTravauxDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase-ext/client.server");
  const db = supabaseAdmin as any;
  const [commandesResult, historiqueResult] = await Promise.all([
    db.from("travaux_commandes").select("*").eq("actif", true).order("engage", { ascending: false, nullsFirst: false }),
    db.from("travaux_commandes_historique").select("*").eq("operation", "modification").order("created_at", { ascending: false }),
  ]);
  if (commandesResult.error) throw new Error(`Chargement des commandes : ${commandesResult.error.message}`);
  if (historiqueResult.error) throw new Error(`Chargement de l'historique : ${historiqueResult.error.message}`);
  return {
    commandes: (commandesResult.data ?? []) as CommandeTravaux[],
    historique: (historiqueResult.data ?? []) as HistoriqueTravaux[],
  } satisfies TravauxDashboardData;
});
