/**
 * V7.5 — Panneau adresse / périmètre partagé (saisie directe + formulaire).
 * Navigation TR → rues → numéros → lots sans panneau bloquant :
 *  · « Toute la rue » proposée EN PREMIÈRE position des rues (tranche entière) ;
 *  · la sélection d'une rue bascule au niveau « numéros » ;
 *  · bouton [Valider la sélection] : ferme le panneau en conservant la sélection ;
 *  · CLIC EXTÉRIEUR : ferme le panneau sans JAMAIS annuler la sélection ;
 *  · garages masqués par défaut (☐ Afficher les garages) — filtre d'affichage ;
 *  · recherche lot intra-tranche (ER / locataire) ; multi-adresses/multi-lots
 *    contraints à la même TR.
 */
import { useEffect, useRef } from "react";
import { Check, MapPin, Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  sansGarages,
  useRecherchePatrimoine,
} from "@/components/preparation-psp/useRecherchePatrimoine";

type Rec = ReturnType<typeof useRecherchePatrimoine>;

export default function PspAdressePanel({ rec }: { rec: Rec }) {
  const racineRef = useRef<HTMLDivElement>(null);
  const auNiveauRues = !rec.rue || rec.niveauAdresse === "rues";

  // Click-outside : ferme le panneau, conserve TOUJOURS la sélection.
  useEffect(() => {
    if (!rec.adressePanelOuvert) return undefined;
    const fermer = (e: MouseEvent) => {
      const el = racineRef.current;
      if (el && !el.contains(e.target as Node)) rec.setAdressePanelOuvert(false);
    };
    document.addEventListener("mousedown", fermer);
    return () => document.removeEventListener("mousedown", fermer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.adressePanelOuvert]);

  const sansGaragesLocaux = (lots: Rec["lotsChoisis"]) => sansGarages(lots, rec.afficherGarages);

  return (
    <div ref={racineRef} className="relative space-y-1">
      {/* Niveau RUES : recherche progressive (ou chip de la rue sélectionnée) */}
      {rec.rue && rec.niveauAdresse === "numeros" ? (
        <div className="flex items-center justify-between gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-1">
          <span className="flex items-center gap-1 text-[10px] font-bold">
            <MapPin className="size-3 text-primary" />
            {rec.rue}
          </span>
          <button
            onClick={rec.retourRues}
            className="text-[9px] font-bold text-muted-foreground hover:text-primary"
            title="Revenir à la liste des rues"
          >
            ← Rues
          </button>
        </div>
      ) : (
        <div className="relative">
          <Input
            value={rec.qRue}
            onChange={(e) => {
              rec.setQRue(e.target.value);
              rec.setAdressePanelOuvert(true);
            }}
            onFocus={() => rec.setAdressePanelOuvert(true)}
            placeholder="RUE…"
            className="h-8 pr-7 text-xs"
          />
          <button
            onClick={() => rec.setAdressePanelOuvert((o) => !o)}
            className="absolute right-1.5 top-2 text-muted-foreground hover:text-destructive"
            title="Ouvrir/fermer les suggestions (la sélection est conservée)"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Suggestions : niveau rues (avec « Toute la rue » en premier) */}
      {rec.adressePanelOuvert && auNiveauRues && rec.rues.length > 0 ? (
        <div className="absolute z-40 mt-1 max-h-40 w-72 overflow-auto rounded-lg border bg-popover p-1 shadow-lg">
          <button
            className="flex w-full items-center gap-2 rounded border-b border-dashed px-2 py-1 text-left text-xs font-bold text-primary hover:bg-accent"
            onClick={rec.choisirTouteLaRue}
          >
            <MapPin className="size-3" />
            Toute la rue (tranche entière)
          </button>
          {rec.rues.map((r) => (
            <button
              key={r.rue}
              className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-xs hover:bg-accent ${
                rec.rue === r.rue ? "bg-primary/10 font-bold" : ""
              }`}
              onClick={() => rec.choisirRue(r.rue)}
            >
              <span className="truncate">{r.rue}</span>
              <span className="text-muted-foreground">{r.nb_lots}</span>
            </button>
          ))}
        </div>
      ) : null}

      {/* Niveau NUMÉROS : adresses multi-sélection + lots de chaque adresse */}
      {rec.adressePanelOuvert && rec.rue && rec.niveauAdresse === "numeros" ? (
        <div className="mt-1 max-h-40 overflow-auto rounded-md border bg-card p-1">
          <div className="flex items-center justify-between gap-2 border-b border-dashed pb-1">
            <label className="flex items-center gap-1.5 rounded px-1 py-0.5 text-[10px] font-bold text-primary hover:bg-accent">
              <input
                type="checkbox"
                checked={rec.adressesChoisies.length === 0 && rec.lotsChoisis.length === 0}
                onChange={rec.touteLaRue}
              />
              Toute la rue
            </label>
            <label className="flex items-center gap-1.5 rounded px-1 py-0.5 text-[9px] text-muted-foreground hover:bg-accent">
              <input
                type="checkbox"
                checked={rec.afficherGarages}
                onChange={(e) => rec.setAfficherGarages(e.target.checked)}
              />
              Afficher les garages
            </label>
          </div>
          {rec.numeros.map((n) => {
            const lots = sansGaragesLocaux(rec.lotsDeAdresse.get(n) ?? []);
            return (
              <div key={n}>
                <label className="flex items-center gap-1.5 rounded px-1 py-0.5 text-[10px] hover:bg-accent">
                  <input
                    type="checkbox"
                    checked={rec.adressesChoisies.includes(n)}
                    onChange={() => void rec.basculerAdresse(n)}
                  />
                  <span className="font-mono font-bold">{n}</span>
                </label>
                {lots.length > 0 && rec.adressesChoisies.includes(n) ? (
                  <div className="ml-4 border-l border-dashed pl-2">
                    {lots.map((l) => (
                      <label
                        key={l.id}
                        className="flex items-center gap-1.5 rounded px-1 py-0.5 text-[9px] hover:bg-accent"
                      >
                        <input
                          type="checkbox"
                          checked={rec.lotsChoisis.some((x) => x.id === l.id)}
                          onChange={() => rec.basculerLot(l)}
                        />
                        <span className="font-mono font-bold">{l.code_patrimoine}</span>
                        <span className="truncate text-muted-foreground">
                          {l.locataire_nom ? `— ${l.locataire_nom}` : ""}
                        </span>
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
          {rec.numeros.length === 0 ? (
            <p className="px-1 py-0.5 text-[9px] text-muted-foreground">
              Aucun numéro détaillé — toute la rue.
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Valider la sélection (ferme le panneau, conserve la sélection) */}
      {rec.adressePanelOuvert && rec.rue && rec.niveauAdresse === "numeros" ? (
        <button
          type="button"
          className="flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-2 py-1 text-[10px] font-black uppercase tracking-wide text-primary-foreground hover:bg-primary/90"
          onClick={() => {
            rec.setAdressePanelOuvert(false);
            rec.setNiveauAdresse("rues");
          }}
        >
          <Check className="size-3" />
          Valider la sélection
        </button>
      ) : null}

      {/* Recherche lot intra-tranche (ER / locataire) */}
      <div className="relative">
        <Input
          value={rec.qLot}
          onChange={(e) => rec.setQLot(e.target.value)}
          placeholder="ER.123 · DUPONT (lot)"
          className="h-7 pr-7 text-[10px]"
        />
        <Search className="pointer-events-none absolute left-2 top-2 size-3 text-muted-foreground" />
        {sansGaragesLocaux(rec.sugLotsTranche).length > 0 ? (
          <div className="absolute z-40 mt-1 max-h-36 w-72 overflow-auto rounded-lg border bg-popover p-1 shadow-lg">
            {sansGaragesLocaux(rec.sugLotsTranche).map((l) => (
              <button
                key={l.id}
                className="flex w-full justify-between gap-2 rounded px-2 py-1 text-left text-[10px] hover:bg-accent"
                onClick={() => rec.choisirLotTranche(l)}
              >
                <span className="font-mono font-bold">{l.code_patrimoine}</span>
                <span className="truncate text-muted-foreground">
                  {l.locataire_nom ? `${l.locataire_nom} · ` : ""}
                  {l.adresse}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Lots retenus */}
      {rec.lotsChoisis.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1">
          {rec.lotsChoisis.map((l) => (
            <span
              key={l.id}
              className="inline-flex items-center gap-1 rounded border border-primary/40 bg-primary/5 px-1.5 py-0.5 font-mono text-[9px] font-bold"
            >
              {l.code_patrimoine}
              <button
                onClick={() => rec.retirerLot(l.id)}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="size-2.5" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
