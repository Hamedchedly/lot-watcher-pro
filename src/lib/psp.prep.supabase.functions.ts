/**
 * PSP V6 — Persistance Supabase du Préparateur PSP (server functions, service_role).
 *
 * Toutes les écritures passent par le service_role (BYPASS RLS) ; le frontend
 * n'expose jamais service_role. Le gel (statut=figee) est défendu par les
 * triggers de la base — l'UI ne fait que le respecter, elle n'est pas la sécurité.
 *
 * Règles appliquées :
 *  · `getPspBrouillon` charge programmation + lignes + devis + reports +
 *    décisions + liens en quelques requêtes (aucun N+1) ;
 *  · `import_row_id` d'un lien commande est TOUJOURS résolu via psp_import_rows
 *    (numero_commande_interne ↔ travaux_commandes.numero_commande) — jamais fictif ;
 *    si introuvable → erreur métier explicite ;
 *  · `psp_decisions` : les NOT NULL réels (type_decision, cible_type, cible_id,
 *    proposition_initiale, valeur_retenue, statut) sont renseignés avec de vraies
 *    valeurs métier (cible_type='psp_ligne', cible_id=ligne.id).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  detecterRecherchePatrimoine,
  lotsDeAdresse,
  numerosDeRue,
  ruesDeTranche,
} from "./psp.prep.v7.ts";

export type PspLignePersist = {
  id: string;
  programmation_id: string;
  tranche_code: string;
  categorie: string;
  corps_etat_code: string | null;
  corps_etat: string | null;
  nature_travaux: string | null;
  programme: Record<string, number>;
  ligne_budget: string | null;
  remarques: string | null;
  statut: string;
  priorite: string;
  origine: string;
  created_at: string;
  updated_at: string;
};

export type PspBrouillonComplet = {
  programmation: {
    id: string;
    annee_debut: number;
    annee_fin: number;
    version: number;
    type: string;
    statut: string;
    remarques: string | null;
  } | null;
  lignes: PspLignePersist[];
  devis: Array<Record<string, unknown>>;
  reports: Array<Record<string, unknown>>;
  decisions: Array<Record<string, unknown>>;
  links: Array<Record<string, unknown>>;
  perimetres: PspPerimetrePersist[];
  enveloppes: PspEnveloppePersist[];
  /** Historique des lignes (V7.3) — batch, pour la fiche opération. */
  historique: Array<Record<string, unknown>>;
};

export type PspPerimetrePersist = {
  id: string;
  psp_ligne_id: string;
  tranche_code: string;
  niveau: "tranche" | "rue" | "adresse" | "lot";
  rue: string | null;
  numero: string | null;
  lot_id: string | null;
};

export type PspEnveloppePersist = {
  id: string;
  programmation_id: string;
  annee: number;
  categorie: "GE" | "GT" | "CP";
  montant: number;
};

const ligneInput = z.object({
  programmationId: z.string().uuid(),
  trancheCode: z.string().min(1),
  categorie: z.enum(["GE", "GT", "CP"]),
  corpsEtatCode: z.string().nullish(),
  corpsEtat: z.string().nullish(),
  natureTravaux: z.string().nullish(),
  programme: z.record(z.string(), z.number()),
  ligneBudget: z.string().nullish(),
  remarques: z.string().nullish(),
  statut: z
    .enum(["a_definir", "attente_agence", "attente_confirmation"])
    .optional()
    .default("a_definir"),
  priorite: z.enum(["prioritaire", "normale", "non_prioritaire"]).optional().default("normale"),
  origine: z.enum(["preparation", "report", "esquisse", "suivi"]).default("preparation"),
});
type LigneInput = z.infer<typeof ligneInput>;

const patchLigne = z.object({
  id: z.string().uuid(),
  trancheCode: z.string().min(1),
  categorie: z.enum(["GE", "GT", "CP"]),
  corpsEtatCode: z.string().nullish(),
  corpsEtat: z.string().nullish(),
  natureTravaux: z.string().nullish(),
  programme: z.record(z.string(), z.number()),
  ligneBudget: z.string().nullish(),
  remarques: z.string().nullish(),
  statut: z.enum(["a_definir", "attente_agence", "attente_confirmation"]).optional(),
  priorite: z.enum(["prioritaire", "normale", "non_prioritaire"]).optional(),
});

const idSchema = z.object({ id: z.string().uuid() });

const devisInput = z.object({
  pspLigneId: z.string().uuid(),
  entreprise: z.string().nullish(),
  dateDevis: z.string().nullish(),
  montant: z.number().positive().nullish(),
  statut: z
    .enum([
      "a_demander",
      "demande_envoyee",
      "recu",
      "a_analyser",
      "retenu",
      "non_retenu",
      "expire",
      "annule",
    ])
    .default("a_demander"),
  commentaire: z.string().nullish(),
  documentReference: z.string().nullish(),
});

