/**
 * PSP — V8.2 SUIVI OPÉRATION : vue tableau + KPI + comparatif devis (PUR).
 *
 * Consomme `SuiviOperationVue` (socle V8.1) et `statsDevis` (V7.10) sans
 * aucune écriture ni aucun MOCK. Filtres, tri et KPI sont purs et testables.
 */
import { statsDevis } from "./psp.prep.ts";
import type { SuiviOperationVue } from "./psp.suivi.foundation.ts";
import type { DevisSuivi } from "./psp.suivi.foundation.ts";

// ── Filtres du tableau ───────────────────────────────────────────────────────

export type FiltresSuivi = {
  /** Recherche globale : TR, adresse, corps d'état, nature, entreprise, n° commande, CC. */
  recherche: string;
  /** Origine : toutes | psp | hors_psp (dérivé de psp_lignes.origine). */
  origine: "toutes" | "psp" | "hors_psp";
  /** Étape : toutes | consultation | commande | travaux_en_cours | travaux_termines | a_rapprocher. */
  etat:
    | "toutes"
    | "consultation"
    | "commande"
    | "travaux_en_cours"
    | "travaux_termines"
    | "a_rapprocher";
};

export const FILTRES_SUIVI_VIDES: FiltresSuivi = {
  recherche: "",
  origine: "toutes",
  etat: "toutes",
};

/** L'opération est-elle programmée (montant > 0) sur l'année donnée ? */
export const operationSurAnnee = (op: SuiviOperationVue, annee: number): boolean =>
  op.programmation.annees.some((a) => a.annee === annee && a.montant > 0);

const texte = (v: string | null | undefined): string => (v ?? "").trim().toLowerCase();

/** Applique les filtres du tableau (V8.2.2 — recherche, origine, état). */
export const filtrerOperationsSuivi = (
  operations: SuiviOperationVue[],
  filtres: FiltresSuivi,
): SuiviOperationVue[] => {
  const recherche = texte(filtres.recherche);
  return operations.filter((op) => {
    if (filtres.origine !== "toutes" && op.identite.origine !== filtres.origine) return false;
    if (filtres.etat !== "toutes") {
      const ex = op.execution.statut;
      if (filtres.etat === "consultation" && op.consultation.nb_demandes === 0) return false;
      if (filtres.etat === "commande" && op.commandes.nb_commandes === 0) return false;
      if (
        filtres.etat === "travaux_en_cours" &&
        !(ex === "travaux_en_cours" || ex === "travaux_a_demarrer")
      )
        return false;
      if (filtres.etat === "travaux_termines" && ex !== "travaux_termines") return false;
      // V8.5.4 — « À rapprocher » : opération sans commande liée mais avec
      // devis/demandes (commande importée attendue) OU sans commande du tout.
      if (filtres.etat === "a_rapprocher" && op.commandes.nb_commandes > 0) return false;
    }
    if (recherche) {
      const consultes = op.consultation.entreprises.map((e) => e.entreprise).join(" ");
      const liees = op.commandes.liees
        .map((l) => `${l.numero_commande ?? ""} ${l.entreprise ?? ""}`)
        .join(" ");
      const haystack = [
        op.identite.tranche,
        op.programmation.nature,
        op.programmation.corps_etat,
        op.programmation.cc,
        op.programmation.sous_secteur,
        op.programmation.adresse,
        op.identite.categorie,
        consultes,
        liees,
      ]
        .filter(Boolean)
        .map((x) => texte(x))
        .join(" ");
      if (!haystack.includes(recherche)) return false;
    }
    return true;
  });
};

// ── Tri ──────────────────────────────────────────────────────────────────────

export type CleTriSuivi =
  | "tranche"
  | "sous_secteur"
  | "cc"
  | "corps_etat"
  | "categorie"
  | "nature"
  | "montant"
  | "consultation"
  | "devis"
  | "commande"
  | "travaux"
  | "annee"
  | "origine";

/**
 * V8.4.1 — moteur de tri UNIQUE (généralisé) du registre Opérations.
 * Conserve le comportement antérieur et ajoute les colonnes du tableau :
 * sous_secteur, corps_etat, consultation, devis, travaux, origine.
 * Aucun deuxième moteur de tri.
 */
