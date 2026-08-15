import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, FlaskConical, Plus } from "lucide-react";
import { toast } from "sonner";

import PspAncienneProgrammation from "@/components/preparation-psp/PspAncienneProgrammation";
import PspEnveloppesDialog from "@/components/preparation-psp/PspEnveloppesDialog";
import PspGroupingSelector, {
  type ModeAffichage,
} from "@/components/preparation-psp/PspGroupingSelector";
import PspHeader from "@/components/preparation-psp/PspHeader";
import PspKpi from "@/components/preparation-psp/PspKpi";
import PspOperationDetail from "@/components/preparation-psp/PspOperationDetail";
import PspOperationForm from "@/components/preparation-psp/PspOperationForm";
import type { DevisEdit } from "@/components/preparation-psp/PspDevisPanel";
import PspRevueReports from "@/components/preparation-psp/PspRevueReports";
import PspTable from "@/components/preparation-psp/PspTable";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { money0 } from "@/lib/formats";
import {
  FILTRES_VIDES,
  PSP_ANNEES,
  PSP_BUDGET_DISPONIBLE_PAR_ANNEE,
  PSP_OPERATIONS,
  ajouterOperationListe,
  construireCsvProgrammation,
  deplacerOperation,
  kpiGlobal,
  modifierOperationListe,
  supprimerOperationListe,
  type DeplacementMemo,
  type FiltresDetail,
  type PspAnnee,
  type PspCategorie,
  type PspOperation,
  type SaisieOperation,
} from "@/lib/psp.prep";
import {
  construireReferencePatrimoine,
  enrichirOperationsAvecReference,
  parseEsquisse2027Workbook,
  type ReferencePatrimoine,
} from "@/lib/psp.prep.data";
import { getPspFichiers2026, getPspReferencePatrimoine } from "@/lib/psp.prep.data.functions";
import {
  HISTORIQUE_MODIFICATIONS_MOCK,
  PSP_PROGRAMMATION_2026,
  SUIVI_2026_MOCK,
  cleModification,
  detecterModificationsLigne,
  extraireConfirmationsHistorique,
  ligneSuiviDepuisRaw,
  type CategorieSuivi,
  type LigneArbitrage,
  type LigneProgrammee,
  type LigneSuivi,
  type ModificationSuivi,
} from "@/lib/psp.prep.suivi";
import { getTravauxDashboard } from "@/lib/travaux.dashboard.functions";
import {
  createPspDevis,
  createPspLigne,
  createPspPerimetres,
  createPspProgrammation,
  deletePspDevis,
  deletePspLigne,
  getPspBrouillon,
  savePspEnveloppes,
  updatePspDevis,
  updatePspLigne,
  updatePspLigneStatutPriorite,
  type PspLignePersist,
  type PspPerimetrePersist,
} from "@/lib/psp.prep.supabase.functions";
import { type EnveloppeMap, type LotInfo, type PerimetreLigne } from "@/lib/psp.prep.v7";

export const Route = createFileRoute("/preparation-psp")({
  head: () => ({
    meta: [
      { title: "Préparation PSP — Programmation pluriannuelle des travaux" },
      {
        name: "description",
        content:
          "V6 : préparation de la programmation pluriannuelle des travaux (2027-2031) avec brouillon persisté dans Supabase (lignes, devis, reports, décisions, commandes).",
      },
    ],
  }),
  component: PreparationPspPage,
});