const reportInput = z.object({
  sourceLigneId: z.string().uuid(),
  sourceAnnee: z.number().int().min(2000).max(2100),
  cibleLigneId: z.string().uuid(),
  cibleAnnee: z.number().int().min(2000).max(2100),
  montant: z.number().min(0),
  motif: z.string().nullish(),
});

const decisionInput = z.object({
  cleMetier: z.string().min(1),
  typeDecision: z.enum([
    "nature",
    "corps_etat",
    "perimetre_psp",
    "rapprochement",
    "report",
    "annulation",
    "conservation",
    "reevaluation",
    "conflit_categorie",
  ]),
  pspLigneId: z.string().uuid(),
  decisionUtilisateur: z.string().min(1),
  statut: z.enum(["valide", "validee", "proposition", "rejete"]).default("validee"),
  motif: z.string().nullish(),
  anneeCible: z.number().int().min(2000).max(2100).nullish(),
  montant: z.number().min(0).nullish(),
});

const commandLinkInput = z.object({
  commandeId: z.string().uuid(),
  pspLigneId: z.string().uuid(),
  justification: z.string().nullish(),
});

/** Charge le brouillon actif (2027-2031, officielle) + toutes ses relations. */
export const getPspBrouillon = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as undefined)
  .handler(async ({ data: _d }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase-ext/client.server");
    const db = supabaseAdmin as any;

    const { data: prog, error } = await db
      .from("psp_programmations")
      .select("*")
      .eq("type", "officielle")
      .eq("statut", "brouillon")
      .order("version", { ascending: false })
      .limit(1);
    if (error) throw new Error(`Lecture du brouillon : ${error.message}`);
    const programmation = prog?.[0] ?? null;

    // Aucun brouillon : on NE crée PAS automatiquement (V6.2 — l'utilisateur
    // déclenche explicitement la création via createPspProgrammation).
    if (!programmation) {
      return {
        programmation: null,
        lignes: [],
        devis: [],
        reports: [],
        decisions: [],
        links: [],
        perimetres: [],
        enveloppes: [],
      };
    }

    const pid = programmation.id;
    const { data: lignes, error: eL } = await db
      .from("psp_lignes")
      .select("*")
      .eq("programmation_id", pid)
      .order("tranche_code");
    if (eL) throw new Error(`Lecture des lignes : ${eL.message}`);

    const ids = ((lignes ?? []) as Array<{ id: string }>).map((l) => l.id);
    const devis = ids.length
      ? ((await db.from("psp_devis").select("*").in("psp_ligne_id", ids)).data ?? [])
      : [];
    const reports = ids.length
      ? ((
          await db
            .from("psp_reports")
            .select("*")
            .or(`source_ligne_id.in.(${ids.join(",")}),cible_ligne_id.in.(${ids.join(",")})`)
        ).data ?? [])
      : [];
    const decisions = ids.length
      ? ((await db.from("psp_decisions").select("*").in("psp_ligne_id", ids)).data ?? [])
      : [];
    const links = ids.length
      ? ((await db.from("psp_command_links").select("*").in("psp_ligne_id", ids)).data ?? [])
      : [];
    const perimetres = ids.length
      ? ((await db.from("psp_ligne_patrimoine").select("*").in("psp_ligne_id", ids)).data ?? [])
      : [];
    const enveloppes =
      (await db.from("psp_enveloppes").select("*").eq("programmation_id", pid)).data ?? [];
    const historique = ids.length
      ? ((
          await db
            .from("psp_ligne_historique")
            .select("*")
            .in("ligne_id", ids)
            .order("created_at", { ascending: false })
        ).data ?? [])
      : [];

    return {
      programmation: {
        id: programmation.id,
        annee_debut: programmation.annee_debut,
        annee_fin: programmation.annee_fin,
        version: programmation.version,
        type: programmation.type,
        statut: programmation.statut,
        remarques: programmation.remarques ?? null,
      },
      lignes: (lignes ?? []) as PspLignePersist[],
      devis,
      reports,
      decisions,
      links,
      perimetres: (perimetres ?? []) as PspPerimetrePersist[],
      enveloppes: (enveloppes ?? []) as PspEnveloppePersist[],
      historique: historique ?? [],
    };
  });

/**
 * Crée la préparation PSP 2027-2031 (officielle, brouillon, version 1).
 * Idempotent côté UI : si un brouillon existe déjà, on le retourne.
 */
export const createPspProgrammation = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as undefined)
  .handler(async ({ data: _d }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase-ext/client.server");
    const db = supabaseAdmin as any;

    const { data: prog, error } = await db
      .from("psp_programmations")
      .select("*")
      .eq("type", "officielle")
      .eq("statut", "brouillon")
      .order("version", { ascending: false })
      .limit(1);
    if (error) throw new Error(`Lecture du brouillon : ${error.message}`);
    if (prog?.[0]) return prog[0];

    const { data: created, error: e2 } = await db
      .from("psp_programmations")
      .insert({
        annee_debut: 2027,
        annee_fin: 2031,
        version: 1,
        type: "officielle",
        statut: "brouillon",
        remarques: "Préparation PSP 2027-2031",
      })
      .select("*")
      .single();
    if (e2) throw new Error(`Création de la préparation : ${e2.message}`);
    return created;
  });

