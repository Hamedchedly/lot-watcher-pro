/**
 * V8.2.1 — WORKFLOW DEMANDE DE DEVIS (fiche opération de /preparation-psp).
 *
 * Entreprises suggérées (données RÉELLES — socle V8.1) → sélection multi
 * (retirable) → « Préparer la demande de devis » → éditeur de mail par
 * entreprise (destinataire, sujet, corps modifiables) → mailto: → confirmation
 * « Demande préparée / envoyée » → enregistrement dans psp_devis
 * (statut demande_envoyee, montant NULL, date = created_at).
 *
 * PAT S11 ne prétend JAMAIS avoir envoyé le mail ; aucune connexion messagerie.
 */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckSquare, Mail, RefreshCcw, Square } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  MAIL_MODELES,
  composerMail,
  construireMailto,
  dateRetourParDefaut,
} from "@/lib/psp.suivi.foundation";
import { createPspDevis, getPspEntreprisesSuggestions } from "@/lib/psp.prep.supabase.functions";
import type { PspOperation } from "@/lib/psp.prep";

type SuggestionAvecEmail = {
  fournisseur_id: string;
  nom: string;
  correspondance: "forte" | "compatible" | "aucune";
  etiquettes: string[];
  email: string | null;
};

export default function PspDemandeDevisWorkflow({
  operation,
  figee,
  onEnvoye,
}: {
  operation: PspOperation;
  figee: boolean;
  onEnvoye: () => Promise<void>;
}) {
  const fetchSuggestions = useServerFn(getPspEntreprisesSuggestions);
  const creerDevis = useServerFn(createPspDevis);
  const { data: suggestions } = useQuery({
    queryKey: ["psp-suggestions", operation.id],
    queryFn: () =>
      fetchSuggestions({
        data: { pspLigneId: operation.id, corpsEtat: operation.corps_etat, limite: 8 },
      }),
    staleTime: 1000 * 60 * 10,
    retry: 1,
  });

  const [selectionIds, setSelectionIds] = useState<string[]>([]);
  const [editeur, setEditeur] = useState<SuggestionAvecEmail | null>(null);
  const [sujet, setSujet] = useState("");
  const [corps, setCorps] = useState("");
  const [enregistre, setEnregistre] = useState(false);

  const variables = {
    TR: operation.tranche,
    NATURE_TRAVAUX: operation.nature_travaux ?? "",
    CORPS_ETAT: operation.corps_etat ?? "",
    ADRESSE: [operation.adresse, operation.ville].filter(Boolean).join(", "),
    DATE_RETOUR: dateRetourParDefaut(new Date()),
  };
  const modele = () =>
    composerMail(
      MAIL_MODELES.find((m) => m.id === "demande_devis")!,
      variables,
    );

  useEffect(() => {
    if (!editeur) return;
    const m = modele();
    setSujet(m.sujet);
    setCorps(m.corps);
    setEnregistre(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editeur]);

  const basculer = (id: string) =>
    setSelectionIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const selection = (suggestions ?? []).filter((s) => selectionIds.includes(s.fournisseur_id));
  const mailto = editeur ? construireMailto({ email: editeur.email, sujet, corps }) : "";

  const enregistrerDemande = async () => {
    if (!editeur) return;
    await creerDevis({
      data: {
        pspLigneId: operation.id,
        fournisseurId: editeur.fournisseur_id,
        entreprise: editeur.nom,
        dateDevis: null,
        montant: null,
        statut: "demande_envoyee",
        commentaire: null,
        documentReference: null,
      },
    });
    setEnregistre(true);
    await onEnvoye();
    // Enchaînement : préparer la demande de l'entreprise suivante (si plusieurs).
    const idx = selection.findIndex((s) => s.fournisseur_id === editeur.fournisseur_id);
    const suivant = selection[idx + 1] ?? null;
    if (suivant) {
      setEditeur(suivant);
    } else {
      setEditeur(null);
    }
  };

  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        <Mail className="size-3.5" /> Demande de devis — entreprises suggérées
      </p>

      {suggestions && suggestions.length > 0 ? (
        <ul className="space-y-1">
          {(suggestions as SuggestionAvecEmail[]).map((s) => {
            const coche = selectionIds.includes(s.fournisseur_id);
            return (
              <li
                key={s.fournisseur_id}
                className="flex flex-wrap items-center gap-2 rounded border border-dashed px-2 py-1 text-[11px]"
              >
                <button
                  type="button"
                  onClick={() => basculer(s.fournisseur_id)}
                  className="inline-flex items-center gap-1.5 font-semibold hover:underline"
                >
                  {coche ? (
                    <CheckSquare className="size-3.5 text-primary" />
                  ) : (
                    <Square className="size-3.5 text-muted-foreground" />
                  )}
                  {s.nom}
                </button>
                <Badge
                  variant={s.correspondance === "forte" ? "default" : "secondary"}
                  className="text-[9px]"
                >
                  {s.correspondance === "forte" ? "Correspondance forte" : "Entreprise compatible"}
                </Badge>
                <span className="text-muted-foreground">{s.etiquettes.join(" · ")}</span>
                {s.email && <span className="text-[9px] text-muted-foreground">{s.email}</span>}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Aucune donnée disponible (activités manuelles non renseignées).
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          className="h-7 text-[10px]"
          disabled={figee || selection.length === 0}
          onClick={() => setEditeur(selection[0] ?? null)}
        >
          <Mail className="size-3" /> Préparer la demande de devis
        </Button>
        <span className="text-[9px] text-muted-foreground">
          {selection.length} entreprise(s) sélectionnée(s)
        </span>
      </div>

      {/* Éditeur de mail (une entreprise à la fois) */}
      <Dialog open={editeur !== null} onOpenChange={(o) => !o && setEditeur(null)}>
        <DialogContent className="w-[min(94vw,640px)]">
          <DialogHeader>
            <DialogTitle className="text-sm">Demande de devis — {editeur?.nom}</DialogTitle>
            <DialogDescription>
              Destinataire :{" "}
              {editeur?.email ? (
                editeur.email
              ) : (
                <span className="font-semibold text-amber-700">
                  Email fournisseur non renseigné
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Sujet
            </label>
            <Input
              value={sujet}
              onChange={(e) => setSujet(e.target.value)}
              className="h-8 text-[11px]"
            />
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Corps
            </label>
            <Textarea
              value={corps}
              onChange={(e) => setCorps(e.target.value)}
              rows={12}
              className="text-[11px]"
            />
          </div>
          <DialogFooter className="flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[10px]"
              onClick={() => {
                const m = modele();
                setSujet(m.sujet);
                setCorps(m.corps);
              }}
            >
              <RefreshCcw className="size-3" /> Réinitialiser le modèle
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[10px]"
              onClick={() => navigator.clipboard?.writeText(`${sujet}\n\n${corps}`)}
            >
              Copier
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <a
                  href={mailto}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-7 items-center gap-1 rounded-md bg-primary px-3 text-[10px] font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <Mail className="size-3" /> Ouvrir dans ma messagerie
                </a>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Demande préparée / envoyée ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Le mail va être ouvert dans votre messagerie (mailto:). PAT S11 ne peut pas
                    vérifier l'envoi. Confirmez pour enregistrer la demande (date = aujourd'hui,
                    statut « Demande envoyée », montant vide).
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Non, plus tard</AlertDialogCancel>
                  <AlertDialogAction onClick={enregistrerDemande}>
                    Oui, marquer comme envoyée
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </DialogFooter>
          {enregistre && (
            <p className="text-[11px] font-semibold text-emerald-700">
              ✓ Demande enregistrée — visible dans le Suivi.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
