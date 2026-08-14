/**
 * PSP — Lecture LECTURE SEULE des vraies données PAT S11 (V2).
 *
 * Trois requêtes (aucun N+1) :
 *  - `tranches`            → localité / sous-secteur / secteur S11 / nb logements ;
 *  - `lots`                → adresse / ville de référence par TR (paginé 1000) ;
 *  - `travaux_commandes`   → chargé de clientèle par TR (paginé 1000).
 *
 * Aucune écriture : uniquement des `.select(...)` sur des tables existantes.
 * La référence est construite côté client (`psp.prep.data.ts`) à partir des
 * tableaux bruts renvoyés (une `Map` ne se sérialise pas proprement).
 */
import { createServerFn } from "@tanstack/react-start";

import type { CommandeRaw, LotRaw, TrancheRaw } from "./psp.prep.data.ts";

export type DonneesReferenceBrutes = {
  tranches: TrancheRaw[];
  lots: LotRaw[];
  commandes: CommandeRaw[];
};

export const getPspReferencePatrimoine = createServerFn({ method: "GET" }).handler(
  async (): Promise<DonneesReferenceBrutes> => {
    const { supabaseAdmin } = await import("@/integrations/supabase-ext/client.server");
    const db = supabaseAdmin as any;

    const PAGE = 1000;

    const tranchesResult = await db
      .from("tranches")
      .select("code, libelle, localite, sous_secteur, secteur, nb_logements")
      .eq("actif", true);
    if (tranchesResult.error) {
      throw new Error(`Lecture des tranches : ${tranchesResult.error.message}`);
    }

    const chargerPage = async (table: string, colonnes: string, from: number) =>
      db
        .from(table)
        .select(colonnes)
        .order("created_at")
        .range(from, from + PAGE - 1);

    const lots: LotRaw[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await chargerPage("lots", "tranche_code, adresse, ville", from);
      if (error) throw new Error(`Lecture des lots : ${error.message}`);
      const page = (data ?? []) as LotRaw[];
      lots.push(...page);
      if (page.length < PAGE) break;
    }

    const commandes: CommandeRaw[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await chargerPage(
        "travaux_commandes",
        "tranche_code, charge_clientele",
        from,
      );
      if (error) throw new Error(`Lecture des commandes : ${error.message}`);
      const page = (data ?? []) as CommandeRaw[];
      commandes.push(...page);
      if (page.length < PAGE) break;
    }

    return {
      tranches: (tranchesResult.data ?? []) as TrancheRaw[],
      lots,
      commandes,
    };
  },
);
