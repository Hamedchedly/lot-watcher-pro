/**
 * V8.6.1 §4-§8 — SUIVI OPÉRATIONNEL ANNUEL (route /suivi).
 *
 * /suivi est le REGISTRE OPÉRATIONNEL ANNUEL : sélecteur d'année (défaut 2026),
 * état par défaut « Sans commande » (« ce qui doit encore être commandé »), puis
 * En cours / Terminées / À vérifier / Toutes. Alimenté par les données RÉELLES
 * (commandes de l'exercice + opérations de la préparation programmées sur
 * l'année ou hors PSP). Aucun MOCK, Dashboard inchangé.
 */
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, FileSearch, Loader2, Workflow } from "lucide-react";

import PspCommandesARapprocherPanel from "@/components/suivi/PspCommandesARapprocherPanel";
import PspCorrespondanceCommandeDialog from "@/components/suivi/PspCorrespondanceCommandeDialog";
import SuiviOperationFiche from "@/components/suivi/SuiviOperationFiche";
import TableauDemandesDevis from "@/components/suivi/TableauDemandesDevis";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { money0 } from "@/lib/formats";
import { getPspSuiviAnnuel, getPspSuiviOperations } from "@/lib/psp.prep.supabase.functions";
import {
  kpiRegistreAnnuel,
  ligneDemandeDevisDepuisOperation,
  ligneDemandeDevisDepuisRegistre,
  operationSurAnnee,
  type LigneDemandeDevis,
  type LigneRegistreAnnuel,
} from "@/lib/psp.suivi.view";
import type { SuiviOperationVue } from "@/lib/psp.suivi.foundation";

export const Route = createFileRoute("/suivi")({
  head: () => ({
    meta: [
      { title: "Opérations — Suivi annuel PSP" },
      {
        name: "description",
        content:
          "Registre opérationnel annuel : opérations de l'année, commandes, engagements, paiements et travaux.",
      },
    ],
  }),
  component: SuiviPage,
});

// V8.10 — /suivi en DEUX ONGLETS : « Suivi annuel 2026 » (opérations sans
// commande → demandes de devis, mises à jour à chaque import du fichier
// annuel) et « PSP 2027 » (opérations programmées 2027). Années figées par
// onglet — le sélecteur d'année est supprimé.
const ANNEE_SUIVI = 2026;
const ANNEE_PSP = 2027;

