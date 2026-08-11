import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Building2,
  ChevronRight,
  Filter,
  Home,
  Info as InfoIcon,
  Mail,
  MapPin,
  Phone,
  Search,
  User,
  Wrench,
  Calendar,
} from "lucide-react";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getAdresses,
  getOccupants,
  getTravaux,
  getVilles,
  type LotItem,
  type TravauxScope,
} from "@/lib/isis.functions";
import {
  adressesParTranche as adressesParTrancheLib,
  estGarage,
  normaliserRecherche,
  rechercherPatrimoine,
} from "@/lib/adresses";

const searchSchema = z.object({
  q: z.string().optional(),
  ville: z.string().optional(),
  tranche: z.string().optional(),
  rue: z.string().optional(),
  adresse: z.string().optional(),
});

export const Route = createFileRoute("/adresses")({
  validateSearch: searchSchema,
  component: AdressesPage,
});

function AdressesPage() {
  const { q, ville, tranche, rue, adresse } = Route.useSearch();
  const navigate = Route.useNavigate();
  const fetchAdresses = useServerFn(getAdresses);
  const fetchVilles = useServerFn(getVilles);

  const { data: villes, isLoading: isLoadingVilles } = useQuery({
    queryKey: ["villes"],
    queryFn: () => fetchVilles({}),
  });

  // Mode recherche : on charge TOUS les lots actifs une seule fois (clé constante), puis on
  // recherche en client avec normalisation (villes/adresses/locataires) — aucune requête par résultat.
  const searchMode = !!q?.trim();
  const { data, isLoading: isLoadingLots } = useQuery({
    queryKey: searchMode
      ? ["adresses", "toutes"]
      : ["adresses", q, ville, tranche, rue, adresse],
    queryFn: () =>
      searchMode
        ? fetchAdresses({ data: {} })
        : fetchAdresses({ data: { q, ville, tranche, rue, adresse } }),
  });

  type AdresseTree = Record<string, Record<string, Record<string, LotItem[]>>>;

  const [showGarages, setShowGarages] = useState(false);

  // Lots affichés : garages et boxes masqués par défaut (codes ER.G / types PAR/GAR/BOX/MOT).
  const visibleLots = useMemo(
    () => ((data as LotItem[]) ?? []).filter((lot) => showGarages || !estGarage(lot)),
    [data, showGarages],
  );

  const hierarchy = useMemo(() => {
    if (!visibleLots.length) return null;
    const lots = visibleLots;

    // Groupement hiérarchique
    const tree: AdresseTree = {};
    lots.forEach((lot) => {
      const v = lot.ville || "Ville inconnue";
      const t = lot.tranche_code || "Sans tranche";
      const r = lot.adresse || "Adresse inconnue";

      if (!tree[v]) tree[v] = {};
      if (!tree[v][t]) tree[v][t] = {};
      if (!tree[v][t][r]) tree[v][t][r] = [];
      tree[v][t][r].push(lot);
    });
    return tree;
  }, [visibleLots]);

  const [selectedLot, setSelectedLot] = useState<LotItem | null>(null);
  const [selectedLocataire, setSelectedLocataire] = useState<LotItem | null>(null);
  const [travauxScope, setTravauxScope] = useState<TravauxScope | null>(null);

  // Lignes de chaque niveau hiérarchique avec leurs compteurs.
  const villeRows = useMemo(() => {
    const stats = new Map<string, { tranches: number; lots: number }>();
    if (hierarchy) {
      for (const [v, tranches] of Object.entries(hierarchy)) {
        let lots = 0;
        for (const rues of Object.values(tranches)) {
          for (const arr of Object.values(rues)) lots += arr.length;
        }
        stats.set(v, { tranches: Object.keys(tranches).length, lots });
      }
    }
    return (villes ?? []).map((v) => ({
      ville: v,
      tranches: stats.get(v)?.tranches ?? 0,
      lots: stats.get(v)?.lots ?? 0,
    }));
  }, [villes, hierarchy]);

  // Adresses de la ville sélectionnée, regroupées par tranche (sections cliquables).
  const groupesAdresses = useMemo(
    () => (ville ? adressesParTrancheLib(hierarchy?.[ville] || {}) : []),
    [hierarchy, ville],
  );

  // Recherche hiérarchique multi-catégories (VILLES → ADRESSES → LOCATAIRES).
  const resultatsRecherche = useMemo(
    () => (searchMode ? rechercherPatrimoine(q ?? "", visibleLots, villeRows) : null),
    [searchMode, q, visibleLots, villeRows],
  );

  const rueRows = useMemo(() => {
    if (!ville || !tranche) return [] as { adresse: string; lots: number }[];
    return Object.entries(hierarchy?.[ville]?.[tranche] || {}).map(([adresse, lots]) => ({
      adresse,
      lots: lots.length,
    }));
  }, [hierarchy, ville, tranche]);

  const handleSearch = (val: string) => {
    // La recherche est un mode global : on repart d'un état vierge (q seul) et on revient
    // au comportement normal de /adresses quand le champ est vidé.
    navigate({ search: { q: val || undefined } });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="icon">
              <Link to="/">
                <Home className="size-5" />
              </Link>
            </Button>
            <Building2 className="size-5 text-primary" />
            <h1 className="text-lg font-semibold leading-tight">Patrimoine</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex cursor-pointer select-none items-center gap-2 text-xs font-medium text-muted-foreground">
              <Checkbox
                checked={showGarages}
                onCheckedChange={(checked) => setShowGarages(checked === true)}
              />
              Afficher les garages
            </label>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Rechercher..."
                className="pl-9"
                defaultValue={q}
                onKeyDown={(e) => e.key === "Enter" && handleSearch(e.currentTarget.value)}
              />
            </div>
            <Button variant="outline" size="icon">
              <Filter className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl flex-1 px-4 py-6 sm:px-6">
        <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Link to="/adresses" className="hover:text-primary">
            Patrimoine
          </Link>
          {ville && (
            <>
              <ChevronRight className="size-3" />{" "}
              <button
                onClick={() => navigate({ search: { ville } })}
                className="hover:text-primary font-medium text-foreground"
              >
                {ville}
              </button>
            </>
          )}
          {tranche && (
            <>
              <ChevronRight className="size-3" />{" "}
              <button
                onClick={() => navigate({ search: { ville, tranche } })}
                className="hover:text-primary font-medium text-foreground"
              >
                {tranche}
              </button>
            </>
          )}
          {rue && (
            <>
              <ChevronRight className="size-3" />{" "}
              <span className="font-medium text-foreground">{rue}</span>
            </>
          )}
          {q && (
            <>
              <ChevronRight className="size-3" />{" "}
              <span className="font-medium text-foreground">Recherche : {q}</span>
            </>
          )}
        </div>

        {isLoadingLots ? (
          <div className="flex h-64 items-center justify-center">
            <p className="text-muted-foreground">Chargement du patrimoine...</p>
          </div>
        ) : !data || data.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
            <InfoIcon className="size-8 text-muted-foreground" />
            <h2 className="text-lg font-medium">Aucun résultat</h2>
            <p className="text-sm text-muted-foreground">
              Essayez de modifier vos filtres ou votre recherche.
            </p>
            <Button
              variant="outline"
              className="whitespace-nowrap"
              onClick={() => handleSearch("")}
            >
              Réinitialiser la recherche
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Mode Recherche — résultats hiérarchiques groupés */}
            {searchMode && resultatsRecherche && (
              <div className="space-y-6">
                <header className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 text-sm font-semibold">
                    <Search className="size-4 text-primary" /> Résultats pour « {q} »
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {resultatsRecherche.villes.length +
                      resultatsRecherche.adresses.length +
                      resultatsRecherche.locataires.length}{" "}
                    résultat(s)
                  </span>
                </header>

                {/* VILLES */}
                {resultatsRecherche.villes.length > 0 && (
                  <section className="overflow-hidden rounded-lg border bg-background shadow-sm">
                    <header className="border-b bg-muted/50 px-4 py-2.5">
                      <h3 className="text-sm font-semibold">Villes</h3>
                    </header>
                    <div className="divide-y">
                      {resultatsRecherche.villes.map((row) => (
                        <button
                          key={row.ville}
                          onClick={() => navigate({ search: { ville: row.ville } })}
                          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                        >
                          <span className="flex items-center gap-2 font-medium text-primary">
                            <MapPin className="size-4 shrink-0" /> {row.ville}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {row.tranches} tranche{row.tranches > 1 ? "s" : ""} · {row.lots} lots
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {/* ADRESSES */}
                {resultatsRecherche.adresses.length > 0 && (
                  <section className="overflow-hidden rounded-lg border bg-background shadow-sm">
                    <header className="border-b bg-muted/50 px-4 py-2.5">
                      <h3 className="text-sm font-semibold">Adresses</h3>
                    </header>
                    <div className="divide-y">
                      {resultatsRecherche.adresses.map((row) => (
                        <button
                          key={`${row.ville}|${row.tranche}|${row.adresse}`}
                          onClick={() =>
                            navigate({
                              search: { ville: row.ville, tranche: row.tranche, rue: row.adresse },
                            })
                          }
                          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                        >
                          <span className="flex min-w-0 flex-col">
                            <span className="flex items-center gap-2 font-medium text-primary">
                              <MapPin className="size-4 shrink-0" /> {row.adresse}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {row.ville} · Tranche {row.tranche} · {row.lots} lots
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {/* LOCATAIRES */}
                {resultatsRecherche.locataires.length > 0 && (
                  <section className="overflow-hidden rounded-lg border bg-background shadow-sm">
                    <header className="border-b bg-muted/50 px-4 py-2.5">
                      <h3 className="text-sm font-semibold">Locataires</h3>
                    </header>
                    <div className="divide-y">
                      {resultatsRecherche.locataires.map((row) => (
                        <button
                          key={`${row.nom}|${row.ville}|${row.tranche}|${row.adresse}`}
                          onClick={() =>
                            navigate({
                              search: { ville: row.ville, tranche: row.tranche, rue: row.adresse },
                            })
                          }
                          className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                        >
                          <User className="size-4 shrink-0 text-primary" />
                          <span className="flex min-w-0 flex-col">
                            <span className="font-medium">{row.nom}</span>
                            <span className="text-xs text-muted-foreground">
                              {row.adresse} · {row.ville} · Tranche {row.tranche}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {/* Aucun résultat */}
                {resultatsRecherche.villes.length +
                  resultatsRecherche.adresses.length +
                  resultatsRecherche.locataires.length ===
                  0 && (
                  <div className="flex h-40 flex-col items-center justify-center gap-2 text-center">
                    <InfoIcon className="size-8 text-muted-foreground" />
                    <h2 className="text-lg font-medium">Aucun résultat</h2>
                    <p className="text-sm text-muted-foreground">
                      Aucune ville, adresse ou locataire ne correspond à « {q} ».
                    </p>
                    <Button
                      variant="outline"
                      className="whitespace-nowrap"
                      onClick={() => handleSearch("")}
                    >
                      Réinitialiser la recherche
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Niveau Ville */}
            {!ville && !q && (
              <section className="overflow-hidden rounded-lg border bg-background shadow-sm">
                <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/50 px-4 py-2.5">
                  <h2 className="flex items-center gap-2 text-sm font-semibold">
                    <MapPin className="size-4 text-primary" /> Villes
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {isLoadingVilles
                      ? "Chargement…"
                      : `${villeRows.length} ville${villeRows.length > 1 ? "s" : ""} · ${
                          villeRows.reduce((s, r) => s + r.lots, 0)
                        } lots`}
                  </span>
                </header>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead className="border-b bg-muted/50 font-medium text-muted-foreground">
                      <tr>
                        <th className="w-full px-4 py-3">Ville</th>
                        <th className="whitespace-nowrap px-4 py-3">Tranches</th>
                        <th className="whitespace-nowrap px-4 py-3">Lots</th>
                        <th className="w-16 whitespace-nowrap px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {villeRows.map((row) => (
                        <tr key={row.ville} className="hover:bg-muted/50 transition-colors">
                          <td className="px-4 py-3 font-medium">
                            <button
                              onClick={() => navigate({ search: { ville: row.ville } })}
                              className="flex w-full items-center gap-2 text-left text-primary hover:underline"
                            >
                              <MapPin className="size-4 shrink-0" /> {row.ville}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{row.tranches}</td>
                          <td className="px-4 py-3 text-muted-foreground">{row.lots}</td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Voir les travaux de la ville"
                              onClick={() =>
                                setTravauxScope({
                                  niveau: "ville",
                                  label: `Ville ${row.ville}`,
                                  ville: row.ville,
                                })
                              }
                            >
                              <Wrench className="size-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Niveau Ville → Adresses regroupées par tranche */}
            {ville && !tranche && !q && (
              <div className="space-y-6">
                <header className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 text-sm font-semibold">
                    <MapPin className="size-4 text-primary" /> Adresses · {ville}
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {groupesAdresses.length} tranche{groupesAdresses.length > 1 ? "s" : ""} ·{" "}
                    {groupesAdresses.reduce((s, t) => s + t.nbAdresses, 0)} adresses ·{" "}
                    {groupesAdresses.reduce((s, t) => s + t.nbLots, 0)} lots
                  </span>
                </header>
                {groupesAdresses.map((t) => (
                  <section
                    key={t.code}
                    className="overflow-hidden rounded-lg border bg-background shadow-sm"
                  >
                    <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/50 px-4 py-2.5">
                      <h3 className="flex items-center gap-2 text-sm font-semibold">
                        <Building2 className="size-4 text-primary" /> Tranche {t.code}
                      </h3>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">
                          {t.nbLots} lots · {t.nbAdresses} adresses
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Voir les travaux de la tranche"
                          onClick={() =>
                            setTravauxScope({
                              niveau: "tranche",
                              label: `Tranche ${t.code}`,
                              trancheCode: t.code,
                            })
                          }
                        >
                          <Wrench className="size-4" />
                        </Button>
                      </div>
                    </header>
                    <div className="divide-y">
                      {t.adresses.map((a) => (
                        <button
                          key={a.adresse}
                          onClick={() =>
                            navigate({ search: { ville, tranche: t.code, rue: a.adresse } })
                          }
                          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                        >
                          <span className="flex items-center gap-2 font-medium text-primary">
                            <MapPin className="size-4 shrink-0" /> {a.adresse}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {a.lots} lot{a.lots > 1 ? "s" : ""}
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}

            {/* Niveau Adresse */}
            {ville && tranche && !rue && !q && (
              <section className="overflow-hidden rounded-lg border bg-background shadow-sm">
                <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/50 px-4 py-2.5">
                  <h2 className="flex items-center gap-2 text-sm font-semibold">
                    <MapPin className="size-4 text-primary" /> Adresses · {ville}
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {rueRows.length} adresse{rueRows.length > 1 ? "s" : ""} ·{" "}
                    {rueRows.reduce((s, r) => s + r.lots, 0)} lots
                  </span>
                </header>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead className="border-b bg-muted/50 font-medium text-muted-foreground">
                      <tr>
                        <th className="w-full px-4 py-3">Adresse</th>
                        <th className="whitespace-nowrap px-4 py-3">Lots</th>
                        <th className="w-16 whitespace-nowrap px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {rueRows.map((row) => (
                        <tr key={row.adresse} className="hover:bg-muted/50 transition-colors">
                          <td className="px-4 py-3 font-medium">
                            <button
                              onClick={() =>
                                navigate({ search: { ville, tranche, rue: row.adresse } })
                              }
                              className="flex w-full items-center gap-2 text-left text-primary hover:underline"
                            >
                              <MapPin className="size-4 shrink-0" /> {row.adresse}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{row.lots}</td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Voir les travaux de cette adresse"
                              onClick={() =>
                                setTravauxScope({
                                  niveau: "adresse",
                                  label: `${row.adresse} · ${ville}`,
                                  adresse: row.adresse,
                                })
                              }
                            >
                              <Wrench className="size-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Niveau Lots */}
            {(rue || adresse) && (
              <section className="overflow-hidden rounded-lg border bg-background shadow-sm">
                <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/50 px-4 py-2.5">
                  <h2 className="flex items-center gap-2 text-sm font-semibold">
                    <Building2 className="size-4 text-primary" /> Lots
                    {rue ? ` · ${rue}` : q ? ` · recherche « ${q} »` : ""}
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {visibleLots.length} lot{visibleLots.length > 1 ? "s" : ""}
                  </span>
                </header>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead className="border-b bg-muted/50 font-medium text-muted-foreground">
                      <tr>
                        <th className="w-full px-4 py-3">Lot</th>
                        <th className="whitespace-nowrap px-4 py-3">Bâtiment / Porte</th>
                        <th className="whitespace-nowrap px-4 py-3">Locataire</th>
                        <th className="w-16 whitespace-nowrap px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {visibleLots.map((lot) => (
                        <tr key={lot.code_patrimoine} className="hover:bg-muted/50 transition-colors">
                          <td className="px-4 py-3 font-medium">
                            <button
                              onClick={() => setSelectedLot(lot)}
                              className="flex w-full items-center gap-2 text-left text-primary hover:underline"
                            >
                              {lot.code_patrimoine}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {lot.batiment || "—"} {lot.porte ? ` / ${lot.porte}` : ""}
                          </td>
                          <td className="px-4 py-3">
                            {lot.locataire_nom ? (
                              <button
                                onClick={() => setSelectedLocataire(lot)}
                                className="text-muted-foreground hover:text-primary hover:underline"
                              >
                                {lot.locataire_nom}
                              </button>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Voir les travaux du lot"
                              onClick={() =>
                                setTravauxScope({
                                  niveau: "lot",
                                  label: `Lot ${lot.code_patrimoine}`,
                                  lotCode: lot.code_patrimoine,
                                  trancheCode: lot.tranche_code,
                                })
                              }
                            >
                              <Wrench className="size-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      <FicheLogement lot={selectedLot} onClose={() => setSelectedLot(null)} />
      <FicheLocataire lot={selectedLocataire} onClose={() => setSelectedLocataire(null)} />
      <TravauxDialog scope={travauxScope} onClose={() => setTravauxScope(null)} />
    </div>
  );
}

function typeLotLabel(type: string | null) {
  const labels: Record<string, string> = {
    LOG: "Logement",
    PAR: "Parking",
    BOX: "Box",
    GAR: "Garage",
    COM: "Commerce",
    BUR: "Bureau",
  };
  return labels[type ?? ""] ?? type ?? "—";
}

function FicheLogement({ lot, onClose }: { lot: LotItem | null; onClose: () => void }) {
  return (
    <Dialog open={!!lot} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        {lot && (
          <>
            <div className="p-6 pb-0">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Building2 className="size-4 text-primary" /> Fiche logement
                </DialogTitle>
                <DialogDescription>
                  Lot {lot.code_patrimoine} · Tranche {lot.tranche_code}
                </DialogDescription>
              </DialogHeader>

              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <Info label="Adresse" value={lot.adresse} />
                <Info label="Ville" value={`${lot.code_postal ?? ""} ${lot.ville ?? ""}`.trim()} />
                <Info label="Bâtiment" value={lot.batiment} />
                <Info label="Étage / Porte" value={`${lot.etage || "—"} / ${lot.porte || "—"}`} />
                <Info label="Type de lot" value={typeLotLabel(lot.type_lot)} />
                <Info
                  label="Surface"
                  value={lot.surface_utile ? `${lot.surface_utile} m²` : null}
                />
                <Info label="DPE" value={lot.dpe} />
              </dl>
            </div>

            <div className="flex-1 overflow-hidden mt-6">
              <Tabs defaultValue="lot" className="h-full flex flex-col">
                <div className="px-6 border-b">
                  <TabsList className="bg-transparent h-auto p-0 gap-6">
                    <TabsTrigger
                      value="lot"
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 pb-2 text-sm font-medium"
                    >
                      Travaux sur ce lot
                    </TabsTrigger>
                    <TabsTrigger
                      value="tranche"
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 pb-2 text-sm font-medium"
                    >
                      Travaux sur cette tranche
                    </TabsTrigger>
                  </TabsList>
                </div>
                <ScrollArea className="h-[400px]">
                  <div className="p-6">
                    <TabsContent value="lot" className="m-0">
                      <TravauxList
                        scope={{
                          niveau: "lot",
                          label: `Lot ${lot.code_patrimoine}`,
                          lotCode: lot.code_patrimoine,
                          trancheCode: lot.tranche_code,
                        }}
                      />
                    </TabsContent>
                    <TabsContent value="tranche" className="m-0">
                      <TravauxList
                        scope={{
                          niveau: "tranche",
                          label: `Tranche ${lot.tranche_code}`,
                          trancheCode: lot.tranche_code,
                        }}
                      />
                    </TabsContent>
                  </div>
                  <ScrollBar />
                </ScrollArea>
              </Tabs>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function FicheLocataire({ lot, onClose }: { lot: LotItem | null; onClose: () => void }) {
  const fetchOccupants = useServerFn(getOccupants);
  const { data: occupants } = useQuery({
    queryKey: ["occupants", lot?.code_patrimoine],
    queryFn: () => fetchOccupants({ data: { lotCode: lot!.code_patrimoine } }),
    enabled: !!lot,
  });

  return (
    <Dialog open={!!lot} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        {lot && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <User className="size-4 text-primary" /> {lot.locataire_nom}
              </DialogTitle>
              <DialogDescription>
                Lot {lot.code_patrimoine} · Tranche {lot.tranche_code}
              </DialogDescription>
            </DialogHeader>

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Info
                label="Téléphone"
                value={lot.locataire_telephone}
                icon={<Phone className="size-3.5" />}
              />
              <Info
                label="E-mail"
                value={lot.locataire_email}
                icon={<Mail className="size-3.5" />}
              />
              <Info label="Date d'entrée" value={formatDate(lot.date_entree)} />
              <Info label="Type de lot" value={typeLotLabel(lot.type_lot)} />
              <Info label="Adresse" value={`${lot.adresse ?? "—"}`} />
              <Info label="Ville" value={`${lot.code_postal ?? ""} ${lot.ville ?? ""}`.trim()} />
              <Info label="Bâtiment" value={lot.batiment} />
              <Info label="Étage / Porte" value={`${lot.etage || "—"} / ${lot.porte || "—"}`} />
              <Info label="Surface" value={lot.surface_utile ? `${lot.surface_utile} m²` : null} />
              <Info label="DPE" value={lot.dpe} />
            </dl>

            <div>
              <h3 className="mb-2 text-sm font-semibold">Occupants enregistrés</h3>
              {!occupants || occupants.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun occupant enregistré.</p>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {occupants.map((o, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 p-2 text-sm">
                      <span className="truncate">
                        {[o.prenom, o.nom].filter(Boolean).join(" ") || "—"}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        Entré le {formatDate(o.date_entree)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

type TravailRow = {
  id: string;
  niveau: string;
  tranche_code: string | null;
  batiment: string | null;
  lot_code: string | null;
  libelle: string;
  statut: string;
  date_travaux: string | null;
  annee_exercice?: number | null;
  cout: number;
  note: string | null;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  etage: string | null;
  porte: string | null;
  is_commande?: boolean;
};

function TravauxDialog({ scope, onClose }: { scope: TravauxScope | null; onClose: () => void }) {
  return (
    <Dialog open={!!scope} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        {scope && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wrench className="size-4 text-primary" /> Travaux
              </DialogTitle>
              <DialogDescription>{scope.label}</DialogDescription>
            </DialogHeader>
            <div className="mt-4">
              <TravauxList scope={scope} />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TravauxList({ scope }: { scope: TravauxScope }) {
  const fetchTravaux = useServerFn(getTravaux);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["travaux", scope],
    queryFn: () =>
      fetchTravaux({
        data:
          scope.niveau === "ville"
            ? { niveau: "ville", ville: scope.ville }
            : scope.niveau === "tranche"
              ? { niveau: "tranche", trancheCode: scope.trancheCode }
              : scope.niveau === "adresse"
                ? { niveau: "adresse", adresse: scope.adresse }
                : {
                    niveau: "lot",
                    lotCode: scope.lotCode,
                    trancheCode: scope.trancheCode,
                  },
      }),
  });

  const groupedTravaux = useMemo(() => {
    if (!data) return null;
    const groups: Record<string, TravailRow[]> = {};
    (data as TravailRow[]).forEach((t) => {
      // L'année d'exercice (annee_exercice) est la référence métier : prioritaire sur la date
      // de chantier (date_travaux). Une commande 2024 sans date reste groupée en 2024.
      const year = t.annee_exercice
        ? String(t.annee_exercice)
        : t.date_travaux
          ? new Date(t.date_travaux).getFullYear().toString()
          : "Année non précisée";
      if (!groups[year]) groups[year] = [];
      groups[year].push(t);
    });
    return Object.entries(groups).sort((a, b) => {
      if (a[0] === "Année non précisée") return 1;
      if (b[0] === "Année non précisée") return -1;
      return b[0].localeCompare(a[0]);
    });
  }, [data]);

  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement des travaux…</p>;
  if (isError)
    return <p className="text-sm text-destructive">Impossible de charger les travaux.</p>;
  if (!data?.length)
    return <p className="text-sm text-muted-foreground">Aucun travail enregistré.</p>;

  return (
    <div className="space-y-6">
      {groupedTravaux?.map(([year, travaux]) => {
        const total = travaux.reduce((sum, t) => sum + (t.cout || 0), 0);
        return (
          <div key={year} className="space-y-3">
            <h4 className="flex items-center gap-2 text-sm font-bold text-primary">
              <Calendar className="size-4" /> {year}
              <span className="text-xs font-medium text-muted-foreground">
                · {travaux.length} travail{travaux.length > 1 ? "x" : ""}
              </span>
              {total > 0 && (
                <span className="ml-auto text-xs font-semibold text-muted-foreground">
                  {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(
                    total,
                  )}
                </span>
              )}
            </h4>
            <ul className="divide-y rounded-lg border bg-card">
            {travaux.map((travail) => (
              <li key={travail.id} className="space-y-2 p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium">{travail.libelle}</p>
                  <TravauxStatus statut={travail.statut} />
                </div>
                <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                  <span>
                    {travail.adresse || "Adresse non précisée"}
                    {travail.etage || travail.porte
                      ? ` · ${travail.etage || "—"} / ${travail.porte || "—"}`
                      : ""}
                  </span>
                  <span>
                    {travail.tranche_code
                      ? `Tranche ${travail.tranche_code}`
                      : "Tranche non précisée"}
                    {travail.batiment ? ` · Bât. ${travail.batiment}` : ""}
                  </span>
                  <span>
                    {travail.date_travaux ? formatDate(travail.date_travaux) : "Date non précisée"}
                  </span>
                  <span className="font-semibold text-foreground">
                    {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(
                      travail.cout || 0,
                    )}
                  </span>
                </div>
                {travail.note && (
                  <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded italic border-l-2 border-primary/30">
                    {travail.note}
                  </p>
                )}
              </li>
            ))}
          </ul>
          </div>
        );
      })}
    </div>
  );
}

function TravauxStatus({ statut }: { statut: string }) {
  const labels: Record<string, string> = {
    realise: "Réalisé",
    planifie: "Planifié",
    a_prevoir: "À prévoir",
  };
  return <Badge variant="outline">{labels[statut] ?? statut}</Badge>;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("fr-FR");
}

function Info({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | null | undefined;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
        {icon} {label}
      </dt>
      <dd className="mt-0.5 break-words font-medium">{value || "—"}</dd>
    </div>
  );
}
