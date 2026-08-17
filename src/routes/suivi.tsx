/**
 * V8.2 — SUIVI OPÉRATION (route /suivi).
 *
 * Tableau des opérations de la programmation PSP (socle V8.1) + fiche
 * opération organisée selon l'arborescence cible (Programmation · Consultation ·
 * Devis · Commandes → Travaux). Lecture seule, aucun MOCK, Dashboard inchangé.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Plus, Workflow } from "lucide-react";

import NouvelleOperationDialog from "@/components/suivi/NouvelleOperationDialog";
import SuiviOperationFiche from "@/components/suivi/SuiviOperationFiche";
import SuiviTable from "@/components/suivi/SuiviTable";
import { Button } from "@/components/ui/button";
import { getPspSuiviOperations } from "@/lib/psp.prep.supabase.functions";
import type { SuiviOperationVue } from "@/lib/psp.suivi.foundation";

export const Route = createFileRoute("/suivi")({
  head: () => ({
    meta: [
      { title: "Opérations — PSP" },
      {
        name: "description",
        content:
          "Registre opérationnel unique : toutes les opérations (PSP et hors PSP), consultation, devis, commandes et travaux.",
      },
    ],
  }),
  component: SuiviPage,
});

function SuiviPage() {
  const fetchSuivi = useServerFn(getPspSuiviOperations);
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["psp-suivi-operations"],
    queryFn: () => fetchSuivi(),
    staleTime: 1000 * 30,
    retry: 1,
  });

  const [selection, setSelection] = useState<SuiviOperationVue | null>(null);
  const [nouvelle, setNouvelle] = useState(false);

  const programmation = data?.programmation ?? null;
  const operations = (data?.operations ?? []) as SuiviOperationVue[];

  /**
   * V8.3 — recharge le registre après création/enregistrement (demande de devis)
   * et maintient la sélection à jour si la fiche est ouverte.
   */
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["psp-suivi-operations"] });
    const d = await queryClient.fetchQuery({
      queryKey: ["psp-suivi-operations"],
      queryFn: () => fetchSuivi(),
    });
    if (selection) {
      const miseAJour = (d.operations ?? []).find(
        (o: SuiviOperationVue) => o.identite.id === selection.identite.id,
      );
      if (miseAJour) setSelection(miseAJour);
    }
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
              {programmation
                ? `Programmation ${programmation.annee_debut}–${programmation.annee_fin} · v${programmation.version} · ${programmation.statut}`
                : "Aucune programmation officielle"}
            </p>
          </div>
          {/* V8.3 §3/§21 — créer une opération (PSP ou HORS PSP) directement ici. */}
          <Button size="sm" onClick={() => setNouvelle(true)}>
            <Plus className="size-3.5" /> Nouvelle opération
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

      <main className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6">
        {isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Chargement du suivi…
          </p>
        ) : error || !data ? (
          <p className="text-sm text-muted-foreground">Aucune donnée disponible.</p>
        ) : (
          <SuiviTable operations={operations} onOpen={setSelection} />
        )}
      </main>

      {selection && (
        <SuiviOperationFiche
          operation={selection}
          onClose={() => setSelection(null)}
          onRefresh={refresh}
        />
      )}
      {nouvelle && (
        <NouvelleOperationDialog
          open={nouvelle}
          onClose={() => setNouvelle(false)}
          programmationId={programmation?.id ?? null}
          onCreated={refresh}
        />
      )}
    </div>
  );
}
