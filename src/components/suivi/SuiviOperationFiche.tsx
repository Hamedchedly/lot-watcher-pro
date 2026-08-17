/**
 * V8.2 — SUIVI OPÉRATION : fiche opération (lecture seule) organisée selon
 * l'arborescence cible :
 *   Programmation · Consultation (Entreprises / Demandes / Relances / Réponses) ·
 *   Devis (reçus / comparatif / retenu) · Commandes (données importées) → Travaux.
 *
 * Consomme le socle V8.1 (SuiviOperationVue, suggestions, moteur mailto).
 * Aucune écriture, aucun MOCK.
 */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Building2,
  FileText,
  GitBranch,
  Handshake,
  Mail,
  MapPin,
  Wallet,
  Workflow,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { money0 } from "@/lib/formats";
import { getPspEntreprisesSuggestions } from "@/lib/psp.prep.supabase.functions";
import {
  MAIL_MODELES,
  composerMail,
  construireMailto,
  dateRetourParDefaut,
} from "@/lib/psp.suivi.foundation";
import { comparatifDevis, etapesAvancement } from "@/lib/psp.suivi.view";
import type { SuiviOperationVue } from "@/lib/psp.suivi.foundation";

const fmtDate = (v: string | null | undefined): string =>
  v ? new Date(v).toLocaleDateString("fr-FR") : "—";

