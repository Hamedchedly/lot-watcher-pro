import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, FlaskConical } from "lucide-react";
import { toast } from "sonner";

import PspAncienneProgrammation from "@/components/preparation-psp/PspAncienneProgrammation";
import PspGroupingSelector, {
  type ModeAffichage,
} from "@/components/preparation-psp/PspGroupingSelector";
import PspHeader from "@/components/preparation-psp/PspHeader";
import PspKpi from "@/components/preparation-psp/PspKpi";
import PspOperationDetail from "@/components/preparation-psp/PspOperationDetail";
import PspOperationForm from "@/components/preparation-psp/PspOperationForm";
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
  type PspOperation,
  type SaisieOperation,
} from "@/lib/psp.prep";
import {
  construireReferencePatrimoine,
  enrichirOperationsAvecReference,
  parseEsquisse2027Workbook,
  type ReferencePatrimoine,
} from "@/lib/psp.prep.data";
import { getPspReferencePatrimoine } from "@/lib/psp.prep.data.functions";

export const Route = createFileRoute("/preparation-psp")({
  head: () => ({
    meta: [
      { title: "Préparation PSP — Programmation pluriannuelle des travaux" },
      {
        name: "description",
        content:
          "V2 : préparation de la programmation pluriannuelle des travaux (2027-2031) connectée en lecture seule aux données PAT S11. Aucune écriture en base.",
      },
    ],
  }),
  component: PreparationPspPage,
});

function PreparationPspPage() {
  const [exercice, setExercice] = useState(2027);
  const [mode, setMode] = useState<ModeAffichage>("tranche");
  const [filters, setFilters] = useState<FiltresDetail>(FILTRES_VIDES);
  const [selectedOpId, setSelectedOpId] = useState<string | null>(null);
  const [ancienneOuverte, setAncienneOuverte] = useState(false);
  const [simulationOuverte, setSimulationOuverte] = useState(false);
  const [formOuvert, setFormOuvert] = useState(false);
  const [formMode, setFormMode] = useState<"ajout" | "modification">("ajout");
  const [formOperation, setFormOperation] = useState<PspOperation | null>(null);

  // Source des opérations : mock V1 par défaut, fichier esquisse 2027 si chargé.
  const [source, setSource] = useState<{ type: "mock" | "fichier"; fichier?: string }>({
    type: "mock",
  });
  const [operations, setOperations] = useState<PspOperation[]>(() => PSP_OPERATIONS);
  const [deplacements, setDeplacements] = useState<DeplacementMemo[]>([]);

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
  const [reference, setReference] = useState<ReferencePatrimoine | null>(null);

  // Enrichit une seule fois la base d'opérations avec la référence réelle
  // (CC / adresse / ville / sous-secteur alignés sur les vraies données).
  useEffect(() => {
    if (!refBrute) return;
    const ref = construireReferencePatrimoine(refBrute.tranches, refBrute.lots, refBrute.commandes);
    setReference(ref);
    setOperations((prev) => enrichirOperationsAvecReference(prev, ref));
  }, [refBrute]);

  const kpi = useMemo(() => kpiGlobal(operations), [operations]);
  const selectedOp = useMemo(
    () => operations.find((o) => o.id === selectedOpId) ?? null,
    [operations, selectedOpId],
  );

  const sourceLabel =
    source.type === "fichier" && source.fichier ? source.fichier : "esquisse 2027 (mock V1)";
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

  const ouvrirAjout = () => {
    setFormMode("ajout");
    setFormOperation(null);
    setFormOuvert(true);
  };

  const ouvrirModification = (op: PspOperation) => {
    setFormMode("modification");
    setFormOperation(op);
    setFormOuvert(true);
  };

  const handleAjouter = (saisie: SaisieOperation) => {
    const id = `loc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const sousSecteur = reference?.tranches.get(saisie.tranche)?.sous_secteur ?? null;
    setOperations((prev) => {
      const liste = ajouterOperationListe(prev, saisie, id);
      const nouvelle = liste[liste.length - 1];
      if (nouvelle) nouvelle.sous_secteur = sousSecteur;
      return liste;
    });
    toast.success("Opération ajoutée localement (aucune écriture en base).");
  };

  const handleModifier = (saisie: SaisieOperation) => {
    if (!formOperation) return;
    const programme: Record<string, number> = {};
    PSP_ANNEES.forEach((a, i) => {
      programme[String(a)] = Number(saisie.programme[i]) || 0;
    });
    setOperations((prev) =>
      modifierOperationListe(prev, formOperation.id, {
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
      }),
    );
    toast.success("Opération modifiée — totaux recalculés.");
  };

  const handleDeplacer = (id: string, cible: PspAnnee, motif: string | null) => {
    const { ops, deplacement } = deplacerOperation(operations, id, cible, motif);
    setOperations(ops);
    if (deplacement) setDeplacements((prev) => [...prev, deplacement]);
    if (deplacement) {
      toast.success(
        `Déplacée ${deplacement.anneePrecedente} → ${deplacement.anneeNouvelle} (${money0(deplacement.montant)}), en mémoire.`,
      );
    } else {
      toast.info("Déplacement impossible : opération introuvable ou déjà sur cette année.");
    }
  };

  const handleSupprimer = (id: string) => {
    setOperations((prev) => supprimerOperationListe(prev, id));
    toast.info("Opération supprimée localement.");
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
        exercice={exercice}
        onExerciceChange={setExercice}
        onAncienneProgrammation={() => setAncienneOuverte(true)}
        onAnalyser={analyser}
        onSimulation={() => setSimulationOuverte(true)}
        onAjouterOperation={ouvrirAjout}
        onExporter={exporter}
        onChargerEsquisse={handleChargerEsquisse}
        sourceLabel={sourceLabel}
        referenceResume={referenceResume}
      />

      <main className="mx-auto max-w-[2200px] space-y-4 px-4 pt-4 sm:px-6">
        <PspKpi operations={operations} exercice={exercice} />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <PspGroupingSelector mode={mode} onChange={setMode} />
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Source : {sourceLabel} · {operations.length} opérations · BUDGET_SOURCE = MOCK
          </p>
        </div>

        <PspTable
          mode={mode}
          operations={operations}
          filters={filters}
          onFiltersChange={setFilters}
          onOpenOperation={(op) => setSelectedOpId(op.id)}
        />
      </main>

      <PspOperationDetail
        operation={selectedOp}
        deplacements={deplacements}
        onClose={() => setSelectedOpId(null)}
        onModifier={ouvrirModification}
        onDeplacer={handleDeplacer}
        onSupprimer={handleSupprimer}
      />

      <PspOperationForm
        open={formOuvert}
        mode={formMode}
        operation={formOperation}
        reference={reference}
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