/** Crée une ligne dans le brouillon (INSERT psp_lignes). */
export const createPspLigne = createServerFn({ method: "POST" })
  .validator((d: unknown) => ligneInput.parse(d))
  .handler(async ({ data }: { data: LigneInput }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase-ext/client.server");
    const db = supabaseAdmin as any;
    const { data: ligne, error } = await db
      .from("psp_lignes")
      .insert({
        programmation_id: data.programmationId,
        tranche_code: data.trancheCode,
        categorie: data.categorie,
        corps_etat_code: data.corpsEtatCode ?? null,
        corps_etat: data.corpsEtat ?? null,
        nature_travaux: data.natureTravaux ?? null,
        programme: data.programme,
        ligne_budget: data.ligneBudget ?? null,
        remarques: data.remarques ?? null,
        statut: data.statut,
        priorite: data.priorite,
        origine: data.origine,
      })
      .select("*")
      .single();
    if (error) throw new Error(`Création de la ligne : ${error.message}`);
    return ligne as PspLignePersist;
  });

/** Modifie une ligne du brouillon (UPDATE psp_lignes). */
export const updatePspLigne = createServerFn({ method: "POST" })
  .validator((d: unknown) => patchLigne.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase-ext/client.server");
    const db = supabaseAdmin as any;
    const { data: ligne, error } = await db
      .from("psp_lignes")
      .update({
        tranche_code: data.trancheCode,
        categorie: data.categorie,
        corps_etat_code: data.corpsEtatCode ?? null,
        corps_etat: data.corpsEtat ?? null,
        nature_travaux: data.natureTravaux ?? null,
        programme: data.programme,
        ligne_budget: data.ligneBudget ?? null,
        remarques: data.remarques ?? null,
        statut: data.statut,
        priorite: data.priorite,
      })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(`Modification de la ligne : ${error.message}`);
    return ligne as PspLignePersist;
  });

/** Supprime une ligne du brouillon (DELETE psp_lignes — bloqué en base si figée). */
export const deletePspLigne = createServerFn({ method: "POST" })
  .validator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase-ext/client.server");
    const db = supabaseAdmin as any;
    const { error } = await db.from("psp_lignes").delete().eq("id", data.id);
    if (error) throw new Error(`Suppression de la ligne : ${error.message}`);
    return { ok: true as const };
  });

/** Crée un devis pour une ligne (1..N). */
export const createPspDevis = createServerFn({ method: "POST" })
  .validator((d: unknown) => devisInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase-ext/client.server");
    const db = supabaseAdmin as any;
    const { data: devis, error } = await db
      .from("psp_devis")
      .insert({
        psp_ligne_id: data.pspLigneId,
        entreprise: data.entreprise ?? null,
        date_devis: data.dateDevis ?? null,
        montant: data.montant ?? null,
        statut: data.statut,
        commentaire: data.commentaire ?? null,
        document_reference: data.documentReference ?? null,
      })
      .select("*")
      .single();
    if (error) throw new Error(`Création du devis : ${error.message}`);
    return devis;
  });

/** Met à jour un devis (statut, montant, commentaire…). */
export const updatePspDevis = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        entreprise: z.string().nullish(),
        dateDevis: z.string().nullish(),
        montant: z.number().positive().nullish(),
        statut: z
          .enum([
            "a_demander",
            "demande_envoyee",
            "recu",
            "a_analyser",
            "retenu",
            "non_retenu",
            "expire",
            "annule",
          ])
          .optional(),
        commentaire: z.string().nullish(),
        documentReference: z.string().nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase-ext/client.server");
    const db = supabaseAdmin as any;
    const patch: Record<string, unknown> = {};
    if (data.entreprise !== undefined) patch["entreprise"] = data.entreprise ?? null;
    if (data.dateDevis !== undefined) patch["date_devis"] = data.dateDevis ?? null;
    if (data.montant !== undefined) patch["montant"] = data.montant ?? null;
    if (data.statut !== undefined) patch["statut"] = data.statut;
    if (data.commentaire !== undefined) patch["commentaire"] = data.commentaire ?? null;
    if (data.documentReference !== undefined)
      patch["document_reference"] = data.documentReference ?? null;
    const { data: devis, error } = await db
      .from("psp_devis")
      .update(patch)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(`Modification du devis : ${error.message}`);
    return devis;
  });

/** Supprime un devis. */
export const deletePspDevis = createServerFn({ method: "POST" })
  .validator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase-ext/client.server");
    const db = supabaseAdmin as any;
    const { error } = await db.from("psp_devis").delete().eq("id", data.id);
    if (error) throw new Error(`Suppression du devis : ${error.message}`);
    return { ok: true as const };
  });