function PreparationPspPage() {
  const [mode, setMode] = useState<ModeAffichage>("detail");
  const [filters, setFilters] = useState<FiltresDetail>(FILTRES_VIDES);
  const [selectedOpId, setSelectedOpId] = useState<string | null>(null);
  const [ancienneOuverte, setAncienneOuverte] = useState(false);
  const [simulationOuverte, setSimulationOuverte] = useState(false);
  const [formOuvert, setFormOuvert] = useState(false);
  const [formMode, setFormMode] = useState<"ajout" | "modification">("ajout");
  const [formOperation, setFormOperation] = useState<PspOperation | null>(null);

  // ── V7.1 : filtre annuel cumulatif (répartition cliquable), enveloppes ──
  const [anneesFiltre, setAnneesFiltre] = useState<PspAnnee[]>([]);
  const [enveloppes, setEnveloppes] = useState<EnveloppeMap>({});
  const [enveloppesDialogOuvert, setEnveloppesDialogOuvert] = useState(false);
  const [perimetresParLigne, setPerimetresParLigne] = useState<Map<string, PerimetreLigne[]>>(
    new Map(),
  );
  const [lotsParId, setLotsParId] = useState<Map<string, LotInfo>>(new Map());

  // Source des opérations : mock V1 par défaut, fichier esquisse 2027 si chargé.
  const [source, setSource] = useState<{ type: "mock" | "fichier"; fichier?: string }>({
    type: "mock",
  });
  const [operations, setOperations] = useState<PspOperation[]>(() => PSP_OPERATIONS);
  const [deplacements, setDeplacements] = useState<DeplacementMemo[]>([]);
  const [reference, setReference] = useState<ReferencePatrimoine | null>(null);

  // ── Persistance Supabase V6.2 : brouillon actif (jamais créé automatiquement) ──
  const [programmation, setProgrammation] = useState<{
    id: string;
    statut: string;
    version: number;
  } | null>(null);
  const queryClient = useQueryClient();
  const fetchBrouillon = useServerFn(getPspBrouillon);
  const { data: brouillon, isFetching: brouillonChargement } = useQuery({
    queryKey: ["psp-brouillon-supabase"],
    queryFn: () => fetchBrouillon(),
    staleTime: 1000 * 30,
    retry: 1,
  });
  const figee = programmation?.statut === "figee";
  const aucuneProgrammation = !!brouillon && !brouillon.programmation && !brouillonChargement;

  // Au chargement : la source de vérité est le brouillon Supabase (lignes réelles).
  // Aucun brouillon → état vide explicite (pas de mock silencieux, V6.2).
  useEffect(() => {
    if (!brouillon) return;
    if (!brouillon.programmation) {
      setProgrammation(null);
      setOperations([]);
      return;
    }
    setProgrammation({
      id: brouillon.programmation.id,
      statut: brouillon.programmation.statut,
      version: brouillon.programmation.version,
    });
    const env: EnveloppeMap = {};
    for (const e of brouillon.enveloppes ?? []) {
      env[`${e.annee}|${e.categorie}`] = e.montant;
    }
    setEnveloppes(env);
    const devisParLigne = new Map<string, Array<Record<string, unknown>>>();
    for (const d of brouillon.devis ?? []) {
      const id = String(d["psp_ligne_id"] ?? "");
      if (!id) continue;
      devisParLigne.set(id, [...(devisParLigne.get(id) ?? []), d]);
    }
    // Périmètres par ligne (affichage de l'adresse réelle dans le tableau).
    const perimetres = new Map<string, PerimetreLigne[]>();
    for (const p of brouillon.perimetres ?? []) {
      const cle = p.psp_ligne_id;
      if (!cle) continue;
      perimetres.set(cle, [
        ...(perimetres.get(cle) ?? []),
        { niveau: p.niveau, rue: p.rue, numero: p.numero, lot_id: p.lot_id },
      ]);
    }
    setPerimetresParLigne(perimetres);
    const ops: PspOperation[] = (brouillon.lignes ?? []).map((l: PspLignePersist) => ({
      id: l.id,
      annee: 2027 as PspAnnee,
      tranche: l.tranche_code,
      charge_clientele: "",
      charge_operation: "",
      categorie: (l.categorie as PspCategorie) ?? "GT",
      corps_etat_code: l.corps_etat_code ?? "",
      corps_etat: l.corps_etat ?? "",
      adresse: "",
      ville: "",
      sous_secteur: null,
      nature_travaux: l.nature_travaux ?? "",
      budget: PSP_ANNEES.reduce((s, a) => s + (l.programme?.[String(a)] ?? 0), 0),
      programme: l.programme ?? {},
      remarques: l.remarques,
      devis: (devisParLigne.get(l.id) ?? []).map((d) => ({
        id: String(d["id"] ?? ""),
        entreprise: String(d["entreprise"] ?? ""),
        montant: Number(d["montant"] ?? 0),
        date_devis: (d["date_devis"] as string | null) ?? null,
        statut: String(d["statut"] ?? ""),
        remarque: (d["commentaire"] as string | null) ?? null,
        commentaire: (d["commentaire"] as string | null) ?? null,
        document_reference: (d["document_reference"] as string | null) ?? null,
      })),
      reportee: l.origine === "report",
      statut: l.statut,
      priorite: l.priorite,
      ancienne_annee: null,
      ancien_montant: null,
    }));
    // Enrichissement patrimoine réel (tranches/lots/commandes) — jamais copié en base.
    setOperations(reference ? enrichirOperationsAvecReference(ops, reference) : ops);
  }, [brouillon, reference]);

  // Référence réelle PAT S11 (lecture seule, ~3 requêtes, aucune écriture).
  const fetchReference = useServerFn(getPspReferencePatrimoine);
  const {
    data: refBrute,
    isLoading: refChargement,
    isError: refErreur,
  } = useQuery({
    queryKey: ["psp-reference-patrimoine"],
    queryFn: () => fetchReference(),
    staleTime: 1000 * 60 * 60,
    retry: 1,
  });

  // Enrichit une seule fois la base d'opérations avec la référence réelle
  // (CC / adresse / ville / sous-secteur alignés sur les vraies données).
  useEffect(() => {
    if (!refBrute) return;
    const ref = construireReferencePatrimoine(refBrute.tranches, refBrute.lots, refBrute.commandes);
    setReference(ref);
    // Index id → lot pour le libellé de périmètre (affichage — jamais copié).
    const lots: Map<string, LotInfo> = new Map();
    for (const l of refBrute.lots) {
      if (!l.id) continue;
      lots.set(l.id, {
        code_patrimoine: l.code_patrimoine ?? null,
        adresse: l.adresse,
        ville: l.ville,
      });
    }
    setLotsParId(lots);
    setOperations((prev) => enrichirOperationsAvecReference(prev, ref));
  }, [refBrute]);

  // ── Revue des reports : consomme les RÉSULTATS du moteur d'import annuel ──
  // (V4 : les VRAIS fichiers 2026 sont traités par le moteur existant —
  //  `parseTravauxWorkbook` pour le suivi, `parseProgrammationWorkbook` pour la
  //  programmation. Repli sur les mocks si les fichiers sont absents.)
  const fetchFichiers2026 = useServerFn(getPspFichiers2026);
  const { data: fichiers2026 } = useQuery({
    queryKey: ["psp-fichiers-2026"],
    queryFn: () => fetchFichiers2026(),
    staleTime: 1000 * 60 * 60,
    retry: 1,
  });

  /** Lignes du suivi de l'exercice N-1 (2026), ou mock si indisponibles. */
  const suivi = useMemo<LigneSuivi[]>(() => {
    if (fichiers2026?.disponible) {
      const lignes = [
        ...fichiers2026.suivi.commandes.map((c) =>
          ligneSuiviDepuisRaw(c as unknown as Record<string, unknown>),
        ),
        ...fichiers2026.suivi.erreurs.map((e) =>
          ligneSuiviDepuisRaw(e as unknown as Record<string, unknown>),
        ),
      ];
      if (lignes.length > 0) return lignes;
    }
    return SUIVI_2026_MOCK;
  }, [fichiers2026]);

  /** Programmation 2026 réelle (feuille « Prog 2026 »), ou mock. */
  const programmees2026 = useMemo<LigneProgrammee[]>(() => {
    if (fichiers2026?.disponible && fichiers2026.programmation.lignes.length > 0) {
      return fichiers2026.programmation.lignes
        .filter((l) => (l.programme["2026"] ?? 0) > 0)
        .map((l) => ({
          tranche: l.tranche,
          categorie: (l.categorie ?? "GT") as CategorieSuivi,
          nature_travaux: l.nature_travaux,
          montant: l.programme["2026"] ?? 0,
          annee: 2026,
          ligne_budget: l.ligne_budget,
        }));
    }
    return PSP_PROGRAMMATION_2026;
  }, [fichiers2026]);

  const suivi2026Disponible = fichiers2026?.disponible === true;

  /** Historique des conflits/modifications produit par le moteur d'import
   *  (lecture réelle Supabase via getTravauxDashboard ; mock en repli). */
  const fetchDashboard = useServerFn(getTravauxDashboard);
  const { data: dash } = useQuery({
    queryKey: ["psp-suivi-historique"],
    queryFn: () => fetchDashboard(),
    staleTime: 1000 * 60 * 60,
    retry: 1,
  });

  const historique = useMemo(() => {
    if (dash && dash.historique.length > 0) {
      return dash.historique
        .filter((h) => h.operation === "conflit")
        .map((h) => ({
          avant: h.avant as Record<string, unknown> | null,
          apres: h.apres as Record<string, unknown> | null,
          resolu: h.resolu,
          ligne: h.commande_id ?? "?",
        }));
    }
    return HISTORIQUE_MODIFICATIONS_MOCK as unknown as Array<{
      avant: Record<string, unknown> | null;
      apres: Record<string, unknown> | null;
      resolu: boolean;
      ligne: string;
    }>;
  }, [dash]);

  /** Alertes de modifications (ligne, ancienne/nouvelle valeur, type, date, source). */
  const modifications = useMemo<ModificationSuivi[]>(() => {
    const liste: ModificationSuivi[] = [];
    for (const h of historique) {
      const avant = h.avant ?? {};
      const apres = h.apres ?? {};
      const ligneLabel = String(avant["tranche_code"] ?? apres["tranche_code"] ?? "?");
      for (const m of detecterModificationsLigne(avant, apres, ligneLabel)) {
        liste.push({ ...m, date: null, source: "import suivi annuel" });
      }
    }
    return liste;
  }, [historique]);

  const [confirmeesLocales, setConfirmeesLocales] = useState<Set<string>>(new Set());
  /** Mémoire de confirmation = historique resolu=true + décisions locales. */
  const confirmees = useMemo(() => {
    const set = extraireConfirmationsHistorique(historique.map((h) => ({ ...h, ligne: h.ligne })));
    confirmeesLocales.forEach((cle) => set.add(cle));
    return set;
  }, [historique, confirmeesLocales]);

  /** Décisions locales de la revue des reports (brouillon courant uniquement). */
  const [decisions, setDecisions] = useState<Map<string, string>>(new Map());

  const handleReporter = async (ligne: LigneArbitrage, anneeCible: number) => {
    if (figee || !programmation?.id) {
      toast.error(figee ? "Programmation figée : report impossible." : "Brouillon non chargé.");
      return;
    }
    const saisie: SaisieOperation = {
      tranche: ligne.tranche,
      categorie: ligne.categorie,
      charge_clientele: reference?.tranches.get(ligne.tranche)?.charge_clientele ?? "",
      charge_operation: "",
      corps_etat: "",
      adresse: reference?.tranches.get(ligne.tranche)?.adresse_reference ?? "",
      ville: reference?.tranches.get(ligne.tranche)?.ville ?? "",
      nature_travaux: ligne.nature_travaux,
      annee: anneeCible as PspAnnee,
      programme: PSP_ANNEES.map((a) => (a === anneeCible ? ligne.montant_programme : 0)),
      remarques: `Report de ${ligne.annee_initiale} (programmation ${ligne.annee_initiale} non engagée)`,
    };
    const id = `report-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    setOperations((prev) => {
      const liste = ajouterOperationListe(prev, saisie, id);
      const op = liste[liste.length - 1];
      if (op) {
        op.reportee = true;
        op.ancienne_annee = ligne.annee_initiale;
        op.ancien_montant = ligne.montant_programme;
      }
      return liste;
    });
    setDecisions((prev) =>
      new Map(prev).set(`${ligne.tranche}|${ligne.categorie}`, `Report ${anneeCible}`),
    );
    // Persistance : la ligne cible est créée dans le brouillon (origine='report').
    const programme: Record<string, number> = {};
    PSP_ANNEES.forEach((a) => {
      programme[String(a)] = a === anneeCible ? ligne.montant_programme : 0;
    });
    try {
      const creee = await createLigneFn({
        data: {
          programmationId: programmation.id,
          trancheCode: ligne.tranche,
          categorie: ligne.categorie,
          corpsEtatCode: null,
          corpsEtat: null,
          natureTravaux: ligne.nature_travaux || null,
          programme,
          ligneBudget: null,
          remarques: saisie.remarques ?? null,
          origine: "report",
        },
      });
      setOperations((prev) => prev.map((o) => (o.id === id ? { ...o, id: creee.id } : o)));
      toast.success(`Opération reportée en ${anneeCible} (brouillon Supabase).`);
    } catch (e) {
      setOperations((prev) => supprimerOperationListe(prev, id));
      toast.error(`Report non persisté : ${(e as Error).message}`);
    }
  };

  const handleAnnuler = (ligne: LigneArbitrage) => {
    setDecisions((prev) => new Map(prev).set(`${ligne.tranche}|${ligne.categorie}`, "Annulée"));
    toast.info("Opération annulée dans le brouillon (aucune écriture).");
  };

  const handleConserver = (ligne: LigneArbitrage) => {
    setDecisions((prev) => new Map(prev).set(`${ligne.tranche}|${ligne.categorie}`, "Conservée"));
    toast.info("Opération conservée (décision locale).");
  };

  const handleReevaluer = (ligne: LigneArbitrage) => {
    setDecisions((prev) => new Map(prev).set(`${ligne.tranche}|${ligne.categorie}`, "À réévaluer"));
    toast.info("Opération à réévaluer (décision locale).");
  };

  const handleConfirmerModification = (modification: ModificationSuivi) => {
    setConfirmeesLocales((prev) => new Set(prev).add(cleModification(modification)));
    toast.success("Modification confirmée localement — ne sera pas redemandée.");
  };

  const kpi = useMemo(() => kpiGlobal(operations), [operations]);
  const selectedOp = useMemo(
    () => operations.find((o) => o.id === selectedOpId) ?? null,
    [operations, selectedOpId],
  );

  // ── V7 : filtre annuel CUMULATIF (visuel uniquement — ne modifie jamais la
  // programmation ni la base). Opération visible si une année sélectionnée est programmée.
  const operationsFiltrees = useMemo(() => {
    if (anneesFiltre.length === 0) return operations;
    const set = new Set(anneesFiltre.map(String));
    return operations.filter((o) =>
      PSP_ANNEES.some((a) => set.has(String(a)) && (o.programme?.[String(a)] ?? 0) > 0),
    );
  }, [operations, anneesFiltre]);

  const toggleAnnee = (a: PspAnnee) => {
    setAnneesFiltre((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  };

  const saveEnveloppesFn = useServerFn(savePspEnveloppes);
  const handleSaveEnveloppes = async (map: EnveloppeMap) => {
    if (!programmation?.id) {
      toast.error("Brouillon non chargé.");
      return;
    }
    const rows = Object.entries(map).map(([cle, montant]) => {
      const [annee, categorie] = cle.split("|");
      return { annee: Number(annee), categorie: categorie as "GE" | "GT" | "CP", montant };
    });
    try {
      await saveEnveloppesFn({
        data: { programmationId: programmation.id, enveloppes: rows },
      });
      setEnveloppes(map);
      toast.success("Enveloppes enregistrées dans Supabase.");
    } catch (e) {
      toast.error(`Enregistrement impossible : ${(e as Error).message}`);
    }
  };

  const sourceLabel =
    source.type === "fichier" && source.fichier
      ? source.fichier
      : brouillonChargement
        ? "brouillon Supabase (chargement…)"
        : aucuneProgrammation
          ? "aucune programmation PSP"
          : figee
            ? `brouillon Supabase v${programmation?.version ?? "?"} — GELÉ (figée)`
            : `brouillon Supabase v${programmation?.version ?? "?"}`;
  const referenceResume = refBrute
    ? `référence réelle : ${refBrute.tranches.length} tranches · ${refBrute.lots.length} lots · ${refBrute.commandes.length} commandes`
    : refChargement
      ? "référence réelle : chargement…"
      : refErreur
        ? "référence réelle indisponible — valeurs mock conservées"
        : null;

  const exporter = () => {
    const csv = construireCsvProgrammation(operations);
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "programmation-psp-2027-2031.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export CSV généré (données locales).");
  };

  const analyser = () =>
    toast.info("Analyse — simulation V2. Le moteur d'analyse sera connecté à Supabase plus tard.");

  const ouvrirModification = (op: PspOperation) => {
    if (figee) {
      toast.error("Programmation figée : modification impossible.");
      return;
    }
    setFormMode("modification");
    setFormOperation(op);
    setFormOuvert(true);
  };

  const createLigneFn = useServerFn(createPspLigne);
  const updateLigneFn = useServerFn(updatePspLigne);
  const deleteLigneFn = useServerFn(deletePspLigne);
  const createProgFn = useServerFn(createPspProgrammation);
  const createPerimetresFn = useServerFn(createPspPerimetres);
  const statutPrioriteFn = useServerFn(updatePspLigneStatutPriorite);
  const createDevisFn = useServerFn(createPspDevis);
  const updateDevisFn = useServerFn(updatePspDevis);
  const deleteDevisFn = useServerFn(deletePspDevis);

  /** Crée la préparation 2027-2031 (officielle, brouillon, v1) puis recharge. */
  const handleCreerPreparation = async () => {
    try {
      await createProgFn();
      await queryClient.invalidateQueries({ queryKey: ["psp-brouillon-supabase"] });
      toast.success("Préparation PSP 2027-2031 créée (brouillon v1).");
    } catch (e) {
      toast.error(`Création impossible : ${(e as Error).message}`);
    }
  };

  /** Statut / priorité : persistés dans psp_lignes (badges + sélecteurs). */
  const handleStatutPriorite = async (
    id: string,
    patch: { statut?: string; priorite?: string },
  ) => {
    if (figee) {
      toast.error("Programmation figée : modification impossible.");
      return;
    }
    setOperations((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
    try {
      await statutPrioriteFn({ data: { id, ...patch } });
    } catch (e) {
      toast.error(`Statut / priorité non persisté : ${(e as Error).message}`);
    }
  };

  const majDevisOperation = (id: string, devis: PspOperation["devis"]) => {
    setOperations((prev) => prev.map((o) => (o.id === id ? { ...o, devis } : o)));
  };

  const handleDevisAdd = async (ligneId: string, d: DevisEdit) => {
    if (figee || !programmation?.id) return;
    const devis = await createDevisFn({
      data: {
        pspLigneId: ligneId,
        entreprise: d.entreprise ?? "",
        dateDevis: d.dateDevis ?? null,
        montant: d.montant ?? 0,
        statut: (d.statut ?? "recu") as "recu",
        commentaire: d.commentaire ?? null,
        documentReference: null,
      },
    });
    const ligne = operations.find((o) => o.id === ligneId);
    const list = ligne?.devis ?? [];
    majDevisOperation(ligneId, [
      ...list,
      {
        id: String(devis["id"] ?? ""),
        entreprise: String(devis["entreprise"] ?? ""),
        montant: Number(devis["montant"] ?? 0),
        date_devis: (devis["date_devis"] as string | null) ?? null,
        statut: String(devis["statut"] ?? ""),
        remarque: (devis["commentaire"] as string | null) ?? null,
        commentaire: (devis["commentaire"] as string | null) ?? null,
        document_reference: (devis["document_reference"] as string | null) ?? null,
      },
    ]);
    toast.success("Devis ajouté et persisté (psp_devis).");
  };

  const handleDevisUpdate = async (id: string, d: DevisEdit) => {
    if (figee) return;
    await updateDevisFn({
      data: {
        id,
        entreprise: d.entreprise,
        dateDevis: d.dateDevis,
        montant: d.montant,
        statut: (d.statut ?? undefined) as
          | "a_demander"
          | "demande_envoyee"
          | "recu"
          | "a_analyser"
          | "retenu"
          | "non_retenu"
          | "expire"
          | "annule"
          | undefined,
        commentaire: d.commentaire,
        documentReference: d.documentReference ?? null,
      },
    });
    setOperations((prev) =>
      prev.map((o) => ({
        ...o,
        devis: o.devis.map((dv) =>
          dv.id === id
            ? {
                ...dv,
                entreprise: d.entreprise ?? dv.entreprise,
                montant: d.montant ?? dv.montant,
                date_devis: d.dateDevis ?? dv.date_devis ?? null,
                statut: d.statut ?? dv.statut ?? "",
                commentaire: d.commentaire ?? dv.commentaire ?? null,
                remarque: d.commentaire ?? dv.remarque ?? null,
                document_reference: d.documentReference ?? dv.document_reference ?? null,
              }
            : dv,
        ),
      })),
    );
    toast.success("Devis modifié et persisté.");
  };

  const handleDevisDelete = async (id: string) => {
    if (figee) return;
    await deleteDevisFn({ data: { id } });
    setOperations((prev) =>
      prev.map((o) => ({ ...o, devis: o.devis.filter((dv) => dv.id !== id) })),
    );
    toast.success("Devis supprimé (psp_devis).");
  };

  /** Après une saisie directe : recharger le brouillon (lignes + périmètres). */
  const handleQuickSaved = () => {
    void queryClient.invalidateQueries({ queryKey: ["psp-brouillon-supabase"] });
  };

  const handleAjouter = async (saisie: SaisieOperation) => {
    if (figee || !programmation?.id) {
      toast.error(figee ? "Programmation figée : ajout impossible." : "Brouillon non chargé.");
      return;
    }
    const id = `loc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const sousSecteur = reference?.tranches.get(saisie.tranche)?.sous_secteur ?? null;
    setOperations((prev) => {
      const liste = ajouterOperationListe(prev, saisie, id);
      const nouvelle = liste[liste.length - 1];
      if (nouvelle) nouvelle.sous_secteur = sousSecteur;
      return liste;
    });
    const programme: Record<string, number> = {};
    PSP_ANNEES.forEach((a, i) => {
      programme[String(a)] = Number(saisie.programme[i]) || 0;
    });
    try {
      const ligne = await createLigneFn({
        data: {
          programmationId: programmation.id,
          trancheCode: saisie.tranche,
          categorie: saisie.categorie,
          corpsEtatCode: (saisie.corps_etat.match(/\(([^)]+)\)/)?.[1] ?? null) as string | null,
          corpsEtat: saisie.corps_etat || null,
          natureTravaux: saisie.nature_travaux || null,
          programme,
          ligneBudget: null,
          remarques: saisie.remarques ?? null,
          statut:
            (saisie.statut as
              "a_definir" | "attente_agence" | "attente_confirmation" | undefined) ?? undefined,
          priorite:
            (saisie.priorite as "prioritaire" | "normale" | "non_prioritaire" | undefined) ??
            undefined,
          origine: "preparation",
        },
      });
      if (saisie.perimetres && saisie.perimetres.length > 0) {
        await createPerimetresFn({
          data: {
            pspLigneId: ligne.id,
            trancheCode: saisie.tranche,
            perimetres: saisie.perimetres,
          },
        });
      }
      setOperations((prev) => prev.map((o) => (o.id === id ? { ...o, id: ligne.id } : o)));
      toast.success(`Opération persistée dans Supabase (brouillon v${programmation.version}).`);
    } catch (e) {
      setOperations((prev) => supprimerOperationListe(prev, id));
      toast.error(`Échec de la persistance : ${(e as Error).message}`);
    }
  };

  const handleModifier = async (saisie: SaisieOperation) => {
    if (!formOperation) return;
    if (figee) {
      toast.error("Programmation figée : modification impossible.");
      return;
    }
    const programme: Record<string, number> = {};
    PSP_ANNEES.forEach((a, i) => {
      programme[String(a)] = Number(saisie.programme[i]) || 0;
    });
    const patch: {
      tranche: string;
      categorie: string;
      charge_clientele: string;
      charge_operation: string;
      corps_etat: string;
      adresse: string;
      ville: string;
      sous_secteur: string | null;
      nature_travaux: string;
      annee: number;
      programme: Record<string, number>;
      remarques: string | null;
      statut?: string;
      priorite?: string;
    } = {
      tranche: saisie.tranche,
      categorie: saisie.categorie,
      charge_clientele: saisie.charge_clientele,
      charge_operation: saisie.charge_operation,
      corps_etat: saisie.corps_etat,
      adresse: saisie.adresse,
      ville: saisie.ville,
      sous_secteur: reference?.tranches.get(saisie.tranche)?.sous_secteur ?? null,
      nature_travaux: saisie.nature_travaux,
      annee: saisie.annee,
      programme,
      remarques: saisie.remarques,
    };
    if (saisie.statut !== undefined) patch.statut = saisie.statut;
    if (saisie.priorite !== undefined) patch.priorite = saisie.priorite;
    setOperations((prev) =>
      modifierOperationListe(
        prev,
        formOperation.id,
        patch as Parameters<typeof modifierOperationListe>[2],
      ),
    );
    try {
      await updateLigneFn({
        data: {
          id: formOperation.id,
          trancheCode: saisie.tranche,
          categorie: saisie.categorie,
          corpsEtatCode: (saisie.corps_etat.match(/\(([^)]+)\)/)?.[1] ?? null) as string | null,
          corpsEtat: saisie.corps_etat || null,
          natureTravaux: saisie.nature_travaux || null,
          programme,
          ligneBudget: null,
          remarques: saisie.remarques ?? null,
          statut:
            (saisie.statut as
              "a_definir" | "attente_agence" | "attente_confirmation" | undefined) ?? undefined,
          priorite:
            (saisie.priorite as "prioritaire" | "normale" | "non_prioritaire" | undefined) ??
            undefined,
        },
      });
      // Périmètre patrimonial : remplacé si l'utilisateur l'a modifié dans l'éditeur.
      if (saisie.perimetres && saisie.perimetres.length > 0) {
        await createPerimetresFn({
          data: {
            pspLigneId: formOperation.id,
            trancheCode: saisie.tranche,
            perimetres: saisie.perimetres,
          },
        });
        setPerimetresParLigne((prev) => {
          const next = new Map(prev);
          next.set(formOperation.id, saisie.perimetres ?? []);
          return next;
        });
      }
      toast.success("Opération modifiée — totaux recalculés et persistés.");
    } catch (e) {
      toast.error(`Échec de la persistance : ${(e as Error).message}`);
    }
  };

  /** Notes/remarques éditables en ligne (psp_lignes.remarques). */
  const handleNotes = async (id: string, remarques: string) => {
    if (figee) {
      toast.error("Programmation figée : modification impossible.");
      return;
    }
    const op = operations.find((o) => o.id === id);
    if (!op) return;
    setOperations((prev) =>
      prev.map((o) => (o.id === id ? { ...o, remarques: remarques || null } : o)),
    );
    try {
      await updateLigneFn({
        data: {
          id,
          trancheCode: op.tranche,
          categorie: op.categorie,
          corpsEtatCode: op.corps_etat_code || null,
          corpsEtat: op.corps_etat || null,
          natureTravaux: op.nature_travaux || null,
          programme: op.programme,
          ligneBudget: null,
          remarques: remarques || null,
          statut: op.statut,
          priorite: op.priorite,
        },
      });
    } catch (e) {
      toast.error(`Notes non persistées : ${(e as Error).message}`);
    }
  };

  const handleDeplacer = (id: string, cible: PspAnnee, motif: string | null) => {
    if (figee) {
      toast.error("Programmation figée : déplacement impossible.");
      return;
    }
    const { ops, deplacement } = deplacerOperation(operations, id, cible, motif);
    setOperations(ops);
    if (deplacement) setDeplacements((prev) => [...prev, deplacement]);
    if (deplacement) {
      toast.success(
        `Déplacée ${deplacement.anneePrecedente} → ${deplacement.anneeNouvelle} (${money0(deplacement.montant)}).`,
      );
    } else {
      toast.info("Déplacement impossible : opération introuvable ou déjà sur cette année.");
    }
  };

  const handleSupprimer = async (id: string) => {
    if (figee) {
      toast.error("Programmation figée : suppression impossible.");
      return;
    }
    if (!window.confirm("Supprimer cette opération du brouillon ?")) return;
    setOperations((prev) => supprimerOperationListe(prev, id));
    try {
      await deleteLigneFn({ data: { id } });
      toast.success("Opération supprimée (persistance Supabase).");
    } catch (e) {
      toast.error(`Échec de la suppression : ${(e as Error).message}`);
    }
  };

  const handleChargerEsquisse = (fichier: File) => {
    fichier
      .arrayBuffer()
      .then((buf) => {
        const resultat = parseEsquisse2027Workbook(buf, fichier.name);
        if (resultat.operations.length === 0) {
          toast.error(
            `Aucune opération lue dans « ${fichier.name} ».${
              resultat.erreurs[0] ? ` ${resultat.erreurs[0]}` : ""
            }`,
          );
          return;
        }
        setOperations(enrichirOperationsAvecReference(resultat.operations, reference));
        setSource({ type: "fichier", fichier: fichier.name });
        if (resultat.erreurs.length > 0) {
          toast.warning(
            `${resultat.erreurs.length} ligne(s) signalée(s) — ex. ${resultat.erreurs[0]}`,
          );
        }
        toast.success(`Esquisse chargée : ${resultat.operations.length} opérations (locale).`);
      })
      .catch((e) => toast.error(`Lecture du fichier impossible : ${String(e)}`));
  };

  return (
    <div className="min-h-screen bg-background pb-12 text-foreground">
      <PspHeader
        onAncienneProgrammation={() => setAncienneOuverte(true)}
        onAnalyser={analyser}
        onSimulation={() => setSimulationOuverte(true)}
        onExporter={exporter}
        onChargerEsquisse={handleChargerEsquisse}
        sourceLabel={sourceLabel}
        referenceResume={referenceResume}
      />

      <main className="mx-auto max-w-[2200px] space-y-4 px-4 pt-4 sm:px-6">
        <PspKpi
          operations={operations}
          anneesFiltre={anneesFiltre}
          onToggleAnnee={toggleAnnee}
          enveloppes={enveloppes}
          onOuvrirEnveloppes={() => setEnveloppesDialogOuvert(true)}
          figee={figee}
        />

        {aucuneProgrammation ? (
          <div className="rounded-xl border border-dashed p-10 text-center">
            <p className="text-lg font-black">Aucune programmation PSP enregistrée.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Créez la préparation pluriannuelle 2027-2031 (officielle, brouillon v1) pour commencer
              la saisie des opérations.
            </p>
            <Button className="mt-4" onClick={() => void handleCreerPreparation()}>
              <Plus className="size-4" />
              Créer la préparation 2027-2031
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <PspGroupingSelector mode={mode} onChange={setMode} />
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Source : {sourceLabel} · {operations.length} opérations · BUDGET_SOURCE = MOCK
              </p>
            </div>

            {mode === "reports" ? (
              <PspRevueReports
                programmees={programmees2026}
                suivi={suivi}
                exercice={2027}
                sourceFichiers={suivi2026Disponible}
                modifications={modifications}
                confirmees={confirmees}
                decisions={decisions}
                onReporter={handleReporter}
                onAnnuler={handleAnnuler}
                onConserver={handleConserver}
                onReevaluer={handleReevaluer}
                onConfirmerModification={handleConfirmerModification}
              />
            ) : (
              <PspTable
                mode={mode}
                operations={operationsFiltrees}
                filters={filters}
                onFiltersChange={setFilters}
                onOpenOperation={(op) => setSelectedOpId(op.id)}
                onModifier={ouvrirModification}
                onSupprimer={handleSupprimer}
                onStatutPriorite={handleStatutPriorite}
                onNotes={handleNotes}
                perimetresParLigne={perimetresParLigne}
                lotsParId={lotsParId}
                quickAdd={
                  programmation?.id
                    ? {
                        programmationId: programmation.id,
                        reference,
                        onSaved: handleQuickSaved,
                      }
                    : null
                }
                figee={figee}
              />
            )}
          </>
        )}
      </main>

      <PspOperationDetail
        operation={selectedOp}
        deplacements={deplacements}
        figee={figee}
        onClose={() => setSelectedOpId(null)}
        onModifier={ouvrirModification}
        onDeplacer={handleDeplacer}
        onSupprimer={handleSupprimer}
        onDevisAdd={handleDevisAdd}
        onDevisUpdate={handleDevisUpdate}
        onDevisDelete={handleDevisDelete}
      />

      <PspEnveloppesDialog
        open={enveloppesDialogOuvert}
        onClose={() => setEnveloppesDialogOuvert(false)}
        enveloppes={enveloppes}
        onSave={handleSaveEnveloppes}
      />

      <PspOperationForm
        open={formOuvert}
        mode={formMode}
        operation={formOperation}
        reference={reference}
        perimetresLigne={perimetresParLigne.get(formOperation?.id ?? "") ?? []}
        onSave={formMode === "ajout" ? handleAjouter : handleModifier}
        onClose={() => setFormOuvert(false)}
      />

      <PspAncienneProgrammation
        open={ancienneOuverte}
        operations={operations}
        onClose={() => setAncienneOuverte(false)}
      />

      <SimulationDialog
        open={simulationOuverte}
        onClose={() => setSimulationOuverte(false)}
        kpi={kpi}
      />
    </div>
  );
}

