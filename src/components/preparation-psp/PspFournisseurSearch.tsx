/**
 * V7.8 §6 — Recherche d'ENTREPRISE fournisseur pour un devis : liste déroulante
 * avec recherche progressive par NOM / code / identifiant / alias.
 * Réutilise `rechercherFournisseursDevis` (table fournisseurs existante) —
 * aucun nouveau référentiel fournisseur.
 */
import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";

import { Input } from "@/components/ui/input";
import { rechercherFournisseursDevis } from "@/lib/psp.prep.supabase.functions";

export type FournisseurSelection = { id?: string | null; nom: string };

export default function PspFournisseurSearch({
  value,
  onSelect,
  placeholder = "Rechercher une entreprise…",
}: {
  /** Texte courant (nom sélectionné ou saisie). */
  value: string;
  /** Appelé à la sélection (fournisseur) ou au vidage (null). */
  onSelect: (f: FournisseurSelection | null) => void;
  placeholder?: string;
}) {
  const fournisseursFn = useServerFn(rechercherFournisseursDevis);
  const [q, setQ] = useState(value);
  const [sug, setSug] = useState<
    Array<{ id: string; nom: string; ville: string | null; codes: string[] }>
  >([]);

  // Synchronise le texte si le parent change la sélection.
  useEffect(() => setQ(value), [value]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setSug([]);
      return;
    }
    const t = setTimeout(() => {
      void fournisseursFn({ data: { q: q.trim() } }).then((r) => {
        setSug(
          (r ?? []) as Array<{ id: string; nom: string; ville: string | null; codes: string[] }>,
        );
      });
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="relative">
      <Input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          // Toute modification invalide la sélection précédente.
          onSelect(null);
        }}
        placeholder={placeholder}
        className="h-7 text-xs pr-7"
      />
      <Search className="pointer-events-none absolute right-2 top-2 size-3 text-muted-foreground" />
      {sug.length > 0 ? (
        <div className="absolute z-40 mt-1 max-h-36 w-full overflow-auto rounded-lg border bg-popover p-1 shadow-lg">
          {sug.map((f) => (
            <button
              key={f.id}
              type="button"
              className="flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-[10px] hover:bg-accent"
              onClick={() => {
                onSelect({ id: f.id, nom: f.nom });
                setQ(f.nom);
                setSug([]);
              }}
            >
              <span className="truncate font-medium">{f.nom}</span>
              <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
                {f.codes[0] ? <span className="font-mono">#{f.codes[0]}</span> : null}
                {f.ville ? <span>{f.ville}</span> : null}
              </span>
            </button>
          ))}
        </div>
      ) : null}
      {q && sug.length === 0 ? (
        <button
          type="button"
          className="absolute right-5 top-2 text-muted-foreground hover:text-destructive"
          title="Effacer la recherche"
          onClick={() => {
            setQ("");
            onSelect(null);
          }}
        >
          <X className="size-3" />
        </button>
      ) : null}
    </div>
  );
}