// ═══════════════════════════════════════════════════════════════════════════════
// V7 — PÉRIMÈTRE PATRIMOINE, ENVELOPPES, STATUT/PRIORITÉ, RECHERCHE
// ═══════════════════════════════════════════════════════════════════════════════

const perimetresInput = z.object({
  pspLigneId: z.string().uuid(),
  trancheCode: z.string().min(1),
  perimetres: z
    .array(
      z.object({
        niveau: z.enum(["tranche", "rue", "adresse", "lot"]),
        rue: z.string().nullish(),
        numero: z.string().nullish(),
        lotId: z.string().uuid().nullish(),
      }),
    )
    .min(1),
});

const enveloppesInput = z.object({
  programmationId: z.string().uuid(),
  enveloppes: z
    .array(
      z.object({
        annee: z.number().int().min(2000).max(2100),
        categorie: z.enum(["GE", "GT", "CP"]),
        montant: z.number().min(0),
      }),
    )
    .min(1),
});

const statutPrioriteInput = z.object({
  id: z.string().uuid(),
  statut: z.enum(["a_definir", "attente_agence", "attente_confirmation"]).optional(),
  priorite: z.enum(["prioritaire", "normale", "non_prioritaire"]).optional(),
});

const rechercheTranchesInput = z.object({ q: z.string().max(20).default("") });

/**
 * Remplace le périmètre patrimonial d'une ligne (suppression des lignes
 * existantes puis insertion du nouvel ensemble — multi-lots autorisés, tous dans
 * la même tranche). Le gel (programmation figée) bloque la suppression en base.
 */
export const createPspPerimetres = createServerFn({ method: "POST" })
  .validator((d: unknown) => perimetresInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase-ext/client.server");
    const db = supabaseAdmin as any;
    const del = await db.from("psp_ligne_patrimoine").delete().eq("psp_ligne_id", data.pspLigneId);
    if (del.error) throw new Error(`Mise à jour du périmètre : ${del.error.message}`);
    const rows = data.perimetres.map((p) => ({
      psp_ligne_id: data.pspLigneId,
      tranche_code: data.trancheCode,
      niveau: p.niveau,
      rue: p.rue ?? null,
      numero: p.numero ?? null,
      lot_id: p.lotId ?? null,
    }));
    const { data: inserted, error } = await db
      .from("psp_ligne_patrimoine")
      .insert(rows)
      .select("*");
    if (error) throw new Error(`Enregistrement du périmètre : ${error.message}`);
    return (inserted ?? []) as PspPerimetrePersist[];
  });

/** Lit le périmètre patrimonial d'une ligne. */
export const getPspPerimetres = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ pspLigneId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase-ext/client.server");
    const db = supabaseAdmin as any;
    const { data: rows, error } = await db
      .from("psp_ligne_patrimoine")
      .select("*")
      .eq("psp_ligne_id", data.pspLigneId);
    if (error) throw new Error(`Lecture du périmètre : ${error.message}`);
    return (rows ?? []) as PspPerimetrePersist[];
  });

/** Enveloppes GE/GT/CP d'une programmation. */
export const getPspEnveloppes = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ programmationId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase-ext/client.server");
    const db = supabaseAdmin as any;
    const { data: rows, error } = await db
      .from("psp_enveloppes")
      .select("*")
      .eq("programmation_id", data.programmationId)
      .order("annee")
      .order("categorie");
    if (error) throw new Error(`Lecture des enveloppes : ${error.message}`);
    return (rows ?? []) as PspEnveloppePersist[];
  });

/** Enregistre les enveloppes (upsert sur UNIQUE(programmation_id, annee, categorie)). */
export const savePspEnveloppes = createServerFn({ method: "POST" })
  .validator((d: unknown) => enveloppesInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase-ext/client.server");
    const db = supabaseAdmin as any;
    const rows = data.enveloppes.map((e) => ({
      programmation_id: data.programmationId,
      annee: e.annee,
      categorie: e.categorie,
      montant: e.montant,
    }));
    const { data: saved, error } = await db
      .from("psp_enveloppes")
      .upsert(rows, { onConflict: "programmation_id,annee,categorie" })
      .select("*");
    if (error) throw new Error(`Enregistrement des enveloppes : ${error.message}`);
    return (saved ?? []) as PspEnveloppePersist[];
  });

/** Met à jour statut et/ou priorité d'une ligne (check contraintes en base). */
export const updatePspLigneStatutPriorite = createServerFn({ method: "POST" })
  .validator((d: unknown) => statutPrioriteInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase-ext/client.server");
    const db = supabaseAdmin as any;
    const patch: Record<string, string> = {};
    if (data.statut) patch["statut"] = data.statut;
    if (data.priorite) patch["priorite"] = data.priorite;
    const { data: ligne, error } = await db
      .from("psp_lignes")
      .update(patch)
      .eq("id", data.id)
      .select("id, statut, priorite")
      .single();
    if (error) throw new Error(`Mise à jour statut/priorité : ${error.message}`);
    return ligne;
  });