export const trierOperationsSuivi = (
  operations: SuiviOperationVue[],
  cle: CleTriSuivi,
  asc: boolean,
): SuiviOperationVue[] => {
  const dir = asc ? 1 : -1;
  const valeur = (o: SuiviOperationVue): string | number => {
    switch (cle) {
      case "tranche":
        return o.identite.tranche;
      case "sous_secteur":
        return o.programmation.sous_secteur ?? "";
      case "cc":
        return o.programmation.cc ?? "";
      case "corps_etat":
        return o.programmation.corps_etat ?? "";
      case "categorie":
        return o.identite.categorie;
      case "nature":
        return o.programmation.nature ?? "";
      case "montant":
        return o.programmation.montant_total;
      case "consultation":
        // État de consultation : priorité au statut (retenu > reçu > envoyée > rien).
        return STATUT_CONSULTATION_RANG[o.consultation.statut] ?? 0;
      case "devis":
        return o.consultation.devis_retenu != null
          ? 3
          : o.consultation.nb_devis_recus > 0
            ? 2
            : o.consultation.nb_demandes > 0
              ? 1
              : 0;
      case "commande":
        return o.commandes.liees[0]?.numero_commande ?? "";
      case "travaux":
        return STATUT_EXECUTION_RANG[o.execution.statut] ?? 0;
      case "annee":
        return o.programmation.annee_premiere ?? 0;
      case "origine":
        return o.identite.origine === "hors_psp" ? "Hors PSP" : "PSP";
    }
  };
  return [...operations].sort((a, b) => {
    const va = valeur(a);
    const vb = valeur(b);
    if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
    return String(va).localeCompare(String(vb), "fr", { sensitivity: "base" }) * dir;
  });
};

/** Rang de tri de l'état de consultation (dérivé — aucun état inventé). */
const STATUT_CONSULTATION_RANG: Record<string, number> = {
  pas_consulte: 0,
  demande_a_envoyer: 1,
  en_attente: 2,
  relance_necessaire: 3,
  devis_recu: 4,
  devis_retenu: 5,
  consultation_abandonnee: 6,
};

/** Rang de tri de l'état d'exécution (dérivé — aucun état inventé). */
const STATUT_EXECUTION_RANG: Record<string, number> = {
  sans_commande: 0,
  travaux_a_demarrer: 1,
  travaux_en_cours: 2,
  pas_realisee: 3,
  travaux_termines: 4,
};

// ── V8.8 §8 — TRI CLIQUABLE DU REGISTRE ANNUEL ──────────────────────────────────
// Extension du MÊME moteur de tri (V8.4.1, trierOperationsSuivi) aux lignes du
// registre annuel (LigneRegistreAnnuel). Aucun moteur de tri parallèle : mêmes
// rangs (consultation / exécution), même règle 1 clic ↑ / 2 clics ↓ / nouvelle
// colonne → ascendant, tri appliqué APRÈS les filtres (année, recherche, métier).

export type CleTriRegistre =
  | "operation"
  | "origine"
  | "tranche"
  | "adresse"
  | "cc"
  | "corps_etat"
  | "descriptif"
  | "programmation"
  | "consultation"
  | "devis"
  | "commande"
  | "travaux";

export const COLONNES_TRI_REGISTRE: Array<{ cle: CleTriRegistre | null; label: string }> = [
  { cle: "operation", label: "Opération" },
  { cle: "origine", label: "Origine" },
  { cle: "tranche", label: "TR" },
  { cle: "adresse", label: "Adresse" },
  { cle: "cc", label: "CC" },
  { cle: "corps_etat", label: "Corps d'état" },
  { cle: "descriptif", label: "Descriptif" },
  { cle: "programmation", label: "Programmation" },
  { cle: "consultation", label: "Consultation" },
  { cle: "devis", label: "Devis" },
  { cle: "commande", label: "Commande" },
  { cle: "travaux", label: "Travaux" },
];

/** Valeur de tri d'une ligne du registre (mêmes règles que trierOperationsSuivi). */
export const valeurTriRegistre = (l: LigneRegistreAnnuel, cle: CleTriRegistre): string | number => {
  switch (cle) {
    case "operation":
      return l.type === "operation" ? `op ${l.nature ?? ""}` : `cmd ${l.tranche}`;
    case "origine":
      return l.origine === "hors_psp" ? "Hors PSP" : "PSP";
    case "tranche":
      return l.tranche;
    case "adresse":
      return l.adresse ?? "";
    case "cc":
      return l.cc ?? "";
    case "corps_etat":
      return l.corps_etat ?? "";
    case "descriptif":
      return l.nature ?? "";
    case "programmation":
      return l.programme_annee ?? l.budget ?? 0;
    case "consultation":
      return STATUT_CONSULTATION_RANG[l.consultation.statut] ?? 0;
    case "devis":
      return l.consultation.statut === "devis_retenu"
        ? 3
        : l.consultation.nb_devis_recus > 0
          ? 2
          : l.consultation.nb_demandes > 0
            ? 1
            : 0;
    case "commande":
      return l.commande?.numero_commande ?? "";
    case "travaux":
      return STATUT_EXECUTION_RANG[l.execution.etat_travaux ?? ""] ?? 0;
  }
};

