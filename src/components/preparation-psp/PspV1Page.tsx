/**
 * V1 VISUELLE — Futur module de préparation PSP (prototype UX, lecture seule).
 *
 * Cette V1 construit UNIQUEMENT l'interface et le parcours utilisateur à partir
 * du modèle PSP stabilisé (V8.9.2) :
 *  · UNE opération métier = UNE psp_ligne ;
 *  · données réelles en LECTURE SEULE (getPspSuiviOperations +
 *    getPspRevueAnciennes) — aucune écriture, aucun mock persistant ;
 *  · trois niveaux clairement séparés : PRÉPARATION / REVUE / SUIVI ;
 *  · tableau structuré (identification fixe + années scrollables) ;
 *  · fiche opération en blocs (A Identification / B Programmation /
 *    C Consultation / D Suivi) — le bloc D réutilise PspSuiviApercu.
 *
 * Aucune nouvelle table, aucun nouveau moteur, aucune écriture Supabase.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarRange, Eye, FolderClock, Plus, Search } from "lucide-react";

import PspRevueAnciennes from "@/components/preparation-psp/PspRevueAnciennes";
import PspV1CreationDialog from "@/components/preparation-psp/PspV1CreationDialog";
import PspV1Fiche from "@/components/preparation-psp/PspV1Fiche";
import PspV1Table from "@/components/preparation-psp/PspV1Table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getPspRevueAnciennes, getPspSuiviOperations } from "@/lib/psp.prep.supabase.functions";
import { PSP_ANNEES } from "@/lib/psp.prep";
import type { SuiviOperationVue } from "@/lib/psp.suivi.foundation";
import { cn } from "@/lib/utils";

/** Année de référence de la programmation pluriannuelle (2027-2031). */
export const ANNEE_REFERENCE_V1 = 2027;

export type NiveauV1 = "preparation" | "revue" | "suivi";

const NIVEAUX: Array<{ valeur: NiveauV1; label: string; description: string; icone: typeof Eye }> =
  [
    {
      valeur: "preparation",
      label: "Préparation",
      description: "Programmation actuelle 2027-2031",
      icone: CalendarRange,
    },
    {
      valeur: "revue",
      label: "Revue",
      description: "Anciennes programmations",
      icone: FolderClock,
    },
    {
      valeur: "suivi",
      label: "Suivi",
      description: "Exécution annuelle réelle",
      icone: Eye,
    },
  ];

