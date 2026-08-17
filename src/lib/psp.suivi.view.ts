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
  annee: string; // "" | "2027" … "2031"
  tranche: string;
  cc: string;
  categorie: string; // "" | "GE" | "GT" | "CP"
  corpsEtat: string;
  statutPsp: string;
  statutConsultation: string;
  statutExecution: string;
  fournisseur: string;
  commande: "toutes" | "avec" | "sans";
  priorite: string;
  recherche: string;
};

export const FILTRES_SUIVI_VIDES: FiltresSuivi = {
  annee: "",
  tranche: "",
  cc: "",
  categorie: "",
  corpsEtat: "",
  statutPsp: "",
  statutConsultation: "",
  statutExecution: "",
  fournisseur: "",
  commande: "toutes",
  priorite: "",
  recherche: "",
};

/** L'opération est-elle programmée (montant > 0) sur l'année donnée ? */
export const operationSurAnnee = (op: SuiviOperationVue, annee: number): boolean =>
  op.programmation.annees.some((a) => a.annee === annee && a.montant > 0);

const texte = (v: string | null | undefined): string => (v ?? "").trim().toLowerCase();

/** Applique les filtres du tableau (pur). */
export const filtrerOperationsSuivi = (
  operations: SuiviOperationVue[],
  filtres: FiltresSuivi,
): SuiviOperationVue[] => {
  const recherche = texte(filtres.recherche);
  const fournisseur = texte(filtres.fournisseur);
  return operations.filter((op) => {
    const p = op.programmation;
    const c = op.consultation;
    const cmd = op.commandes;
    const ex = op.execution;
    if (filtres.annee && !operationSurAnnee(op, Number(filtres.annee))) return false;
    if (filtres.tranche && texte(op.identite.tranche) !== texte(filtres.tranche)) return false;
    if (filtres.cc && texte(p.cc) !== texte(filtres.cc)) return false;
    if (filtres.categorie && op.identite.categorie !== filtres.categorie) return false;
    if (filtres.corpsEtat && !texte(p.corps_etat).includes(texte(filtres.corpsEtat))) return false;
    if (filtres.statutPsp && p.statut_psp !== filtres.statutPsp) return false;
    if (filtres.statutConsultation && c.statut !== filtres.statutConsultation) return false;
    if (filtres.statutExecution && ex.statut !== filtres.statutExecution) return false;
    if (filtres.priorite && texte(p.priorite) !== texte(filtres.priorite)) return false;
    if (filtres.commande === "avec" && cmd.nb_commandes === 0) return false;
    if (filtres.commande === "sans" && cmd.nb_commandes > 0) return false;
    if (fournisseur) {
      const fournisseurs = cmd.liees.map((l) => texte(l.entreprise)).filter(Boolean);
      const consultes = c.entreprises.map((e) => texte(e.entreprise)).filter(Boolean);
      if (![...fournisseurs, ...consultes].some((f) => f.includes(fournisseur))) return false;
    }
    if (recherche) {
      const consultes = c.entreprises.map((e) => e.entreprise).join(" ");
      const entrepriseLies = cmd.liees
        .map((l) => `${l.numero_commande ?? ""} ${l.entreprise ?? ""}`)
        .join(" ");
      const haystack = [
        op.identite.tranche,
        p.nature,
        p.corps_etat,
        p.cc,
        op.identite.categorie,
        consultes,
        entrepriseLies,
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
  "tranche" | "categorie" | "nature" | "montant" | "commande" | "cc" | "annee";

export const trierOperationsSuivi = (
  operations: SuiviOperationVue[],
  cle: CleTriSuivi,
  asc: boolean,
): SuiviOperationVue[] => {
  const dir = asc ? 1 : -1;
  return [...operations].sort((a, b) => {
    let va: string | number;
    let vb: string | number;
    switch (cle) {
      case "tranche":
        va = a.identite.tranche;
        vb = b.identite.tranche;
        break;
      case "categorie":
        va = a.identite.categorie;
        vb = b.identite.categorie;
        break;
      case "nature":
        va = a.programmation.nature ?? "";
        vb = b.programmation.nature ?? "";
        break;
      case "montant":
        va = a.programmation.montant_total;
        vb = b.programmation.montant_total;
        break;
      case "commande":
        va = a.commandes.liees[0]?.numero_commande ?? "";
        vb = b.commandes.liees[0]?.numero_commande ?? "";
        break;
      case "cc":
        va = a.programmation.cc ?? "";
        vb = b.programmation.cc ?? "";
        break;
      case "annee":
        va = a.programmation.annee_premiere ?? 0;
        vb = b.programmation.annee_premiere ?? 0;
        break;
    }
    if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
    return String(va).localeCompare(String(vb), "fr", { sensitivity: "base" }) * dir;
  });
};

// ── KPI ──────────────────────────────────────────────────────────────────────

export type KpiSuivi = {
  programmees: number;
  sansCommande: number;
  demandesDevis: number;
  devisRecus: number;
  devisRetenus: number;
  commandees: number;
  travauxEnCours: number;
  terminees: number;
  relances: number;
  aConfirmer: number;
  budgetProgramme: number;
  budgetCommande: number;
  budgetEngage: number;
  budgetPaye: number;
};

/** KPI dynamiques du tableau (aucun MOCK — sources réelles). */
export const kpiSuivi = (operations: SuiviOperationVue[]): KpiSuivi => {
  const somme = (vs: number[]) => vs.reduce((s, v) => s + v, 0);
  return {
    programmees: operations.length,
    sansCommande: operations.filter((o) => o.execution.statut === "sans_commande").length,
    demandesDevis: operations.filter((o) => o.consultation.nb_demandes > 0).length,
    devisRecus: operations.filter((o) => o.consultation.nb_devis_recus > 0).length,
    devisRetenus: operations.filter((o) => o.consultation.statut === "devis_retenu").length,
    commandees: operations.filter((o) => o.commandes.nb_commandes > 0).length,
    travauxEnCours: operations.filter(
      (o) =>
        o.execution.statut === "travaux_en_cours" || o.execution.statut === "travaux_a_demarrer",
    ).length,
    terminees: operations.filter((o) => o.execution.statut === "travaux_termines").length,
    relances: operations.filter((o) => o.consultation.relance_necessaire).length,
    aConfirmer: operations.filter((o) => o.commandes.statut_rapprochement_global === "a_confirmer")
      .length,
    budgetProgramme: somme(operations.map((o) => o.programmation.montant_total)),
    budgetCommande: somme(operations.map((o) => o.commandes.budget_commande)),
    budgetEngage: somme(operations.map((o) => o.commandes.engage)),
    budgetPaye: somme(operations.map((o) => o.commandes.paye)),
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
