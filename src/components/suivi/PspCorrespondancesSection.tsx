/**
 * V8.5.2 â€” REVUE DES CORRESPONDANCES COMMANDES (lecture seule).
 *
 * Affiche les propositions du moteur V8.5.1 (`proposerRapprochements`) dans la
 * fiche opÃ©ration du registre /suivi. Aucune Ã©criture, aucune validation.
 * La commande est identifiÃ©e par travaux_commandes.id ; le lien futur reste
 * psp_command_links (V8.5.3). Les commandes dÃ©jÃ  liÃ©es sont marquÃ©es
 * Â« DÃ©jÃ  rapprochÃ©e Â» (jamais re-proposÃ©es comme nouvelles).
 */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileSearch, Link2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { getPspCorrespondances } from "@/lib/psp.prep.supabase.functions";
import { deriverExerciceCorrespondance } from "@/lib/psp.suivi.rapprochement";

const fmtMontant = (v: number | null | undefined): string => {
  if (v == null) return "â€”";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(v);
};

const NIVEAU_LABEL: Record<string, string> = {
  AUTO: "Correspondance forte",
  A_CONFIRMER: "Ã€ confirmer",
  MANUEL: "Correspondance faible",
  NON_RAPPROCHE: "Non rapprochÃ©e",
};

const NIVEAU_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  AUTO: "default",
  A_CONFIRMER: "secondary",
  MANUEL: "outline",
};

/** Structure d'une proposition (moteur V8.5.1 + commande jointe par le serveur). */
type CommandeRevue = {
  id: string;
  numero_commande: string | null;
  tranche_code: string | null;
  adresse: string | null;
  corps_etat: string | null;
  descriptif: string | null;
  fournisseur: string | null;
  numero_fournisseur: string | null;
  budget: number | null;
  annee_exercice: number | null;
};

type PropositionRevue = {
  operationId: string;
  commandeId: string;
  score: number;
  niveau: string;
  raisons: string[];
  conflits: string[];
  criteres: Record<string, string> | null;
  candidatsAlternatifs: { operationId: string; score: number }[] | null;
  dejaLie: boolean;
  methodeLien: string | null;
  statutLien: string | null;
  commande: CommandeRevue | null;
};

export default function PspCorrespondancesSection({ pspLigneId }: { pspLigneId: string }) {
  const fetchCorresp = useServerFn(getPspCorrespondances);
  const { data, isLoading } = useQuery({
    queryKey: ["psp-correspondances", pspLigneId],
    queryFn: () => fetchCorresp({ data: { pspLigneId } }),
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  const propositions = ((data as { propositions?: PropositionRevue[] } | undefined)?.propositions ??
    []) as PropositionRevue[];
  const annees = ((data as { annees_programmation?: number[] } | undefined)?.annees_programmation ??
    []) as number[];

  if (isLoading) {
    return (
      <p className="text-[11px] text-muted-foreground">Analyse des correspondances commandesâ€¦</p>
    );
  }

  if (propositions.length === 0) {
    return (
      <p className="rounded border border-dashed px-2 py-1.5 text-[11px] text-muted-foreground">
        Aucune correspondance suffisamment fiable sur les commandes disponibles.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-muted-foreground">
        Propositions du moteur de dÃ©tection â€” <b>aucune validation effectuÃ©e</b> (revue
        uniquement).
      </p>
      {propositions.map((p: PropositionRevue) => {
        const cmd = p.commande;
        if (!cmd) return null;
        const exercice = deriverExerciceCorrespondance(annees, cmd.annee_exercice ?? null);
        const historique = exercice.type === "historique";
        return (
          <div
            key={p.commandeId}
            className={`rounded border px-2 py-1.5 text-[11px] ${historique ? "border-dashed opacity-80" : ""}`}
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
              <span className="font-bold">Commande {cmd.numero_commande ?? "â€”"}</span>
              <Badge variant={NIVEAU_VARIANT[p.niveau] ?? "outline"}>
                {p.dejaLie ? "DÃ©jÃ  rapprochÃ©e" : (NIVEAU_LABEL[p.niveau] ?? p.niveau)}
              </Badge>
              <span className="text-muted-foreground">Score : {p.score} %</span>
              {historique && <Badge variant="outline">{exercice.libelle}</Badge>}
              {!historique && <span className="text-muted-foreground">{exercice.libelle}</span>}
              {p.dejaLie && (
                <span className="text-[10px] text-muted-foreground">
                  <Link2 className="mr-1 inline size-3" />
                  {p.methodeLien ?? "lien"} Â· {p.statutLien ?? ""}
                </span>
              )}
            </div>
            <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground sm:grid-cols-3">
              <span>{cmd.tranche_code ?? "TR â€”"}</span>
              <span>{cmd.adresse ?? "Adresse â€”"}</span>
              <span>{cmd.corps_etat ?? "Corps d'Ã©tat â€”"}</span>
              <span>{cmd.fournisseur ?? cmd.numero_fournisseur ?? "Entreprise â€”"}</span>
              <span>CommandÃ© : {fmtMontant(cmd.budget)}</span>
              <span>{cmd.descriptif ?? "Descriptif â€”"}</span>
            </div>
            <details className="mt-1">
              <summary className="cursor-pointer text-[10px] text-muted-foreground">
                Pourquoi cette correspondance ?
              </summary>
              <ul className="mt-1 space-y-0.5 text-[10px]">
                {p.raisons?.map((r) => (
                  <li key={r} className="text-emerald-700">
                    âœ“ {r}
                  </li>
                ))}
                {p.conflits?.map((c) => (
                  <li key={c} className="text-amber-700">
                    âš {c}
                  </li>
                ))}
                {p.criteres && (
                  <li className="text-muted-foreground">
                    AnnÃ©e :{" "}
                    {p.criteres["annee"] === "inconnu" ? "non comparable" : p.criteres["annee"]} Â·
                    Montant :{" "}
                    {p.criteres["montant"] === "inconnu" ? "non comparable" : p.criteres["montant"]}
                  </li>
                )}
              </ul>
            </details>
            {p.candidatsAlternatifs && p.candidatsAlternatifs.length > 0 && (
              <p className="mt-1 text-[10px] font-semibold text-amber-700">
                Plusieurs correspondances possibles â€” Ã confirmer :{" "}
                {p.candidatsAlternatifs.map((c) => `CMD (${c.score} %)`).join(" Â· ")}
              </p>
            )}
            {!p.dejaLie && (
              <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                <FileSearch className="size-3" />
                Examiner uniquement â€” le rattachement sera disponible dans une prochaine Ã©tape.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