/** Tri cliquable du registre — appliquer APRÈS les filtres. 1 clic ↑, 2 clics ↓. */
export const trierLignesRegistre = (
  lignes: LigneRegistreAnnuel[],
  cle: CleTriRegistre,
  asc: boolean,
): LigneRegistreAnnuel[] => {
  const dir = asc ? 1 : -1;
  return [...lignes].sort((a, b) => {
    const va = valeurTriRegistre(a, cle);
    const vb = valeurTriRegistre(b, cle);
    if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
    return String(va).localeCompare(String(vb), "fr", { sensitivity: "base" }) * dir;
  });
};

// ── KPI ──────────────────────────────────────────────────────────────────────

export type KpiSuivi = {
  operations: number;
  budgetProgramme: number;
  budgetCommande: number;
  budgetEngage: number;
  budgetPaye: number;
  travauxEnCours: number;
  terminees: number;
};

/**
 * LEGACY / TESTS HISTORIQUES — non utilisé par l'UI actuelle.
 * V8.6.3 : l'UI /suivi utilise `kpiRegistreAnnuel` ; `kpiSuivi` est conservé
 * uniquement pour les suites historiques V8.2/V8.2.2/V8.6. Ne pas supprimer.
 */
export const kpiSuivi = (operations: SuiviOperationVue[]): KpiSuivi => {
  const somme = (vs: number[]) => vs.reduce((s, v) => s + v, 0);
  return {
    operations: operations.length,
    budgetProgramme: somme(operations.map((o) => o.programmation.montant_total)),
    budgetCommande: somme(operations.map((o) => o.commandes.budget_commande)),
    budgetEngage: somme(operations.map((o) => o.commandes.engage)),
    budgetPaye: somme(operations.map((o) => o.commandes.paye)),
    travauxEnCours: operations.filter(
      (o) =>
        o.execution.statut === "travaux_en_cours" || o.execution.statut === "travaux_a_demarrer",
    ).length,
    terminees: operations.filter((o) => o.execution.statut === "travaux_termines").length,
  };
};

// ── Comparatif devis ─────────────────────────────────────────────────────────

export type ComparatifDevis = {
  nb_devises: number;
  nb_sans_montant: number;
  min: number | null;
  moyenne: number | null;
  max: number | null;
  retenu: DevisSuivi | null;
};

/**
 * Comparatif des devis reçus : réutilise `statsDevis` (V7.10 — ignore les

 * montants null). Le devis retenu est mis en évidence, jamais imposé.
 */
export const comparatifDevis = (devis: DevisSuivi[]): ComparatifDevis => {
  const stats = statsDevis(devis);
  const reçu = devis.filter((d) => d.statut === "recu" || d.statut === "a_analyser");
  const retenu = devis.find((d) => d.statut === "retenu") ?? null;
  return {
    nb_devises: reçu.length,
    nb_sans_montant: devis.filter((d) => d.montant === null || d.montant === undefined).length,
    min: stats?.min ?? null,
    moyenne: stats?.moyenne ?? null,
    max: stats?.max ?? null,
    retenu,
  };
};

// ── Chaîne d'avancement (V8.2.1 §5) ─────────────────────────────────────────

export type EtapeAvancement = {
  code: string;
  label: string;
  atteint: boolean;
};

/**
 * Chaîne d'avancement d'une opération (états RÉELS, jamais inventés) :
 * PROGRAMMATION → CONSULTATION → DEMANDES DE DEVIS → DEVIS REÇUS →
 * DEVIS RETENU → COMMANDE → TRAVAUX EN COURS → TERMINÉ.
 * Consulté depuis `SuiviOperationVue` (socle V8.1) — aucun état stocké.
 */
export const etapesAvancement = (op: SuiviOperationVue): EtapeAvancement[] => {
  const ex = op.execution.statut;
  return [
    { code: "programmation", label: "Programmation", atteint: op.programmation.montant_total > 0 },
    {
      code: "consultation",
      label: "Consultation",
      atteint: op.consultation.nb_entreprises_consultees > 0,
    },
    {
      code: "demandes_devis",
      label: "Demandes de devis",
      atteint: op.consultation.nb_demandes > 0,
    },
    { code: "devis_recus", label: "Devis reçus", atteint: op.consultation.nb_devis_recus > 0 },
    { code: "devis_retenu", label: "Devis retenu", atteint: op.consultation.devis_retenu != null },
    { code: "commande", label: "Commande", atteint: op.commandes.nb_commandes > 0 },
    {
      code: "travaux_en_cours",
      label: "Travaux en cours",
      atteint: ex === "travaux_en_cours" || ex === "travaux_a_demarrer",
    },
    { code: "termine", label: "Terminé", atteint: ex === "travaux_termines" },
  ];
};