/** Recherche progressive de tranches (code/libellé/localité) — réutilisée par l'UI. */
export const rechercherTranches = createServerFn({ method: "POST" })
  .validator((d: unknown) => rechercheTranchesInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase-ext/client.server");
    const db = supabaseAdmin as any;
    // « TR1976 » → « 1976 » : le préfixe TR n'est pas stocké dans tranches.code.
    const brut = data.q.trim();
    const q = brut.replace(/^TR\s*/i, "");
    let query = db
      .from("tranches")
      .select("code, libelle, localite, sous_secteur, nb_logements")
      .eq("actif", true);
    if (q) {
      query = query.or(`code.ilike.${q}%,libelle.ilike.%${q}%,localite.ilike.%${q}%`);
    }
    const { data: rows, error } = await query.order("code").limit(20);
    if (error) throw new Error(`Recherche de tranches : ${error.message}`);
    return rows ?? [];
  });

/**
 * Recherche patrimoine GLOBALE (V7.3) : tranches (code / libellé / localité)
 * ET lots (ER / locataire / adresse) en parallèle, regroupés et étiquetés.
 * Le type est décidé par `detecterRecherchePatrimoine` :
 *  · numérique / « TR… » → tranches uniquement ;
 *  · « ER… »            → lots uniquement ;
 *  · texte libre        → les deux (ville/libellé ↔ locataire/adresse).
 */
export const rechercherPatrimoineGlobal = createServerFn({ method: "POST" })
  .validator((d: unknown) => rechercheTranchesInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase-ext/client.server");
    const db = supabaseAdmin as any;
    const brut = data.q.trim();
    const type = detecterRecherchePatrimoine(brut);
    const q = brut.replace(/^TR\s*/i, "");
    const result: {
      tranches: Array<{
        code: string;
        libelle: string | null;
        localite: string | null;
        sous_secteur: string | null;
        nb_logements: number | null;
      }>;
      lots: Array<{
        id: string;
        code_patrimoine: string;
        tranche_code: string;
        adresse: string | null;
        ville: string | null;
        locataire_nom: string | null;
      }>;
    } = { tranches: [], lots: [] };

    const chercheTranches = type === "tranche" || type === "mixte";
    const chercheLots = type === "lot" || type === "mixte";

    if (chercheTranches) {
      let query = db
        .from("tranches")
        .select("code, libelle, localite, sous_secteur, nb_logements")
        .eq("actif", true);
      if (q) {
        query = query.or(`code.ilike.${q}%,libelle.ilike.%${q}%,localite.ilike.%${q}%`);
      }
      const { data: rows, error } = await query.order("code").limit(20);
      if (!error) result.tranches = rows ?? [];
    }

    if (chercheLots) {
      let query = db
        .from("lots")
        .select("id, code_patrimoine, tranche_code, adresse, ville, locataire_nom, type_lot")
        .eq("actif", true);
      if (brut) {
        query = query.or(
          `code_patrimoine.ilike.%${brut}%,adresse.ilike.%${brut}%,locataire_nom.ilike.%${brut}%`,
        );
      }
      const { data: rows, error } = await query.order("code_patrimoine").limit(25);
      if (!error) result.lots = rows ?? [];
    }

    return result;
  });

/** Liste des corps d'état connus (DISTINCT travaux_commandes.corps_etat) — suggestions. */
export const getCorpsEtats = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ q: z.string().max(40).default("") }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase-ext/client.server");
    const db = supabaseAdmin as any;
    const PAGE = 1000;
    const set = new Set<string>();
    const ajouter = (rows: Array<Record<string, unknown>>) => {
      for (const r of rows) {
        const v = String(r["corps_etat"] ?? "").trim();
        if (v) set.add(v);
      }
    };
    // V7.5 §9 — toutes les commandes (plus de cap 500 qui pouvait cacher des corps).
    for (let from = 0; ; from += PAGE) {
      const { data: rows, error } = await db
        .from("travaux_commandes")
        .select("corps_etat")
        .not("corps_etat", "is", null)
        .range(from, from + PAGE - 1);
      if (error) throw new Error(`Lecture des corps d'état : ${error.message}`);
      const page = (rows ?? []) as Array<Record<string, unknown>>;
      ajouter(page);
      if (page.length < PAGE) break;
    }
    // Union : corps déjà saisis dans les lignes PSP (source légitime actuelle —
    // aucun corps masqué, pas de seconde table).
    const { data: lignes, error: errLignes } = await db
      .from("psp_lignes")
      .select("corps_etat")
      .not("corps_etat", "is", null);
    if (errLignes) throw new Error(`Lecture des corps d'état : ${errLignes.message}`);
    ajouter((lignes ?? []) as Array<Record<string, unknown>>);
    const q = data.q.trim().toLowerCase();
    const liste = [...set].sort((a, b) => a.localeCompare(b));
    return q ? liste.filter((c) => c.toLowerCase().includes(q)).slice(0, 20) : liste.slice(0, 40);
  });

