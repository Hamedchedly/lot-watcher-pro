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

/** KPI du tableau Opérations (V8.2.2 — limités, aucun MOCK). */
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
