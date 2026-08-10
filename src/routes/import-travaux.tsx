import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { FileSpreadsheet, Upload, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { parseTravauxWorkbook, type ParsedTravaux } from "@/lib/travaux";
import {
  createTravauxImport,
  failTravauxImport,
  finalizeTravauxImport,
  importTravauxBatch,
} from "@/lib/travaux.functions";

export const Route = createFileRoute("/import-travaux")({
  head: () => ({
    meta: [
      { title: "Import des commandes de travaux" },
      {
        name: "description",
        content:
          "Import séparé des exportations de commandes de travaux avec détection des doublons et suivi des modifications.",
      },
    ],
  }),
  component: ImportTravauxPage,
});

type Report = {
  creees: number;
  modifiees: number;
  inchangees: number;
  archivees: number;
  ignorees: number;
  erreurs: number;
  doublons: number;
};

function ImportTravauxPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const createImport = useServerFn(createTravauxImport);
  const runBatch = useServerFn(importTravauxBatch);
  const finalize = useServerFn(finalizeTravauxImport);
  const failImport = useServerFn(failTravauxImport);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<ParsedTravaux | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [anneeExercice, setAnneeExercice] = useState<string>(new Date().getFullYear().toString());

  const handleFile = async (file: File) => {
    setBusy(true);
    setError(null);
    setReport(null);
    setPreview(null);
    setProgress(0);
    let execution: { id: string } | undefined;
    try {
      setMessage("Analyse du fichier…");
      const parsed = parseTravauxWorkbook(await file.arrayBuffer());
      setPreview(parsed);
      const importResult = await createImport({
        data: {
          fichier: file.name,
          lignes: parsed.lignes,
          doublons: parsed.doublons,
          erreurs: parsed.erreurs.length,
          annee_exercice: parseInt(anneeExercice),
        },
      });
      execution = { id: importResult.id };
      const parts = Array.from({ length: Math.ceil(parsed.commandes.length / 100) }, (_, index) =>
        parsed.commandes.slice(index * 100, index * 100 + 100),
      );
      let totals = { creees: 0, modifiees: 0, inchangees: 0, ignorees: 0 };
      for (let index = 0; index < parts.length; index += 1) {
        const result = await runBatch({
          data: {
            importId: importResult.id,
            annee_exercice: importResult.annee_exercice,
            commandes: parts[index]!,
          },
        });
        totals = {
          creees: totals.creees + result.creees,
          modifiees: totals.modifiees + result.modifiees,
          inchangees: totals.inchangees + result.inchangees,
          ignorees: totals.ignorees + result.ignorees,
        };
        setProgress(Math.round(((index + 1) / Math.max(parts.length, 1)) * 100));
        setMessage(
          `Synchronisation ${index + 1}/${parts.length} — ${parsed.commandes.length} commandes`,
        );
      }
      setMessage("Archivage des commandes absentes…");
      const result = await finalize({ data: { importId: execution.id } });
      setReport({
        ...totals,
        archivees: result.archivees,
        erreurs: parsed.erreurs.length,
        doublons: parsed.doublons,
      });
      setMessage(null);
    } catch (cause) {
      if (typeof execution !== "undefined") {
        try {
          await failImport({ data: { importId: execution.id } });
        } catch {
          // Échec silencieux : l'import sera marqué comme erreur au prochain nettoyage
        }
      }
      setError(cause instanceof Error ? cause.message : "Import impossible");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-8">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Import commandes travaux</h1>
          <p className="text-sm text-muted-foreground">
            Flux indépendant d’ISIS : les commandes sont rapprochées par numéro, les changements
            sont historisés et les absentes archivées.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/">Accueil</Link>
        </Button>
      </header>
      <div className="rounded-xl border border-dashed bg-surface p-8 text-center space-y-6">
        <div className="mx-auto max-w-xs text-left space-y-2">
          <Label htmlFor="annee-exercice" className="flex items-center gap-2">
            <Calendar className="size-4" /> Année de l'exercice
          </Label>
          <Select value={anneeExercice} onValueChange={setAnneeExercice} disabled={busy}>
            <SelectTrigger id="annee-exercice">
              <SelectValue placeholder="Sélectionner l'année" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i).map(
                (year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="pt-4 border-t border-dashed">
          <FileSpreadsheet className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Export Excel des commandes de travaux (.xlsx ou .xls)
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <Button className="mt-4" disabled={busy} onClick={() => inputRef.current?.click()}>
            <Upload className="size-4" /> Choisir le fichier
          </Button>
        </div>
      </div>
      {busy || message ? (
        <div className="space-y-2">
          <Progress value={progress} />
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {preview ? (
        <section className="space-y-2 rounded-xl border bg-surface p-4 text-sm">
          <h2 className="font-semibold">Résumé de lecture</h2>
          <ul className="space-y-1 text-muted-foreground">
            <li>
              {preview.commandes.length} commandes reconnues sur {preview.lignes} lignes
            </li>
            <li>
              {preview.doublons} doublon(s) interne(s), dont {preview.conflits.length} conflit(s)
            </li>
            <li>{preview.erreurs.length} ligne(s) invalide(s)</li>
          </ul>
          {preview.conflits.length || preview.erreurs.length ? (
            <p className="text-warning-foreground">
              Les lignes valides sont importées ; les anomalies restent comptabilisées dans le
              rapport.
            </p>
          ) : null}
        </section>
      ) : null}
      {report ? (
        <section className="space-y-2 rounded-xl border bg-surface p-4 text-sm">
          <h2 className="font-semibold">Rapport d’import</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            <p>{report.creees} créée(s)</p>
            <p>{report.modifiees} modifiée(s)</p>
            <p>{report.inchangees} inchangée(s)</p>
            <p>{report.archivees} archivée(s)</p>
            <p>{report.doublons} doublon(s)</p>
            <p>{report.ignorees} rattachement(s) non résolu(s)</p>
            <p>{report.erreurs} erreur(s)</p>
          </div>
        </section>
      ) : null}
    </main>
  );
}