/** Recherche progressive de lots (ER / locataire / adresse) — réutilise le moteur ciblé. */
export const rechercherLotsV7 = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z.object({ q: z.string().max(40).default(""), tranche: z.string().optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase-ext/client.server");
    const db = supabaseAdmin as any;
    let query = db
      .from("lots")
      .select("id, code_patrimoine, tranche_code, adresse, ville, locataire_nom, type_lot")
      .eq("actif", true);
    const q = data.q.trim();
    if (q) {
      query = query.or(
        `code_patrimoine.ilike.%${q}%,adresse.ilike.%${q}%,locataire_nom.ilike.%${q}%`,
      );
    }
    if (data.tranche) query = query.eq("tranche_code", data.tranche);
    const { data: rows, error } = await query.order("code_patrimoine").limit(25);
    if (error) throw new Error(`Recherche de lots : ${error.message}`);
    return rows ?? [];
  });

/** Rues distinctes d'une tranche (réutilise `rueDe` — hiérarchie TR → rues → numéros). */
export const rechercherRuesTranche = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z.object({ tranche: z.string().min(1), q: z.string().max(40).default("") }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase-ext/client.server");
    const db = supabaseAdmin as any;
    const { data: rows, error } = await db
      .from("lots")
      .select("adresse, ville")
      .eq("tranche_code", data.tranche)
      .eq("actif", true)
      .limit(600);
    if (error) throw new Error(`Lecture des rues : ${error.message}`);
    return ruesDeTranche(
      (rows ?? []) as Array<{ adresse: string | null; ville: string | null }>,
      data.q,
    );
  });

/** Numéros/entrées disponibles d'une rue dans une tranche. */
export const rechercherNumerosRue = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z.object({ tranche: z.string().min(1), rue: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase-ext/client.server");
    const db = supabaseAdmin as any;
    const { data: rows, error } = await db
      .from("lots")
      .select("adresse, ville")
      .eq("tranche_code", data.tranche)
      .eq("actif", true)
      .limit(600);
    if (error) throw new Error(`Lecture des numéros : ${error.message}`);
    return numerosDeRue(
      (rows ?? []) as Array<{ adresse: string | null; ville: string | null }>,
      data.rue,
    );
  });

/** Lots d'une entrée précise (« 12 RUE CORNILLIOT ») dans une tranche — multi-sélection. */
export const rechercherLotsAdresse = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z.object({ tranche: z.string().min(1), adresse: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase-ext/client.server");
    const db = supabaseAdmin as any;
    const { data: rows, error } = await db
      .from("lots")
      .select("id, code_patrimoine, tranche_code, adresse, ville, locataire_nom, type_lot")
      .eq("tranche_code", data.tranche)
      .eq("actif", true)
      .limit(600);
    if (error) throw new Error(`Lecture des lots de l'adresse : ${error.message}`);
    return lotsDeAdresse(
      (rows ?? []) as Array<{ id: string; code_patrimoine: string; adresse: string | null }>,
      data.adresse,
    );
  });

/** Crée un report source → cible (la ligne cible porte origine='report'). */
export const createPspReport = createServerFn({ method: "POST" })
  .validator((d: unknown) => reportInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase-ext/client.server");
    const db = supabaseAdmin as any;
    const { data: report, error } = await db
      .from("psp_reports")
      .insert({
        source_ligne_id: data.sourceLigneId,
        source_annee: data.sourceAnnee,
        cible_ligne_id: data.cibleLigneId,
        cible_annee: data.cibleAnnee,
        montant: data.montant,
        motif: data.motif ?? null,
      })
      .select("*")
      .single();
    if (error) throw new Error(`Création du report : ${error.message}`);
    return report;
  });

/**
 * Enregistre une décision PSP (généralisation de savePspDecision) dans
 * psp_decisions. Les NOT NULL réels sont renseignés : cible_type='psp_ligne',
 * cible_id=ligne.id, proposition_initiale/valeur_retenue = état du programme.
 */
