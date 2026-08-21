/**
 * V8.10 — TABLEAU DES DEMANDES DE DEVIS (onglets de /suivi).
 *
 * Tableau partagé par les deux onglets : « Suivi annuel » (opérations sans
 * commande → demandes de devis) et « PSP » (opérations programmées). Filtre
 * d'avancement dérivé des données RÉELLES (psp_devis) : Sans devis /
 * Attente de devis / Devis reçus / Toutes. Aucun MOCK, aucun état inventé.
 * Clic sur une ligne → ouvre la fiche opération (workflow demande de devis).
 */
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { money0 } from "@/lib/formats";
import {
  AVANCEMENT_DEVIS_LABELS,
  AVANCEMENT_DEVIS_OPTIONS,
  filtrerAvancementDevis,
  type AvancementDevis,
  type LigneDemandeDevis,
} from "@/lib/psp.suivi.view";

const AVANCEMENT_BADGE: Record<AvancementDevis, string> = {
  sans_devis: "outline text-amber-700",
  attente_devis: "bg-sky-100 text-sky-800",
  devis_recus: "bg-emerald-600 text-white",
};

/** Filtre segmenté de l'avancement devis. */
export default function TableauDemandesDevis({
  titre,
  sousTitre,
  lignes,
  onOpen,
}: {
  titre: string;
  sousTitre?: string;
  lignes: LigneDemandeDevis[];
  onOpen: (l: LigneDemandeDevis) => void;
}) {
  // V8.10 — vue par défaut « Sans devis » (ce qui doit encore être demandé).
  const [avancement, setAvancement] = useState<AvancementDevis | "toutes">("sans_devis");
  const visibles = useMemo(() => filtrerAvancementDevis(lignes, avancement), [lignes, avancement]);

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-bold leading-tight">{titre}</h2>
        {sousTitre && <p className="text-[11px] text-muted-foreground">{sousTitre}</p>}
      </div>

      {/* Filtre d'avancement — Sans devis / Attente de devis / Devis reçus / Toutes */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          Avancement
        </label>
        {AVANCEMENT_DEVIS_OPTIONS.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => setAvancement(o)}
            className={
              avancement === o
                ? "rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground"
                : "rounded-md px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted"
            }
          >
            {o === "toutes" ? "Toutes" : AVANCEMENT_DEVIS_LABELS[o]}
          </button>
        ))}
      </div>

      {/* Tableau */}
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[820px] text-[11px]">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-2 py-1.5 font-bold">Opération / Nature</th>
              <th className="px-2 py-1.5 font-bold">Origine</th>
              <th className="px-2 py-1.5 font-bold">TR</th>
              <th className="px-2 py-1.5 font-bold">Adresse</th>
              <th className="px-2 py-1.5 font-bold">CC</th>
              <th className="px-2 py-1.5 font-bold">Corps d&apos;état</th>
              <th className="px-2 py-1.5 font-bold">Programmé</th>
              <th className="px-2 py-1.5 font-bold">Avancement devis</th>
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 ? (
              <tr>
                <td className="px-2 py-3 text-muted-foreground" colSpan={8}>
                  Aucune opération pour cet avancement de devis.
                </td>
              </tr>
            ) : (
              visibles.map((l) => (
                <tr
                  key={l.key}
                  className="cursor-pointer border-b border-dashed hover:bg-muted/40"
                  onClick={() => onOpen(l)}
                  title="Ouvrir la fiche opération (demande de devis)"
                >
                  <td className="px-2 py-1.5">
                    <span className="line-clamp-1 block max-w-[200px] text-[10px]">
                      {l.nature ?? "—"}
                    </span>
                  </td>
                  <td className="px-2 py-1.5">
                    <Badge variant={l.origine === "hors_psp" ? "secondary" : "outline"}>
                      {l.origine === "hors_psp" ? "Hors PSP" : "PSP"}
                    </Badge>
                  </td>
                  <td className="px-2 py-1.5 font-bold">{l.tranche}</td>
                  <td className="max-w-[200px] px-2 py-1.5">
                    <span className="block truncate text-[10px]" title={l.adresse ?? ""}>
                      {l.adresse ?? "—"}
                    </span>
                  </td>
                  <td className="px-2 py-1.5">{l.cc ?? "—"}</td>
                  <td className="max-w-[160px] px-2 py-1.5">
                    <span className="line-clamp-1 block text-[10px]">{l.corps_etat ?? "—"}</span>
                  </td>
                  <td className="px-2 py-1.5">
                    {l.montant != null && l.montant > 0 ? (
                      <span className="font-semibold">{money0(l.montant)}</span>
                    ) : (
                      <span className="text-muted-foreground">Hors programme</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    <span className="inline-flex flex-wrap items-center gap-1">
                      <Badge className={AVANCEMENT_BADGE[l.avancement]}>
                        {AVANCEMENT_DEVIS_LABELS[l.avancement]}
                      </Badge>
                      {l.avancement !== "sans_devis" && (
                        <span className="text-[9px] text-muted-foreground">
                          {l.nb_demandes} demande(s) · {l.nb_devis_recus} reçu(s)
                        </span>
                      )}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-muted-foreground">
        {visibles.length} ligne(s) affichée(s) sur {lignes.length} — cliquez pour ouvrir la fiche et
        faire les demandes de devis. L&apos;avancement est dérivé des demandes réelles (psp_devis),
        aucun état inventé.
      </p>
    </div>
  );
}
