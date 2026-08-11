/**
 * PSP — Server functions de l'écran de validation des classifications.
 *
 * Module ISOLÉ : ne lit que les tables psp_* (psp_imports, psp_import_rows,
 * psp_feedback) en LECTURE SEULE pour l'aperçu / le détail. Aucune écriture
 * ici : les décisions humaines passent par `savePspFeedback` (psp.functions.ts).
 *
 * Les propositions de classification sont calculées DE MANIÈRE DÉTERMINISTE à
 * partir des lignes importées via le module pur `psp.classification.ts`
 * (aucun stockage, aucune duplication). NAAC_CODE n'est jamais modifié.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { classifierCommande, construireGroupesValidation } from "./psp.classification.ts";
import {
  CHARGES_OPERATION_EXCLUS_PAR_DEFAUT,
  calculerScorePriorite,
  construireGroupeApercu,
  detecterCorrectionsRecurrentes,
  resoudrePerimetrePsp,
  type PspCommandeValidation,
  type PspGroupeApercu,
} from "./psp.validation.ts";

const detailSchema = z.object({ comn: z.string().min(1) });

const apercuSchema = z
  .object({
    /** Chargés d'opération exclus du PSP (décision humaine configurable). */
    charges_operation_exclus: z.array(z.string()).optional(),
    /** Overrides manuels : COMN_NUM réintégrés exceptionnellement dans le PSP. */
    overrides_eligible: z.array(z.string()).optional(),
  })
  .default({});

/**
 * Aperçu de la validation : dernier import + commandes (source + classification
 * + score + périmètre PSP) + groupes de validation + statistiques + suggestions
 * de règles récurrentes (lecture seule).
 */