export default function SuiviOperationFiche({
  operation,
  onClose,
}: {
  operation: SuiviOperationVue;
  onClose: () => void;
}) {
  const p = operation.programmation;
  const c = operation.consultation;
  const cmd = operation.commandes;
  const ex = operation.execution;
  const comparatif = comparatifDevis(operation.consultation.entreprises.flatMap((e) => e.devis));

  // Entreprises suggérées (données réelles — socle V8.1).
  const fetchSuggestions = useServerFn(getPspEntreprisesSuggestions);
  const { data: suggestions } = useQuery({
    queryKey: ["psp-suivi-suggestions", operation.identite.id],
    queryFn: () => fetchSuggestions({ data: { pspLigneId: operation.identite.id, limite: 6 } }),
    staleTime: 1000 * 60 * 10,
    retry: 1,
    enabled: operation.consultation.statut !== "devis_retenu",
  });

  // Aperçu mailto (demande de devis) — moteur central V8.1.
  const mail = composerMail(
    MAIL_MODELES.find((m) => m.id === "demande_devis")!,
    {
      TR: operation.identite.tranche,
      NATURE_TRAVAUX: p.nature ?? "",
      CORPS_ETAT: p.corps_etat ?? "",
      ADRESSE: p.adresse ?? "",
      DATE_RETOUR: dateRetourParDefaut(new Date()),
    },
  );
  const mailto = construireMailto({ email: null, sujet: mail.sujet, corps: mail.corps });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] w-[min(94vw,960px)] gap-0 p-0 sm:max-w-[960px]">
        <ScrollArea className="max-h-[calc(92vh-4rem)]">
          <div className="p-5">
            <DialogHeader className="space-y-2">
              <DialogTitle className="flex items-center gap-2 text-base">
                <Workflow className="size-4 text-primary" />
                Suivi opération — TR {operation.identite.tranche}
                <Badge variant="outline">{operation.identite.categorie}</Badge>
                <Badge variant="outline" className="text-[10px]">
                  PSP : {p.statut_psp_label}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  Opération : {ex.statut_label}
                </Badge>
              </DialogTitle>
              <DialogDescription>
                {p.nature ?? "Sans nature"} · {p.corps_etat ?? "Corps d'état non renseigné"} · CC{" "}
                {p.cc ?? "—"} · Priorité {p.priorite ?? "normale"}
              </DialogDescription>
            </DialogHeader>
            {/* V8.2.1 §5 — chaîne d avancement (états RÉELS) */}
            <div className="mt-3 rounded-lg border bg-muted/30 p-2">
              <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Avancement
              </p>
              <ol className="space-y-0.5">
                {etapesAvancement(operation).map((etape) => (
                  <li key={etape.code} className="flex items-center gap-2 text-[11px]">
                    <span className={etape.atteint ? "text-emerald-600" : "text-muted-foreground"}>
                      {etape.atteint ? "●" : "○"}
                    </span>
                    <span className={etape.atteint ? "font-semibold" : "text-muted-foreground"}>
                      {etape.label}
                    </span>
                    <span className="text-[9px] text-muted-foreground">↓</span>
                  </li>
                ))}
              </ol>
            </div>{" "}
            {/* ── PROGRAMMATION ── */}
            <Section title="Programmation" icon={Wallet}>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded border border-dashed p-2 text-[11px]">
                  <p className="text-muted-foreground">Répartition par année</p>
                  <ul className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
                    {p.annees.map((a) => (
                      <li key={a.annee} className="flex justify-between gap-2">
                        <span className="font-bold">{a.annee}</span>
                        <span>{a.montant > 0 ? money0(a.montant) : "—"}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                  <Cell label="Programmé" value={money0(p.montant_total)} />
                  <Cell label="Commandé" value={money0(cmd.budget_commande)} />
                  <Cell label="Engagé" value={money0(cmd.engage)} />
                  <Cell label="Payé" value={money0(cmd.paye)} />
                  <Cell label="Reste" value={money0(p.montant_total - cmd.engage)} strong />
                </div>
              </div>
            </Section>
            {/* ── CONSULTATION ── */}
            <Section title="Consultation" icon={Building2}>
              <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                <Badge variant="outline">Statut : {c.statut_label}</Badge>
                <span className="text-muted-foreground">
                  {c.nb_entreprises_consultees} entreprise(s) · {c.nb_demandes} demande(s) ·{" "}
                  {c.nb_devis_recus} devis reçu(s)
                </span>
                {c.relance_necessaire && (
                  <Badge className="bg-amber-100 text-amber-800">Relance nécessaire</Badge>
                )}
              </div>
              {c.entreprises.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">Aucune donnée disponible.</p>
              ) : (
                <ul className="space-y-1">
                  {c.entreprises.map((e) => (
                    <li
                      key={e.fournisseur_id ?? e.entreprise}
                      className="flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded border border-dashed px-2 py-1 text-[11px]"
                    >
                      <span className="font-semibold">{e.entreprise}</span>
                      <span className="text-muted-foreground">
                        Demande : {fmtDate(e.date_demande)}
                      </span>
                      {e.date_devis && (
                        <span className="text-muted-foreground">
                          Réponse : {fmtDate(e.date_devis)}
                        </span>
                      )}
                      <span>
                        {e.statut_consultation === "devis_retenu" ? "Devis retenu" : e.statut_devis}
                      </span>
                      <span className="font-semibold">
                        {e.montant == null ? "—" : money0(e.montant)}
                      </span>
                      {e.relance_necessaire && (
                        <Badge className="bg-amber-100 text-amber-800 text-[9px]">Relance</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {/* Entreprises suggérées + préparation mailto */}
              <div className="mt-2 rounded border bg-muted/30 p-2">
                <p className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <Handshake className="size-3" /> Entreprises suggérées
                </p>
                {suggestions && suggestions.length > 0 ? (
                  <ul className="space-y-1">
                    {suggestions.map((s) => (
                      <li
                        key={s.fournisseur_id}
                        className="flex flex-wrap items-center gap-x-2 text-[11px]"
                      >
                        <span className="font-semibold">{s.nom}</span>
                        <Badge
                          variant={s.correspondance === "forte" ? "default" : "secondary"}
                          className="text-[9px]"
                        >
                          {s.correspondance === "forte"
                            ? "Correspondance forte"
                            : "Entreprise compatible"}
                        </Badge>
                        <span className="text-muted-foreground">{s.etiquettes.join(" · ")}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Aucune donnée disponible (activités manuelles non renseignées).
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button asChild variant="outline" size="sm" className="h-7 text-[10px]">
                    <a href={mailto} target="_blank" rel="noreferrer">
                      <Mail className="size-3" /> Préparer une demande (mailto:)
                    </a>
                  </Button>
                  <span className="text-[9px] text-muted-foreground">
                    PAT S11 ne vérifie pas l'envoi — à marquer comme envoyée (V8.3).
                  </span>
                </div>
              </div>
            </Section>
            {/* ── DEVIS ── */}
            <Section title="Devis" icon={FileText}>
              <div className="mb-2 flex flex-wrap gap-1.5 text-[11px]">
                <Badge variant="outline">{comparatif.nb_devises} devis reçu(s)</Badge>
                <Badge variant="outline">
                  Min {comparatif.min == null ? "—" : money0(comparatif.min)}
                </Badge>
                <Badge variant="outline">
                  Moy {comparatif.moyenne == null ? "—" : money0(comparatif.moyenne)}
                </Badge>
                <Badge variant="outline">
                  Max {comparatif.max == null ? "—" : money0(comparatif.max)}
                </Badge>
                {comparatif.nb_sans_montant > 0 && (
                  <Badge variant="outline" className="text-muted-foreground">
                    {comparatif.nb_sans_montant} demande(s) sans montant (normal)
                  </Badge>
                )}
              </div>
              {comparatif.retenu ? (
                <div className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] text-emerald-800">
                  Devis retenu — {comparatif.retenu.entreprise} ·{" "}
                  {fmtDate(comparatif.retenu.date_devis)} ·{" "}
                  {comparatif.retenu.montant == null ? "—" : money0(comparatif.retenu.montant)}
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Aucun devis retenu (la décision reste à l'utilisateur).
                </p>
              )}
            </Section>
            {/* ── COMMANDES (données importées) ── */}
            <Section title="Commandes" icon={GitBranch}>
              {cmd.liees.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  Aucune donnée disponible — opération sans commande (situation normale).
                </p>
              ) : (
                <ul className="space-y-1">
                  {cmd.liees.map((l) => (
                    <li
                      key={l.lien_id}
                      className="grid grid-cols-2 gap-x-3 gap-y-0.5 rounded border border-dashed px-2 py-1 text-[11px] sm:grid-cols-4"
                    >
                      <span className="font-semibold">{l.numero_commande ?? "—"}</span>
                      <span>{l.entreprise ?? "—"}</span>
                      <span>{l.budget == null ? "—" : money0(l.budget)}</span>
                      <span>
                        Engagé {l.engage == null ? "—" : money0(l.engage)} · Payé{" "}
                        {l.paye == null ? "—" : money0(l.paye)}
                      </span>
                      <span className="text-muted-foreground">
                        État cmd : {l.etat_commande ?? "—"}
                      </span>
                      <span className="text-muted-foreground">
                        État trav. : {l.etat_travaux ?? "—"}
                      </span>
                      <Badge variant="outline" className="text-[9px]">
                        {l.statut_rapprochement_label}
                      </Badge>
                      <span className="text-muted-foreground">{fmtDate(l.date_import)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
            {/* ── TRAVAUX / EXÉCUTION ── */}
            <Section title="Travaux / Exécution" icon={MapPin}>
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <Badge>{ex.statut_label}</Badge>
                <span className="text-muted-foreground">
                  Démarrage : {fmtDate(ex.date_demarrage)} · Fin : {fmtDate(ex.date_fin)}
                </span>
                <span className="text-muted-foreground">
                  Dernier état travaux : {ex.etat_travaux ?? "—"}
                </span>
              </div>
            </Section>
            <Separator className="my-4" />
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={onClose}>
                Fermer
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Wallet;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4">
      <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        <Icon className="size-3.5" />
        {title}
      </p>
      {children}
    </div>
  );
}

function Cell({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="rounded border border-dashed px-2 py-1">
      <p className="text-[9px] text-muted-foreground">{label}</p>
      <p className={`font-semibold ${strong ? "text-primary" : ""}`}>{value}</p>
    </div>
  );
}