export default function PspV1Page() {
  const fetchOperations = useServerFn(getPspSuiviOperations);
  const fetchRevue = useServerFn(getPspRevueAnciennes);

  const { data: dataOperations } = useQuery({
    queryKey: ["psp-v1-operations"],
    queryFn: () => fetchOperations(),
    staleTime: 1000 * 60,
    retry: 1,
  });

  const { data: revue } = useQuery({
    queryKey: ["psp-v1-revue"],
    queryFn: () => fetchRevue({ data: { anneeReference: ANNEE_REFERENCE_V1 } }),
    staleTime: 1000 * 60,
    retry: 1,
  });

  const operations = useMemo(() => dataOperations?.operations ?? [], [dataOperations]);

  // La PRÉPARATION ne concerne QUE les opérations de la programmation
  // (preparation / report / esquisse) — jamais les lignes 'suivi' du registre.
  const operationsPreparation = useMemo(
    () =>
      operations.filter((o) => {
        const origine = o.programmation.ligne.origine;
        return origine === "preparation" || origine === "report" || origine === "esquisse";
      }),
    [operations],
  );

  const [niveau, setNiveau] = useState<NiveauV1>("preparation");
  const [recherche, setRecherche] = useState("");
  const [categorie, setCategorie] = useState<string>("");
  const [selectedOpId, setSelectedOpId] = useState<string | null>(null);
  const [creationOuverte, setCreationOuverte] = useState(false);

  const selectedOp = useMemo(
    () => operations.find((o) => o.identite.id === selectedOpId) ?? null,
    [operations, selectedOpId],
  );

  const filtered = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return operationsPreparation.filter((op) => {
      if (categorie && op.identite.categorie !== categorie) return false;
      if (!q) return true;
      const haystack = [
        op.identite.tranche,
        op.programmation.nature,
        op.programmation.adresse,
        op.programmation.corps_etat,
        op.programmation.cc,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [operationsPreparation, recherche, categorie]);

  const totalParAnnee = useMemo(() => {
    const totaux: Record<string, number> = {};
    for (const a of PSP_ANNEES) totaux[String(a)] = 0;
    for (const op of filtered) {
      for (const { annee, montant } of op.programmation.annees) {
        const idx = PSP_ANNEES.indexOf(annee as (typeof PSP_ANNEES)[number]);
        if (idx >= 0) {
          const cle = String(annee);
          totaux[cle] = (totaux[cle] ?? 0) + montant;
        }
      }
    }
    return totaux;
  }, [filtered]);

  return (
    <div className="mx-auto max-w-[2200px] space-y-4 px-4 py-4 sm:px-6">
      {/* ── En-tête ─────────────────────────────────────────────────────────── */}
      <header className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary p-2 text-primary-foreground shadow-md shadow-primary/20">
            <CalendarRange className="size-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-black uppercase tracking-tight">Préparation PSP</h1>
              <Badge className="border-violet-200 bg-violet-50 text-violet-700">Prototype V1</Badge>
              <Badge variant="outline" className="font-mono text-[10px]">
                Référence : {ANNEE_REFERENCE_V1}
              </Badge>
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Programmation pluriannuelle des travaux · lecture seule
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => setCreationOuverte(true)}>
            <Plus className="size-3.5" />
            Ajouter une opération
          </Button>
          <Button variant="outline" size="sm" title="Exporter la programmation (à venir)">
            Exporter
          </Button>
        </div>
      </header>

      {/* ── Navigation 3 niveaux ────────────────────────────────────────────── */}
      <nav className="flex flex-wrap gap-2">
        {NIVEAUX.map(({ valeur, label, description, icone: Icone }) => (
          <button
            key={valeur}
            type="button"
            onClick={() => setNiveau(valeur)}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors",
              niveau === valeur
                ? "border-primary bg-primary/10 ring-1 ring-primary"
                : "bg-card hover:bg-card/70",
            )}
          >
            <Icone className="size-4 text-muted-foreground" />
            <span>
              <span className="block text-xs font-black uppercase tracking-widest">{label}</span>
              <span className="block text-[9px] text-muted-foreground">{description}</span>
            </span>
          </button>
        ))}
      </nav>

      {/* ── Niveau PRÉPARATION ─────────────────────────────────────────────── */}
      {niveau === "preparation" ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-2 size-3.5 text-muted-foreground" />
              <Input
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Rechercher TR, adresse, descriptif…"
                className="h-8 w-[260px] pl-7 text-xs"
              />
            </div>
            <select
              value={categorie}
              onChange={(e) => setCategorie(e.target.value)}
              className="h-8 rounded-md border bg-card px-2 text-xs focus:outline-none"
            >
              <option value="">Toutes catégories (GE/GT/CP)</option>
              <option value="GE">GE</option>
              <option value="GT">GT</option>
              <option value="CP">CP</option>
            </select>
            <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {filtered.length} opération(s) programmée(s)
            </span>
          </div>

          <PspV1Table
            operations={filtered}
            totalParAnnee={totalParAnnee}
            onOpen={setSelectedOpId}
          />

          {selectedOp ? (
            <PspV1Fiche operation={selectedOp} onClose={() => setSelectedOpId(null)} />
          ) : null}
        </>
      ) : null}

      {/* ── Niveau REVUE ───────────────────────────────────────────────────── */}
      {niveau === "revue" ? (
        <PspRevueAnciennes entrees={revue ?? []} anneeReference={ANNEE_REFERENCE_V1} />
      ) : null}

      {/* ── Niveau SUIVI ───────────────────────────────────────────────────── */}
      {niveau === "suivi" ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-xs font-black uppercase tracking-widest text-foreground">
              /preparation-psp
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Ce que nous prévoyons — la programmation pluriannuelle 2027-2031.
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-xs font-black uppercase tracking-widest text-foreground">/suivi</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Ce qui se passe réellement sur l'exercice — projection annuelle stricte. Un devis ne
              détermine jamais l'année ; aucune commande future n'apparaît artificiellement.
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-xs font-black uppercase tracking-widest text-foreground">
              /dashboard-travaux
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Information issue des commandes et des imports (source READ-ONLY).
            </p>
          </div>
        </div>
      ) : null}

      <PspV1CreationDialog open={creationOuverte} onClose={() => setCreationOuverte(false)} />
    </div>
  );
}