// ── V8.6.1 — REGISTRE OPÉRATIONNEL ANNUEL (dérivé des données RÉELLES) ─────────
//
// Le registre annuel répond à « qu'est-ce qui est réellement prévu cette année,
// qu'est-ce qui a été commandé et où en sont les travaux ? ». Les états sont
// DÉRIVÉS des données financières réelles (jamais inventés) :
//   · SANS COMMANDE  — aucune commande ;
//   · EN COURS       — commande + (payé vide OU payé < engagé) ;
//   · TERMINÉE       — commande + |payé − engagé| < 0,01 (tolérance décimales) ;
//   · À VÉRIFIER     — incohérences (engagé vide avec commande, payé > engagé…).

export type EtatSuiviAnnuel = "sans_commande" | "en_cours" | "terminee" | "a_verifier";

export const ETAT_SUIVI_LABEL: Record<EtatSuiviAnnuel, string> = {
  sans_commande: "Sans commande",
  en_cours: "En cours",
  terminee: "Terminée",
  a_verifier: "À vérifier",
};

/** Dérive l'état opérationnel annuel (§6) — données RÉELLES, tolérance 0,01 €. */
export const deriverEtatSuiviAnnuel = (input: {
  numeroCommande: string | null;
  engage: number | null;
  paye: number | null;
}): EtatSuiviAnnuel => {
  const { numeroCommande } = input;
  if (!numeroCommande) return "sans_commande";
  const e = typeof input.engage === "number" && Number.isFinite(input.engage) ? input.engage : null;
  const p = typeof input.paye === "number" && Number.isFinite(input.paye) ? input.paye : null;
  // §6.4 — commande existante mais engagé vide/invalide → À vérifier.
  if (e === null || e <= 0) return "a_verifier";
  // §6.2 — payé vide → En cours.
  if (p === null) return "en_cours";
  // §6.3 — payé = engagé (tolérance 0,01) → Terminée.
  if (Math.abs(p - e) < 0.01) return "terminee";
  // §6.4 — payé > engagé → À vérifier.
  if (p > e) return "a_verifier";
  // §6.2 — payé < engagé → En cours.
  return "en_cours";
};

/** Une commande annuelle réelle (travaux_commandes, lecture seule). */
export type CommandeAnnuelle = {
  id: string;
  numero_commande: string | null;
  tranche_code: string | null;
  adresse: string | null;
  corps_etat: string | null;
  nature_analytique: string | null;
  charge_clientele: string | null;
  ligne_budget: string | null;
  descriptif: string | null;
  budget: number | null;
  fournisseur: string | null;
  etat_commande: string | null;
  engage: number | null;
  paye: number | null;
  solde: number | null;
  etat_travaux: string | null;
  date_demarrage: string | null;
  date_fin_travaux: string | null;
  annee_exercice: number | null;
};

/**
 * Ligne du registre annuel. `type: "operation"` = opération PAT S11 (psp_lignes,
 * éventuellement rattachée à une commande) ; `type: "commande"` = commande
 * annuelle non encore rattachée (données réelles du fichier annuel importé).
 */
export type LigneRegistreAnnuel = {
  type: "operation" | "commande";
  /** psp_lignes.id (operation) ou travaux_commandes.id (commande). */
  id: string;
  pspLigneId: string | null;
  origine: "psp" | "hors_psp";
  tranche: string;
  sous_secteur: string | null;
  cc: string | null;
  corps_etat: string | null;
  nature: string | null;
  adresse: string | null;
  ligne_budget: string | null;
  budget: number | null;
  programme_annee: number | null;
  commande: CommandeAnnuelle | null;
  etat_annuel: EtatSuiviAnnuel;
  consultation: {
    nb_demandes: number;
    nb_devis_recus: number;
    statut: string;
    statut_label: string;
  };
  execution: {
    etat_travaux: string | null;
    date_demarrage: string | null;
    date_fin: string | null;
  };
};

