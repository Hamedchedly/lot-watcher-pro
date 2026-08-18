/**
 * V8.6.1 §4-§8 — SUIVI OPÉRATIONNEL ANNUEL (route /suivi).
 *
 * /suivi est le REGISTRE OPÉRATIONNEL ANNUEL : sélecteur d'année (défaut 2026),
 * état par défaut « Sans commande » (« ce qui doit encore être commandé »), puis
 * En cours / Terminées / À vérifier / Toutes. Alimenté par les données RÉELLES
 * (commandes de l'exercice + opérations de la préparation programmées sur
 * l'année ou hors PSP). Aucun MOCK, Dashboard inchangé.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, FileSearch, Loader2, Workflow } from "lucide-react";

import PspCommandesARapprocherPanel from "@/components/suivi/PspCommandesARapprocherPanel";
import PspCorrespondanceCommandeDialog from "@/components/suivi/PspCorrespondanceCommandeDialog";
import SuiviOperationFiche from "@/components/suivi/SuiviOperationFiche";
import SuiviTable from "@/components/suivi/SuiviTable";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getPspSuiviAnnuel, getPspSuiviOperations } from "@/lib/psp.prep.supabase.functions";
import type { LigneRegistreAnnuel } from "@/lib/psp.suivi.view";
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

function SuiviPage() {
  const fetchRegistre = useServerFn(getPspSuiviAnnuel);
  const fetchOperations = useServerFn(getPspSuiviOperations);
  const queryClient = useQueryClient();

  // V8.6.1 §4/§8 — année sélectionnée (défaut 2026).
  const [annee, setAnnee] = useState<number>(2026);

  const { data: registre, isLoading } = useQuery({
    queryKey: ["psp-suivi-annuel", annee],
    queryFn: () => fetchRegistre({ data: { annee } }),
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
  const operations = (operationsData?.operations ?? []) as SuiviOperationVue[];
  const parPspLigneId = new Map(operations.map((o) => [o.identite.id, o]));

  const lignes = (registre?.lignes ?? []) as LigneRegistreAnnuel[];
  const anneesDisponibles = (registre?.anneesDisponibles ?? [2026]) as number[];
  const lignesSansCommandeImport = (registre?.lignesSansCommandeImport ?? 0) as number;

  const [selection, setSelection] = useState<SuiviOperationVue | null>(null);
  const [commandeSelection, setCommandeSelection] = useState<string | null>(null);
  const [aRapprocher, setARapprocher] = useState(false);

  /** V8.3/V8.6.1 — recharge le registre après création/enregistrement. */
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["psp-suivi-annuel", annee] });
    await queryClient.invalidateQueries({ queryKey: ["psp-suivi-operations"] });
    const d = await queryClient.fetchQuery({
      queryKey: ["psp-suivi-annuel", annee],
      queryFn: () => fetchRegistre({ data: { annee } }),
    });
    if (selection) {
      const vue = parPspLigneId.get(selection.identite.id);
      if (vue) setSelection(vue);
    }
    void d;
  };

  const ouvrirLigne = (l: LigneRegistreAnnuel) => {
    if (l.type === "operation" && l.pspLigneId) {
      const vue = parPspLigneId.get(l.pspLigneId);
      if (vue) setSelection(vue);
      return;
    }
    // Ligne « commande » non rattachée → dialogue de correspondance (V8.6 §4).
    if (l.type === "commande" && l.id) setCommandeSelection(l.id);
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
          {/* V8.6.1 §4 — sélecteur d'année (défaut 2026). */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Année
            </span>
            <Select value={String(annee)} onValueChange={(v) => setAnnee(Number(v))}>
              <SelectTrigger className="h-8 w-24 text-[11px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {anneesDisponibles.map((a) => (
                  <SelectItem key={a} value={String(a)}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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

      {/* V8.6.1.1 — lignes annuelles SANS commande vues dans les imports (données
          non persistées — bandeau informatif, aucune solution parallèle). */}
      {lignesSansCommandeImport > 0 && (
        <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-[11px] text-amber-800">
          {lignesSansCommandeImport} ligne(s) annuelle(s) SANS commande présentes dans les imports
          du fichier annuel (« Numéro de commande manquant ») — leurs données métier ne sont pas
          persistées par le moteur d'import. Elles restent visibles ici en tant qu'opérations « Sans
          commande » une fois créées/rattachées.
        </div>
      )}

      <main className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6">
        {isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Chargement du suivi annuel…
          </p>
        ) : (
          <SuiviTable lignes={lignes} annee={annee} onOpen={ouvrirLigne} />
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