export const saveDecisionPsp = createServerFn({ method: "POST" })
  .validator((d: unknown) => decisionInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase-ext/client.server");
    const db = supabaseAdmin as any;
    const now = new Date().toISOString();
    const { data: ligne } = await db
      .from("psp_lignes")
      .select("programme")
      .eq("id", data.pspLigneId)
      .single();
    const programme = (ligne?.programme ?? {}) as Record<string, number>;
    const payload = {
      cle_metier: data.cleMetier,
      type_decision: data.typeDecision,
      cible_type: "psp_ligne",
      cible_id: data.pspLigneId,
      proposition_initiale: programme,
      valeur_retenue: data.anneeCible
        ? { [String(data.anneeCible)]: data.montant ?? 0 }
        : programme,
      decision_utilisateur: data.decisionUtilisateur,
      statut: data.statut,
      motif: data.motif ?? null,
      psp_ligne_id: data.pspLigneId,
      annee_cible: data.anneeCible ?? null,
      montant: data.montant ?? null,
      created_at: now,
      updated_at: now,
    };
    const { data: inserted, error } = await db
      .from("psp_decisions")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw new Error(`Enregistrement de la décision : ${error.message}`);
    return inserted;
  });

/**
 * Rattache une commande existante à une ligne PSP via psp_command_links.
 * import_row_id est TOUJOURS résolu réellement (psp_import_rows.numero_commande_interne
 * ↔ travaux_commandes.numero_commande). Si introuvable → erreur métier, aucune
 * liaison créée.
 */
export const createPspCommandLink = createServerFn({ method: "POST" })
  .validator((d: unknown) => commandLinkInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase-ext/client.server");
    const db = supabaseAdmin as any;

    const { data: commande } = await db
      .from("travaux_commandes")
      .select("numero_commande")
      .eq("id", data.commandeId)
      .single();
    if (!commande?.numero_commande) {
      throw new Error(
        "Impossible de rattacher la commande à la ligne PSP : import d'origine introuvable.",
      );
    }
    const numero = String(commande.numero_commande).trim();
    const { data: importRows } = await db
      .from("psp_import_rows")
      .select("id")
      .eq("numero_commande_interne", numero)
      .limit(1);
    const importRow = importRows?.[0];
    if (!importRow?.id) {
      throw new Error(
        "Impossible de rattacher la commande à la ligne PSP : import d'origine introuvable.",
      );
    }

    const { data: link, error } = await db
      .from("psp_command_links")
      .insert({
        commande_id: data.commandeId,
        import_row_id: importRow.id,
        psp_ligne_id: data.pspLigneId,
        type_relation: "rattachement_ligne",
        methode: "manuel",
        confiance: 1,
        statut: "valide",
        justification: data.justification ?? "Rattachement manuel ligne PSP ↔ commande",
      })
      .select("*")
      .single();
    if (error) throw new Error(`Rattachement de la commande : ${error.message}`);
    return link;
  });
// ── V7.3 — fournisseurs, opérations ATOMIQUES, historique ──────────────────────

/**
 * Recherche progressive des fournisseurs (nom OU code/alias) pour le devis de la
 * ligne de saisie. Réutilise `rechercherFournisseurs` (src/lib/fournisseurs.ts).
 */
export const rechercherFournisseursDevis = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ q: z.string().max(40).default("") }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase-ext/client.server");
    const db = supabaseAdmin as any;
    const { data: fournisseurs, error } = await db
      .from("fournisseurs")
      .select("id, nom, ville")
      .order("nom", { ascending: true });
    if (error) throw new Error(`Lecture des fournisseurs : ${error.message}`);
    const { data: aliasesData, error: eA } = await db
      .from("fournisseur_aliases")
      .select("fournisseur_id, source, identifiant_source");
    if (eA) throw new Error(`Lecture des alias fournisseurs : ${eA.message}`);
    const aliasesPar = new Map<string, Array<{ source: string; identifiant_source: string }>>();
    for (const a of aliasesData ?? []) {
      const id = String(a["fournisseur_id"] ?? "");
      if (!id) continue;
      aliasesPar.set(id, [
        ...(aliasesPar.get(id) ?? []),
        {
          source: String(a["source"] ?? ""),
          identifiant_source: String(a["identifiant_source"] ?? ""),
        },
      ]);
    }
    const liste = (fournisseurs ?? []) as Array<{ id: string; nom: string; ville: string | null }>;
    const { rechercherFournisseurs } = await import("@/lib/fournisseurs");
    const q = data.q.trim();
    const trouves = rechercherFournisseurs(
      liste,
      aliasesPar as Map<string, import("@/lib/fournisseurs").FournisseurAlias[]>,
      q,
    ).slice(0, 20);
    return trouves.map((f) => {
      const codes = (aliasesPar.get(f.id) ?? []).map((a) => a.identifiant_source);
      return { id: f.id, nom: f.nom, ville: f.ville, codes };
    });
  });

/** Périmètre jsonb pour les RPC atomiques (niveau/rue/numero/lotId). */
const perimetreInput = z.array(
  z.object({
    niveau: z.enum(["tranche", "rue", "adresse", "lot"]),
    rue: z.string().nullish(),
    numero: z.string().nullish(),
    lotId: z.string().uuid().nullish(),
  }),
);

