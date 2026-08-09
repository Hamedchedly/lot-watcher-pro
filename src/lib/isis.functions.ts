import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const trancheSchema = z.object({
  code: z.string(),
  libelle: z.string().nullable(),
  localite: z.string().nullable(),
  copro_numero: z.string().nullable(),
  secteur: z.string().nullable(),
  sous_secteur: z.string().nullable(),
  quartier: z.string().nullable(),
  zone_edf: z.string().nullable(),
  zone_apl: z.string().nullable(),
  nb_logements: z.number(),
});

const lotSchema = z.object({
  code_patrimoine: z.string(),
  tranche_code: z.string(),
  type_lot: z.string().nullable(),
  batiment: z.string().nullable(),
  etage: z.string().nullable(),
  porte: z.string().nullable(),
  surface_utile: z.number().nullable(),
  dpe: z.string().nullable(),
  date_dpe: z.string().nullable(),
  identifiant_insee: z.string().nullable(),
  individuel_collectif: z.string().nullable(),
  date_achevement_travaux: z.string().nullable(),
  adresse: z.string().nullable(),
  code_postal: z.string().nullable(),
  ville: z.string().nullable(),
  locataire_nom: z.string().nullable(),
  locataire_telephone: z.string().nullable(),
  locataire_email: z.string().nullable(),
  date_entree: z.string().nullable(),
});

const occupantSchema = z.object({
  lot_code: z.string(),
  nom: z.string().nullable(),
  prenom: z.string().nullable(),
  date_naissance: z.string().nullable(),
  date_entree: z.string().nullable(),
});

const batchSchema = z.object({
  runDate: z.string(),
  tranches: z.array(trancheSchema).default([]),
  lots: z.array(lotSchema).default([]),
  occupants: z.array(occupantSchema).default([]),
});

/** Upsert d'un lot de lignes ISIS (rapprochement sur la clé métier). */
export const importIsisBatch = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => batchSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.tranches.length) {
      const { error } = await supabaseAdmin
        .from("tranches")
        .upsert(
          data.tranches.map((t) => ({ ...t, actif: true, vu_le: data.runDate })),
          { onConflict: "code" },
        );
      if (error) throw new Error(`tranches: ${error.message}`);
    }

    if (data.lots.length) {
      const { error } = await supabaseAdmin
        .from("lots")
        .upsert(
          data.lots.map((l) => ({ ...l, actif: true, vu_le: data.runDate })),
          { onConflict: "code_patrimoine" },
        );
      if (error) throw new Error(`lots: ${error.message}`);
    }

    if (data.occupants.length) {
      const { error } = await supabaseAdmin
        .from("occupants")
        .upsert(data.occupants, { onConflict: "lot_code,nom,prenom,date_naissance" });
      if (error) throw new Error(`occupants: ${error.message}`);
    }

    return { ok: true };
  });

/** Clôture de l'import : marque comme sorties de patrimoine les lignes absentes du dernier export. */
export const finalizeIsisImport = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ runDate: z.string(), fichier: z.string(), lignes: z.number() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const disparus = await supabaseAdmin
      .from("lots")
      .update({ actif: false })
      .neq("vu_le", data.runDate)
      .eq("actif", true)
      .select("code_patrimoine");
    if (disparus.error) throw new Error(disparus.error.message);

    const trDisparues = await supabaseAdmin
      .from("tranches")
      .update({ actif: false })
      .neq("vu_le", data.runDate)
      .eq("actif", true)
      .select("code");
    if (trDisparues.error) throw new Error(trDisparues.error.message);

    const [{ count: lots }, { count: tranches }] = await Promise.all([
      supabaseAdmin.from("lots").select("*", { count: "exact", head: true }).eq("actif", true),
      supabaseAdmin.from("tranches").select("*", { count: "exact", head: true }).eq("actif", true),
    ]);

    const { error } = await supabaseAdmin.from("imports").insert({
      fichier: data.fichier,
      lignes: data.lignes,
      lots_crees: lots ?? 0,
      tranches_creees: tranches ?? 0,
      lots_disparus: disparus.data?.length ?? 0,
    });
    if (error) throw new Error(error.message);

    return {
      lotsActifs: lots ?? 0,
      tranchesActives: tranches ?? 0,
      lotsSortis: disparus.data?.length ?? 0,
      tranchesSorties: trDisparues.data?.length ?? 0,
    };
  });

/** Vue synthétique du patrimoine pour le tableau de bord. */
export const getPatrimoine = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const tranches = await supabaseAdmin
    .from("tranches")
    .select("code, libelle, localite, copro_numero, sous_secteur, nb_logements, actif")
    .eq("actif", true)
    .order("code");
  if (tranches.error) throw new Error(tranches.error.message);

  // PostgREST plafonne à 1000 lignes : on pagine jusqu'à récupérer tout le patrimoine.
  const PAGE = 1000;
  const lots: NonNullable<Awaited<ReturnType<typeof fetchLotsPage>>> = [];
  async function fetchLotsPage(from: number) {
    const { data, error } = await supabaseAdmin
      .from("lots")
      .select(
        "code_patrimoine, tranche_code, type_lot, batiment, etage, porte, surface_utile, dpe, ville, code_postal, adresse, locataire_nom, locataire_telephone, locataire_email, date_entree, date_achevement_travaux",
      )
      .eq("actif", true)
      .order("code_patrimoine")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  for (let from = 0; ; from += PAGE) {
    const page = await fetchLotsPage(from);
    lots.push(...page);
    if (page.length < PAGE) break;
  }

  return { tranches: tranches.data ?? [], lots };
});

const occupantsSchema = z.object({ lotCode: z.string().min(1).max(64) });

/** Occupants enregistrés pour un lot (fiche locataire). */
export const getOccupants = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => occupantsSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("occupants")
      .select("nom, prenom, date_naissance, date_entree")
      .eq("lot_code", data.lotCode)
      .order("date_entree", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
