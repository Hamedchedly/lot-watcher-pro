import { createServerFn } from "@tanstack/react-start";

export type TravauxDashboardData = {
  commandes: Record<string, unknown>[];
  historique: Record<string, unknown>[];
};

export const getTravauxDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const [commandesResult, historiqueResult] = await Promise.all([
    db.from("travaux_commandes").select("*").eq("actif", true).order("engage", { ascending: false, nullsFirst: false }),
    db.from("travaux_commandes_historique").select("*").eq("operation", "modification").order("created_at", { ascending: false }),
  ]);
  if (commandesResult.error) throw new Error(`Chargement des commandes : ${commandesResult.error.message}`);
  if (historiqueResult.error) throw new Error(`Chargement de l'historique : ${historiqueResult.error.message}`);
  return {
    commandes: (commandesResult.data ?? []) as Record<string, unknown>[],
    historique: (historiqueResult.data ?? []) as Record<string, unknown>[],
  } satisfies TravauxDashboardData;
});