function SimulationDialog({
  open,
  onClose,
  kpi,
}: {
  open: boolean;
  onClose: () => void;
  kpi: { disponible: number; programme: number; ecart: number; parAnnee: Record<string, number> };
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[min(92vw,560px)] sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="size-4 text-muted-foreground" />
            Simulation de programmation
          </DialogTitle>
          <DialogDescription>
            Répartition théorique du programme 2027-2031 sur les enveloppes disponibles
            (BUDGET_SOURCE = MOCK tant que la dotation officielle n'est pas définie).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          {PSP_ANNEES.map((annee) => {
            const programme = kpi.parAnnee[String(annee)] ?? 0;
            const disponible = PSP_BUDGET_DISPONIBLE_PAR_ANNEE[String(annee)] ?? 0;
            const taux = disponible > 0 ? (programme / disponible) * 100 : 0;
            return (
              <div key={annee} className="rounded-lg border bg-surface/60 p-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono font-black">{annee}</span>
                  <span className="tabnum font-semibold">
                    {money0(programme)} / {money0(disponible)}
                  </span>
                  <span className="tabnum font-black text-primary">{taux.toFixed(0)} %</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-primary/70"
                    style={{ width: `${Math.min(100, taux)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-info/30 bg-info/5 p-2.5 text-xs text-info-foreground">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Simulation purement indicative en V2. Le moteur d'analyse et le rééquilibrage entre
            exercices seront connectés à Supabase dans une phase ultérieure.
          </span>
        </div>

        <div className="flex items-center justify-between border-t pt-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Programme total : {money0(kpi.programme)}
          </p>
          <Button variant="outline" size="sm" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