/** Devis jsonb pour les RPC atomiques. */
const devisRpcInput = z
  .array(
    z.object({
      fournisseurId: z.string().uuid().nullish(),
      entreprise: z.string().nullish(),
      dateDevis: z.string().nullish(),
      montant: z.number().nullish(),
      statut: z.string().nullish(),
      commentaire: z.string().nullish(),
      documentReference: z.string().nullish(),
    }),
  )
  .nullish();

/**
 * Création ATOMIQUE (V7.3) : ligne + périmètre + devis via le RPC
 * public.create_psp_operation. Échec → aucun résidu (rollback plpgsql).
 */
export const createPspOperationComplete = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z
      .object({
        programmationId: z.string().uuid(),
        trancheCode: z.string().min(1),
        categorie: z.enum(["GE", "GT", "CP"]),
        corpsEtatCode: z.string().nullish(),
        corpsEtat: z.string().nullish(),
        natureTravaux: z.string().nullish(),
        programme: z.record(z.string(), z.number()),
        ligneBudget: z.string().nullish(),
        remarques: z.string().nullish(),
        statut: z.string().nullish(),
        priorite: z.string().nullish(),
        origine: z.string().nullish(),
        perimetres: perimetreInput.default([]),
        devis: devisRpcInput,
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase-ext/client.server");
    const db = supabaseAdmin as any;
    const perimetres = (data.perimetres ?? []).map((p) => ({
      niveau: p.niveau,
      rue: p.rue ?? null,
      numero: p.numero ?? null,
      lot_id: p.lotId ?? null,
    }));
    const devis = (data.devis ?? []).map((d) => ({
      fournisseur_id: d.fournisseurId ?? null,
      entreprise: d.entreprise ?? null,
      date_devis: d.dateDevis ?? null,
      montant: d.montant ?? null,
      statut: d.statut ?? "recu",
      commentaire: d.commentaire ?? null,
      document_reference: d.documentReference ?? null,
    }));
    const { data: ligne, error } = await db.rpc("create_psp_operation", {
      p_programmation_id: data.programmationId,
      p_tranche_code: data.trancheCode,
      p_categorie: data.categorie,
      p_corps_etat_code: data.corpsEtatCode ?? null,
      p_corps_etat: data.corpsEtat ?? null,
      p_nature_travaux: data.natureTravaux ?? null,
      p_programme: data.programme,
      p_ligne_budget: data.ligneBudget ?? null,
      p_remarques: data.remarques ?? null,
      p_statut: data.statut ?? null,
      p_priorite: data.priorite ?? null,
      p_origine: data.origine ?? "preparation",
      p_perimetres: perimetres,
      p_devis: devis.length > 0 ? devis : null,
    });
    if (error) throw new Error(`Création de l'opération : ${error.message}`);
    return ligne as PspLignePersist;
  });
/**
 * Modification ATOMIQUE (V7.3) : ligne + remplacement du périmètre via le RPC
 * public.update_psp_operation. Échec → aucun résidu.
 */
export const updatePspOperationComplete = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        trancheCode: z.string().min(1),
        categorie: z.enum(["GE", "GT", "CP"]),
        corpsEtatCode: z.string().nullish(),
        corpsEtat: z.string().nullish(),
        natureTravaux: z.string().nullish(),
        programme: z.record(z.string(), z.number()),
        remarques: z.string().nullish(),
        statut: z.string().nullish(),
        priorite: z.string().nullish(),
        perimetres: perimetreInput.default([]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase-ext/client.server");
    const db = supabaseAdmin as any;
    const perimetres = (data.perimetres ?? []).map((p) => ({
      niveau: p.niveau,
      rue: p.rue ?? null,
      numero: p.numero ?? null,
      lot_id: p.lotId ?? null,
    }));
    const { data: ligne, error } = await db.rpc("update_psp_operation", {
      p_id: data.id,
      p_tranche_code: data.trancheCode,
      p_categorie: data.categorie,
      p_corps_etat_code: data.corpsEtatCode ?? null,
      p_corps_etat: data.corpsEtat ?? null,
      p_nature_travaux: data.natureTravaux ?? null,
      p_programme: data.programme,
      p_remarques: data.remarques ?? null,
      p_statut: data.statut ?? null,
      p_priorite: data.priorite ?? null,
      p_perimetres: perimetres,
    });
    if (error) throw new Error(`Modification de l'opération : ${error.message}`);
    return ligne as PspLignePersist;
  });

/** Historique des modifications des lignes (psp_ligne_historique, batch). */
export const getPspLignesHistorique = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ ids: z.array(z.string().uuid()) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase-ext/client.server");
    const db = supabaseAdmin as any;
    if (data.ids.length === 0) return [];
    const { data: rows, error } = await db
      .from("psp_ligne_historique")
      .select("*")
      .in("ligne_id", data.ids)
      .order("created_at", { ascending: false });
    if (error) throw new Error(`Lecture de l'historique : ${error.message}`);
    return rows ?? [];
  });