/** Construit une ligne du registre annuel (données RÉELLES, aucun MOCK). */
export const construireLigneRegistreAnnuel = (input: {
  type: "operation" | "commande";
  id: string;
  pspLigneId: string | null;
  origine: "psp" | "hors_psp";
  tranche: string;
  sousSecteur?: string | null;
  cc?: string | null;
  corpsEtat?: string | null;
  nature?: string | null;
  adresse?: string | null;
  ligneBudget?: string | null;
  budget?: number | null;
  programmeAnnee?: number | null;
  commande?: CommandeAnnuelle | null;
  consultation?: {
    nb_demandes: number;
    nb_devis_recus: number;
    statut: string;
    statut_label: string;
  };
}): LigneRegistreAnnuel => {
  const commande = input.commande ?? null;
  const etat_annuel = deriverEtatSuiviAnnuel({
    numeroCommande: commande?.numero_commande ?? null,
    engage: commande?.engage ?? null,
    paye: commande?.paye ?? null,
  });
  return {
    type: input.type,
    id: input.id,
    pspLigneId: input.pspLigneId,
    origine: input.origine,
    tranche: input.tranche,
    sous_secteur: input.sousSecteur ?? null,
    cc: input.cc ?? null,
    corps_etat: input.corpsEtat ?? null,
    nature: input.nature ?? null,
    adresse: input.adresse ?? null,
    ligne_budget: input.ligneBudget ?? null,
    budget: input.budget ?? null,
    programme_annee: input.programmeAnnee ?? null,
    commande,
    etat_annuel,
    consultation: input.consultation ?? {
      nb_demandes: 0,
      nb_devis_recus: 0,
      statut: "a_lancer",
      statut_label: "Aucune demande",
    },
    execution: {
      etat_travaux: commande?.etat_travaux ?? null,
      date_demarrage: commande?.date_demarrage ?? null,
      date_fin: commande?.date_fin_travaux ?? null,
    },
  };
};

/** Filtres du registre annuel (V8.6.1 §7 — interface simple, 4 filtres max). */
export type FiltresRegistreAnnuel = {
  annee: number;
  etat: "toutes" | EtatSuiviAnnuel;
  origine: "toutes" | "psp" | "hors_psp";
  recherche: string;
};

export const FILTRES_REGISTRE_DEFAUT = (annee: number): FiltresRegistreAnnuel => ({
  annee,
  etat: "sans_commande",
  origine: "toutes",
  recherche: "",
});

/** Applique les filtres du registre annuel (année, état, origine, recherche). */
export const filtrerRegistreAnnuel = (
  lignes: LigneRegistreAnnuel[],
  filtres: FiltresRegistreAnnuel,
): LigneRegistreAnnuel[] => {
  const r = texte(filtres.recherche);
  return lignes.filter((l) => {
    if (filtres.etat !== "toutes" && l.etat_annuel !== filtres.etat) return false;
    if (filtres.origine !== "toutes" && l.origine !== filtres.origine) return false;
    if (r) {
      const haystack = texte(
        [
          l.tranche,
          l.adresse,
          l.corps_etat,
          l.nature,
          l.cc,
          l.sous_secteur,
          l.commande?.numero_commande ?? "",
          l.commande?.fournisseur ?? "",
          l.ligne_budget ?? "",
        ].join(" "),
      );
      if (!haystack.includes(r)) return false;
    }
    return true;
  });
};

/** KPI du registre annuel (dérivés — aucun montant inventé). */
export const kpiRegistreAnnuel = (lignes: LigneRegistreAnnuel[]) => {
  const somme = (vs: Array<number | null | undefined>) =>
    vs.reduce<number>((s, v) => s + (typeof v === "number" ? v : 0), 0);
  const commandes = lignes.map((l) => l.commande).filter((c): c is CommandeAnnuelle => !!c);
  return {
    operations: lignes.length,
    // V8.6.1 — 7 KPI conventionnels (tableau lisible, §12) : les états
    // détaillés (Sans commande / En cours / Terminées / À vérifier) restent
    // disponibles via le filtre État et les badges du tableau.
    budgetProgramme: somme(lignes.map((l) => l.programme_annee ?? l.budget)),
    budgetCommande: somme(commandes.map((c) => c.budget)),
    budgetEngage: somme(commandes.map((c) => c.engage)),
    budgetPaye: somme(commandes.map((c) => c.paye)),
    travauxEnCours: lignes.filter((l) => l.etat_annuel === "en_cours").length,
    terminees: lignes.filter((l) => l.etat_annuel === "terminee").length,
    // Détails des états (badges + filtre) — jamais affichés comme KPI.
    sansCommande: lignes.filter((l) => l.etat_annuel === "sans_commande").length,
    aVerifier: lignes.filter((l) => l.etat_annuel === "a_verifier").length,
  };
};