function SuiviPage() {
  const fetchRegistre = useServerFn(getPspSuiviAnnuel);
  const fetchOperations = useServerFn(getPspSuiviOperations);
  const queryClient = useQueryClient();

  const { data: registre, isLoading } = useQuery({
    queryKey: ["psp-suivi-annuel", ANNEE_SUIVI],
    queryFn: () => fetchRegistre({ data: { annee: ANNEE_SUIVI } }),
    staleTime: 1000 * 30,
    retry: 1,
  });
  // Opérations complètes (fiches) — chargées en parallèle, jamais modifiées ici.
  const { data: operationsData } = useQuery({
    queryKey: ["psp-suivi-operations"],
    queryFn: () => fetchOperations(),
    staleTime: 1000 * 60,
    retry: 1,
  });
  const operations = useMemo(
    () => (operationsData?.operations ?? []) as SuiviOperationVue[],
    [operationsData],
  );
  const parPspLigneId = useMemo(
    () => new Map(operations.map((o) => [o.identite.id, o])),
    [operations],
  );

  const lignes = useMemo(() => (registre?.lignes ?? []) as LigneRegistreAnnuel[], [registre]);
  const lignesSansCommandeImport = (registre?.lignesSansCommandeImport ?? 0) as number;
  const lignesSuiviMaterialisees = (registre?.lignesSuiviMaterialisees ?? 0) as number;

  const [selection, setSelection] = useState<SuiviOperationVue | null>(null);
  const [commandeSelection, setCommandeSelection] = useState<string | null>(null);
  const [aRapprocher, setARapprocher] = useState(false);

  /** V8.3/V8.6.1 — recharge le registre après création/enregistrement. */
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["psp-suivi-annuel", ANNEE_SUIVI] });
    await queryClient.invalidateQueries({ queryKey: ["psp-suivi-operations"] });
    const d = await queryClient.fetchQuery({
      queryKey: ["psp-suivi-annuel", ANNEE_SUIVI],
      queryFn: () => fetchRegistre({ data: { annee: ANNEE_SUIVI } }),
    });
    if (selection) {
      const vue = parPspLigneId.get(selection.identite.id);
      if (vue) setSelection(vue);
    }
    void d;
  };

  // V8.10 — KPI du registre 2026 (7 conventions V8.6.1 §12, conservés).
  const kpi = useMemo(() => kpiRegistreAnnuel(lignes), [lignes]);

  // V8.10 — lignes des deux onglets (même tableau partagé LigneDemandeDevis).
  //  · Onglet « Suivi annuel » : opérations 2026 SANS commande (données réelles
  //    du registre annuel V8.8.3) — but : demandes de devis.
  const lignesSuiviAnnuel = useMemo<LigneDemandeDevis[]>(
    () =>
      lignes
        .filter((l) => l.type === "operation" && l.etat_annuel === "sans_commande")
        .map(ligneDemandeDevisDepuisRegistre),
    [lignes],
  );
  //  · Onglet « PSP 2027 » : opérations programmées sur 2027 (préparation PSP).
  const lignesPsp2027 = useMemo<LigneDemandeDevis[]>(
    () =>
      operations
        .filter((o) => operationSurAnnee(o, ANNEE_PSP))
        .map((o) => ligneDemandeDevisDepuisOperation(o, ANNEE_PSP)),
    [operations],
  );

  /** Ouvre la fiche opération depuis une ligne des onglets (demandes de devis). */
  const ouvrirDemande = (l: LigneDemandeDevis) => {
    if (!l.pspLigneId) return;
    const vue =
      parPspLigneId.get(l.pspLigneId) ?? operations.find((o) => o.identite.id === l.pspLigneId);
    if (vue) setSelection(vue);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-4 sm:px-6">
          <div className="mr-auto">
            <h1 className="flex items-center gap-2 text-lg font-semibold leading-tight">
              <Workflow className="size-5 text-primary" /> Opérations
            </h1>
            <p className="text-sm text-muted-foreground">
              Registre opérationnel annuel — données réelles du fichier annuel + commandes.
            </p>
          </div>
          {/* V8.10 — sélecteur d'année supprimé : années figées par onglet
              (Suivi annuel 2026 / PSP 2027). */}
          {/* V8.6.2 — plus de création manuelle générique depuis /suivi : une
              opération annuelle vient de la PRÉPARATION PSP ou du FICHIER ANNUEL
              (matérialisée par l'import, origine='suivi'). */}
          {/* V8.5.4 — vue globale « Commandes à rapprocher » */}
          <Button size="sm" variant="outline" onClick={() => setARapprocher(true)}>
            <FileSearch className="size-3.5" /> Commandes à rapprocher
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/preparation-psp">
              <ArrowLeft className="size-3.5" /> Préparation PSP
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link
              to="/dashboard-travaux"
              search={{ commande: undefined, de: undefined, a: undefined }}
            >
              Dashboard travaux
            </Link>
          </Button>
        </div>
      </header>

      {/* V8.6.2/3 — lignes annuelles SANS commande vues dans les imports : le
          bandeau distingue les lignes DÉTECTÉES des lignes MATÉRIALISÉES en
          opérations (les marqueurs travaux_import_details restent conservés). */}
      {lignesSansCommandeImport > 0 && (
        <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-[11px] text-amber-800">
          {lignesSansCommandeImport} ligne(s) sans commande détectées dans les imports du fichier
          annuel · {lignesSuiviMaterialisees} matérialisée(s) en opérations. Les marqueurs d'import
          restent conservés (traçabilité) ; seules les lignes fiables (TR + corps d'état ou nature)
          deviennent des opérations « Sans commande » dans le registre.
        </div>
      )}

      <main className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6">
        {/* V8.10 — KPI du registre 2026 conservés (7 conventions V8.6.1 §12). */}
        {!isLoading && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            <Kpi label="Opérations" value={String(kpi.operations)} />
            <Kpi label="Budget programmé" value={money0(kpi.budgetProgramme)} />
            <Kpi label="Commandé" value={money0(kpi.budgetCommande)} />
            <Kpi label="Engagé" value={money0(kpi.budgetEngage)} />
            <Kpi label="Payé" value={money0(kpi.budgetPaye)} />
            <Kpi label="Travaux en cours" value={String(kpi.travauxEnCours)} />
            <Kpi label="Terminées" value={String(kpi.terminees)} />
          </div>
        )}

        {isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Chargement du suivi annuel…
          </p>
        ) : (
          <Tabs defaultValue="suivi-annuel">
            <TabsList>
              <TabsTrigger value="suivi-annuel">Suivi annuel {ANNEE_SUIVI}</TabsTrigger>
              <TabsTrigger value="psp-2027">PSP {ANNEE_PSP}</TabsTrigger>
            </TabsList>
            <TabsContent value="suivi-annuel" className="pt-3">
              <TableauDemandesDevis
                titre={`Suivi annuel ${ANNEE_SUIVI} — sans commande`}
                sousTitre="Opérations de l'exercice sans commande : à demander en devis. Mises à jour à chaque import du fichier annuel."
                lignes={lignesSuiviAnnuel}
                onOpen={ouvrirDemande}
              />
            </TabsContent>
            <TabsContent value="psp-2027" className="pt-3">
              <TableauDemandesDevis
                titre={`PSP ${ANNEE_PSP} — programmées`}
                sousTitre="Opérations de la préparation PSP programmées sur 2027."
                lignes={lignesPsp2027}
                onOpen={ouvrirDemande}
              />
            </TabsContent>
          </Tabs>
        )}
      </main>

      {selection && (
        <SuiviOperationFiche
          operation={selection}
          onClose={() => setSelection(null)}
          onRefresh={refresh}
        />
      )}
      {commandeSelection && (
        <PspCorrespondanceCommandeDialog
          commandeId={commandeSelection}
          open={!!commandeSelection}
          onClose={() => setCommandeSelection(null)}
          onRattache={refresh}
        />
      )}
      {aRapprocher && (
        <PspCommandesARapprocherPanel
          open={aRapprocher}
          onClose={() => setARapprocher(false)}
          onExaminer={(pspLigneId) => {
            const op = operations.find((o) => o.identite.id === pspLigneId);
            if (op) {
              setARapprocher(false);
              setSelection(op);
            }
          }}
        />
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card px-2 py-1.5">
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-bold">{value}</p>
    </div>
  );
}
