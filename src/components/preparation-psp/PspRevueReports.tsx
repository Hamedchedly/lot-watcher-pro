import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRightLeft, CheckCircle2, Flag, Info, RefreshCw } from "lucide-react";

import PspSecteurBadge from "@/components/preparation-psp/PspSecteurBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { money0 } from "@/lib/formats";
import {
  analyserLignesReport,
  modificationDejaConfirmee,
  resumeArbitrage,
  type LigneArbitrage,
  type LigneProgrammee,
  type LigneSuivi,
  type ModificationSuivi,
  type StatutArbitrage,
} from "@/lib/psp.prep.suivi";
import { cn } from "@/lib/utils";

const STATUTS: Record<StatutArbitrage, { label: string; className: string }> = {
  non_engagee: {
    label: "Programmée · non engagée",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  commande_non_terminee: {
    label: "Commande non terminée",
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
  terminee: {
    label: "Terminée",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  pas_realisee: {
    label: "Pas réalisée",
    className: "border-red-200 bg-red-50 text-red-600",
  },
  hors_programmation: {
    label: "Hors programmation",
    className: "border-violet-200 bg-violet-50 text-violet-700",
  },
  inconnue: {
    label: "À arbitrer",
    className: "border-slate-200 bg-slate-50 text-slate-600",
  },
};

/**
 * Vue « Opérations N à arbitrer » du préparateur PSP :
 * consomme les RÉSULTATS EXISTANTS du suivi annuel (moteur d'import) — état via
 * `etatMetier` — et propose des décisions LOCALES (report / annulation /
 * conservation / réévaluation) qui ne modifient que le brouillon courant.
 */
export default function PspRevueReports({
  programmees,
  suivi,
  exercice,
  modifications,
  confirmees,
  decisions,
  onReporter,
  onAnnuler,
  onConserver,
  onReevaluer,
  onConfirmerModification,
}: {
  programmees: LigneProgrammee[];
  suivi: LigneSuivi[];
  exercice: number;
  modifications: ModificationSuivi[];
  confirmees: ReadonlySet<string>;
  decisions: ReadonlyMap<string, string>;
  onReporter: (ligne: LigneArbitrage, anneeCible: number) => void;
  onAnnuler: (ligne: LigneArbitrage) => void;
  onConserver: (ligne: LigneArbitrage) => void;
  onReevaluer: (ligne: LigneArbitrage) => void;
  onConfirmerModification: (modification: ModificationSuivi) => void;
}) {
  const lignes = useMemo(
    () => analyserLignesReport(programmees, suivi, exercice),
    [programmees, suivi, exercice],
  );
  const resume = useMemo(() => resumeArbitrage(lignes), [lignes]);
  const [anneeCible, setAnneeCible] = useState<number>(2027);

  return (
    <div className="space-y-4">
      <Card className="shadow-panel">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Flag className="size-4 text-muted-foreground" />
            Opérations {exercice - 1} à arbitrer
            <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Source : suivi annuel constaté (moteur d'import existant)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1.5">
            <Badge className="border-slate-200 bg-slate-100 text-slate-700">
              {resume.programmees} programmées
            </Badge>
            <Badge className="border-amber-200 bg-amber-50 text-amber-700">
              {resume.sansCommande} sans commande
            </Badge>
            <Badge className="border-blue-200 bg-blue-50 text-blue-700">
              {resume.commandeNonTerminee} commande non terminée
            </Badge>
            <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
              {resume.terminees} terminées
            </Badge>
            {resume.pasRealisees > 0 ? (
              <Badge className="border-red-200 bg-red-50 text-red-600">
                {resume.pasRealisees} pas réalisées
              </Badge>
            ) : null}
            {resume.horsProgrammation > 0 ? (
              <Badge className="border-violet-200 bg-violet-50 text-violet-700">
                {resume.horsProgrammation} hors programmation
              </Badge>
            ) : null}
          </div>

          <div className="mt-3 max-h-[52vh] overflow-auto rounded-lg border">
            <Table className="min-w-[1000px]">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">
                    TR
                  </TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">
                    C
                  </TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">
                    LB
                  </TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">
                    Nature travaux
                  </TableHead>
                  <TableHead className="text-right text-[10px] font-black uppercase tracking-widest">
                    Montant programmé
                  </TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">
                    Commande
                  </TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">
                    État
                  </TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">
                    Année initiale
                  </TableHead>
                  <TableHead className="text-right text-[10px] font-black uppercase tracking-widest">
                    Décision
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lignes.map((l) => (
                  <LigneReportRow
                    key={`${l.tranche}|${l.categorie}|${l.nature_travaux}`}
                    ligne={l}
                    anneeCible={anneeCible}
                    onAnneeCible={setAnneeCible}
                    decision={decisions.get(`${l.tranche}|${l.categorie}`)}
                    onReporter={onReporter}
                    onAnnuler={onAnnuler}
                    onConserver={onConserver}
                    onReevaluer={onReevaluer}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ModificationsCard
        modifications={modifications}
        confirmees={confirmees}
        onConfirmer={onConfirmerModification}
      />
    </div>
  );
}

function LigneReportRow({
  ligne,
  anneeCible,
  onAnneeCible,
  decision,
  onReporter,
  onAnnuler,
  onConserver,
  onReevaluer,
}: {
  ligne: LigneArbitrage;
  anneeCible: number;
  onAnneeCible: (a: number) => void;
  decision: string | undefined;
  onReporter: (l: LigneArbitrage, anneeCible: number) => void;
  onAnnuler: (l: LigneArbitrage) => void;
  onConserver: (l: LigneArbitrage) => void;
  onReevaluer: (l: LigneArbitrage) => void;
}) {
  const statut = STATUTS[ligne.statut];
  return (
    <TableRow className={cn("align-top", ligne.statut === "terminee" && "opacity-70")}>
      <TableCell className="py-2 font-mono text-xs font-bold">{ligne.tranche}</TableCell>
      <TableCell className="py-2">
        <PspSecteurBadge categorie={ligne.categorie} />
      </TableCell>
      <TableCell className="py-2 font-mono text-[11px] text-muted-foreground">
        {ligne.ligne_budget ?? "—"}
      </TableCell>
      <TableCell className="max-w-[240px] py-2">
        <span className="block truncate text-xs" title={ligne.nature_travaux}>
          {ligne.nature_travaux}
        </span>
        {ligne.statut === "hors_programmation" ? (
          <span className="mt-0.5 block text-[10px] font-bold text-violet-700">
            HORS PROGRAMMATION / HORS BUDGET
          </span>
        ) : null}
      </TableCell>
      <TableCell className="py-2 text-right">
        <span className="tabnum text-xs font-black">{money0(ligne.montant_programme)}</span>
      </TableCell>
      <TableCell className="py-2">
        <span className="font-mono text-xs">{ligne.commande ?? "—"}</span>
      </TableCell>
      <TableCell className="py-2">
        <Badge className={cn("border text-[9px]", statut.className)}>{statut.label}</Badge>
        {ligne.ligne_suivi ? (
          <span className="mt-0.5 block text-[10px] text-muted-foreground">
            état suivi : {ligne.etat}
          </span>
        ) : null}
      </TableCell>
      <TableCell className="py-2 font-mono text-xs">{ligne.annee_initiale}</TableCell>
      <TableCell className="py-2 text-right">
        {decision ? (
          <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">{decision}</Badge>
        ) : (
          <ActionsLigne
            ligne={ligne}
            anneeCible={anneeCible}
            onAnneeCible={onAnneeCible}
            onReporter={onReporter}
            onAnnuler={onAnnuler}
            onConserver={onConserver}
            onReevaluer={onReevaluer}
          />
        )}
      </TableCell>
    </TableRow>
  );
}

function ActionsLigne({
  ligne,
  anneeCible,
  onAnneeCible,
  onReporter,
  onAnnuler,
  onConserver,
  onReevaluer,
}: {
  ligne: LigneArbitrage;
  anneeCible: number;
  onAnneeCible: (a: number) => void;
  onReporter: (l: LigneArbitrage, anneeCible: number) => void;
  onAnnuler: (l: LigneArbitrage) => void;
  onConserver: (l: LigneArbitrage) => void;
  onReevaluer: (l: LigneArbitrage) => void;
}) {
  if (ligne.statut === "terminee") {
    return <span className="text-[10px] text-muted-foreground">—</span>;
  }

  if (ligne.statut === "hors_programmation") {
    return <span className="text-[10px] text-muted-foreground">—</span>;
  }

  if (ligne.statut === "commande_non_terminee") {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-[11px]"
          onClick={() => onConserver(ligne)}
        >
          <CheckCircle2 className="size-3" />
          Conserver
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-[11px]"
          onClick={() => onReevaluer(ligne)}
        >
          <RefreshCw className="size-3" />
          Réévaluer
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-[11px]"
          onClick={() => onReporter(ligne, anneeCible)}
        >
          <ArrowRightLeft className="size-3" />
          Reporter
        </Button>
      </div>
    );
  }

  // non_engagee / pas_realisee → proposer un report.
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1">
        <Select value={String(anneeCible)} onValueChange={(v) => onAnneeCible(Number(v))}>
          <SelectTrigger className="h-7 w-[86px] text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[2027, 2028, 2029].map((a) => (
              <SelectItem key={a} value={String(a)}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-[11px]"
          onClick={() => onReporter(ligne, anneeCible)}
        >
          <ArrowRightLeft className="size-3" />
          Reporter
        </Button>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-[11px] text-destructive hover:text-destructive"
        onClick={() => onAnnuler(ligne)}
      >
        Annuler
      </Button>
    </div>
  );
}

/**
 * Alertes de modifications détectées par le moteur d'import existant
 * (historique « conflit » de `travaux_commandes_historique`). Réutilise la
 * mémoire de confirmation (`resolu` / décision locale) : une modification déjà
 * confirmée n'est pas redemandée.
 */
function ModificationsCard({
  modifications,
  confirmees,
  onConfirmer,
}: {
  modifications: ModificationSuivi[];
  confirmees: ReadonlySet<string>;
  onConfirmer: (m: ModificationSuivi) => void;
}) {
  if (modifications.length === 0) return null;
  return (
    <Card className="shadow-panel">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <AlertTriangle className="size-4 text-amber-500" />
          Modifications détectées par les imports
          <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            source : historique du moteur d'import (conflits)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {modifications.map((m, i) => {
            const confirmee = modificationDejaConfirmee(confirmees, m);
            return (
              <li key={i} className="rounded-lg border bg-surface/60 p-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge className="border-amber-200 bg-amber-50 text-amber-700">
                        {m.type}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        Ligne {m.ligne}
                        {m.date ? ` · import du ${m.date.slice(0, 10)}` : ""}
                        {m.source ? ` · ${m.source}` : ""}
                      </span>
                    </div>
                    <p className="mt-1 text-xs">
                      <span className="line-through text-muted-foreground">{m.ancien || "—"}</span>
                      <span className="mx-1.5 text-muted-foreground">→</span>
                      <span className="font-semibold">{m.nouveau || "—"}</span>
                    </p>
                  </div>
                  {confirmee ? (
                    <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
                      Confirmée
                    </Badge>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px]"
                      onClick={() => onConfirmer(m)}
                    >
                      <CheckCircle2 className="size-3" />
                      Confirmer (locale)
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Info className="size-3" />
          Décisions locales : une modification confirmée ne sera pas redemandée (même mécanisme que
          `travaux_commandes_historique.resolu`).
        </p>
      </CardContent>
    </Card>
  );
}