export const getPspValidationApercu = createServerFn({ method: "POST" })
  .validator((d: unknown) => apercuSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("../integrations/supabase-ext/client.server");
    const db = supabaseAdmin as any;

    const chargesExclus =
      data.charges_operation_exclus ?? CHARGES_OPERATION_EXCLUS_PAR_DEFAUT;
    const overrides = data.overrides_eligible ?? [];

    const { data: imps, error: errImports } = await db
      .from("psp_imports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1);
    if (errImports) throw new Error(`Lecture des imports PSP : ${errImports.message}`);
    const imp = imps?.[0];
    if (!imp) throw new Error("Aucun import PSP trouvé.");

    const { data: rows, error: errRows } = await db
      .from("psp_import_rows")
      .select(
        "numero_commande_interne, numero_commande, patrimoine, adresse, commune, nature_analytique, corps_etat_libelle, montant_budget, montant_engage, fournisseur, date_commande, er_reference, donnees_brutes",
      )
      .eq("import_id", imp.id);
    if (errRows) throw new Error(`Lecture des lignes PSP : ${errRows.message}`);

    // Chargé d'opération (UTIC_CODE) depuis donnees_brutes si capturé
    // (absent de l'import actuel — la dimension reste disponible en futur).
    const extraireCharge = (db_: Record<string, unknown> | null | undefined): string | null => {
      const d = db_ ?? {};
      const v =
        d.charge_operation ?? d.utic_code ?? d.utic ?? d["UTIC_CODE"] ?? null;
      return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
    };

    // Classification + score + périmètre (déterministe, en mémoire)
    const commandes: PspCommandeValidation[] = (rows ?? []).map((r) => {
      const cls = classifierCommande({
        comn: r.numero_commande_interne,
        comc: r.numero_commande,
        naac: r.nature_analytique,
        wnature: r.corps_etat_libelle ?? "",
        patrimoine: r.patrimoine,
        montant_engage: r.montant_engage,
      });
      const charge = extraireCharge(r.donnees_brutes);
      const perim = resoudrePerimetrePsp({
        naac: r.nature_analytique,
        wnature: r.corps_etat_libelle ?? "",
        charge_operation: charge,
        charges_operation_exclus: chargesExclus,
        override_eligible: overrides.includes(r.numero_commande_interne),
      });
      const score = calculerScorePriorite({
        montant_engage: r.montant_engage,
        confiance: cls.confiance,
        exceptionnelle: cls.nature_exceptionnelle !== "aucune",
        multi_domaine: cls.domaine_technique === "multi_domaine",
        domaine_technique: cls.domaine_technique,
        type_intervention: cls.type_intervention,
      });
      const motifValidation: string[] = [];
      if (cls.besoin_validation_humaine) {
        if (cls.domaine_technique === "multi_domaine") motifValidation.push("multi-domaines");
        if (cls.type_intervention === "indetermine" || cls.domaine_technique === "indetermine")
          motifValidation.push("indéterminé");
        if (cls.nature_exceptionnelle !== "aucune") motifValidation.push("exceptionnel");
        if (cls.projet_relais_chelles) motifValidation.push("projet global");
        if (cls.confiance < 0.6) motifValidation.push(`confiance ${cls.confiance.toFixed(2)}`);
      }
      return {
        comn: cls.comn,
        comc: r.numero_commande ?? null,
        naac: cls.naac_source,
        patrimoine: r.patrimoine ?? null,
        adresse: r.adresse ?? null,
        commune: r.commune ?? null,
        wnature: r.corps_etat_libelle ?? "",
        montant_budget: r.montant_budget ?? null,
        montant_engage: r.montant_engage ?? null,
        fournisseur: r.fournisseur ?? null,
        date_commande: r.date_commande ?? null,
        er_reference: r.er_reference ?? null,
        type_intervention: cls.type_intervention,
        domaine_technique: cls.domaine_technique,
        domaines_detectes: cls.domaines_detectes,
        famille_psp: cls.famille_psp,
        element_patrimonial: cls.element_patrimonial,
        nature_exceptionnelle: cls.nature_exceptionnelle,
        confiance: cls.confiance,
        besoin_validation_humaine: cls.besoin_validation_humaine,
        regle_appliquee: cls.regle_appliquee,
        justification: cls.justification,
        projet_relais_chelles: cls.projet_relais_chelles,
        libelle_normalise: cls.libelle_normalise,
        motif_validation: motifValidation,
        score_priorite: score.score,
        niveau_priorite: score.niveau,
        raisons_priorite: score.raisons,
        charge_operation: charge,
        perimetre_psp: perim.perimetre_psp,
        motif_exclusion: perim.motif_exclusion,
        categorie_psp: perim.categorie_psp,
        est_pmr: perim.est_pmr,
      };
    });

    // Groupes de validation (uniquement les commandes à valider, clé stricte)
    const classifications = commandes.map((c) =>
      classifierCommande({
        comn: c.comn,
        comc: c.comc,
        naac: c.naac,
        wnature: c.wnature,
        patrimoine: c.patrimoine,
        montant_engage: c.montant_engage,
      }),
    );
    const groupesBruts = construireGroupesValidation(classifications);
    const groupes: PspGroupeApercu[] = groupesBruts.map((g) => {
      const membres = commandes.filter((c) => g.comn_liste.includes(c.comn));
      return construireGroupeApercu(g, membres);
    });

    // Suggestions de règles récurrentes (lecture seule de psp_feedback)
    const { data: feedbacks, error: errFb } = await db
      .from("psp_feedback")
      .select("cible_id, proposition_initiale, decision_utilisateur, correction")
      .order("created_at", { ascending: true });
    if (errFb) throw new Error(`Lecture des feedbacks PSP : ${errFb.message}`);
    const suggestions = detecterCorrectionsRecurrentes(feedbacks ?? []);

    const aValider = commandes.filter((c) => c.besoin_validation_humaine);
    const eligible = commandes.filter((c) => c.perimetre_psp === "eligible");
    const horsPsp = commandes.filter((c) => c.perimetre_psp === "hors_psp");
    const aExaminer = commandes.filter((c) => c.perimetre_psp === "a_examiner");
    const chargesDistinctes = [
      ...new Set(commandes.map((c) => c.charge_operation ?? "").filter((x) => x !== "")),
    ];
    const stats = {
      a_valider: aValider.length,
      groupes: groupes.length,
      haute_priorite: commandes.filter((c) => c.niveau_priorite === "elevee").length,
      multi_domaines: commandes.filter((c) => c.domaine_technique === "multi_domaine").length,
      exceptionnelles: commandes.filter((c) => c.nature_exceptionnelle !== "aucune").length,
      faible_confiance: commandes.filter((c) => c.confiance < 0.6).length,
      // Périmètre PSP
      eligible: eligible.length,
      hors_psp: horsPsp.length,
      a_examiner: aExaminer.length,
      pmr: commandes.filter((c) => c.est_pmr).length,
      charges: chargesDistinctes,
      // Montant total PSP = UNIQUEMENT les commandes éligibles.
      montant_psp: eligible.reduce((s, c) => s + (c.montant_engage ?? 0), 0),
      // Montant concerné (toutes les commandes à valider) — contexte.
      montant_total: aValider.reduce((s, c) => s + (c.montant_engage ?? 0), 0),
    };

    return {
      import: {
        id: imp.id,
        fichier_nom: imp.fichier_nom ?? null,
        exercice: imp.exercice ?? null,
        statut: imp.statut ?? null,
        created_at: imp.created_at ?? null,
      },
      stats,
      groupes,
      commandes,
      suggestions,
      configuration: { charges_operation_exclus: chargesExclus },
    };
  });

/**
 * Détail complet d'une commande (toutes les données source, y compris
 * donnees_brutes) + classification + score. Lecture seule.
 */
export const getPspValidationDetail = createServerFn({ method: "POST" })
  .validator((d: unknown) => detailSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("../integrations/supabase-ext/client.server");
    const db = supabaseAdmin as any;
    const { data: row, error } = await db
      .from("psp_import_rows")
      .select("*")
      .eq("numero_commande_interne", data.comn)
      .maybeSingle();
    if (error) throw new Error(`Lecture de la commande ${data.comn} : ${error.message}`);
    if (!row) throw new Error(`Commande ${data.comn} introuvable.`);

    const cls = classifierCommande({
      comn: row.numero_commande_interne,
      comc: row.numero_commande,
      naac: row.nature_analytique,
      wnature: row.corps_etat_libelle ?? "",
      patrimoine: row.patrimoine,
      montant_engage: row.montant_engage,
      descriptif: row.donnees_brutes?.descriptif,
      observations: row.donnees_brutes?.observations,
    });
    const score = calculerScorePriorite({
      montant_engage: row.montant_engage,
      confiance: cls.confiance,
      exceptionnelle: cls.nature_exceptionnelle !== "aucune",
      multi_domaine: cls.domaine_technique === "multi_domaine",
      domaine_technique: cls.domaine_technique,
      type_intervention: cls.type_intervention,
    });
    const perim = resoudrePerimetrePsp({
      naac: row.nature_analytique,
      wnature: row.corps_etat_libelle ?? "",
      charge_operation: null,
      charges_operation_exclus: [],
    });
    return { row, classification: cls, score, perimetre: perim };
  });
