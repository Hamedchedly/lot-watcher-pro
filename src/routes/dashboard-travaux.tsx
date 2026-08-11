import { useMemo, useState, useEffect, lazy, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link, createFileRoute } from "@tanstack/react-router";
import * as SliderPrimitive from "@radix-ui/react-slider";
import {
  ETATS_METIER,
  buildDataVilles,
  etatMetier,
  exerciceCourant,
  matchVille,
  repartitionCommandesParSecteur,
  secteurDe,
  sliderYearDomain,
  visibleArchivage,
} from "@/lib/travaux";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
  LabelList,
} from "recharts";
import {
  AlertTriangle,
  ArrowDownUp,
  FilterX,
  LayoutDashboard,
  ListFilter,
  RotateCcw,
  Search,
  Upload,
  Wrench,
  MapPin,
  History,
  ChevronRight,
  Info,
  Building2,
  Calendar,
  FileText,
  User,
  Euro,
  CheckCircle2,
  Edit3,
  Save,
  X,
  AlertCircle,
  Map as MapIcon,
  Filter,
  ArrowUp,
  ArrowDown,
  Layers,
  SlidersHorizontal,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import {
  getTravauxDashboard,
  getCommandeHistorique,
  updateCommandeTravaux,
  resolveHistoriqueTravaux,
  type CommandeTravaux,
  type HistoriqueTravaux,
  type TravauxDashboardData,
  type ImportTravaux,
} from "@/lib/travaux.dashboard.functions";
import { getVillesGeo, type VilleGeo } from "@/lib/geo.functions";

export const Route = createFileRoute("/dashboard-travaux")({
  head: () => ({
    meta: [
      { title: "Dashboard suivi travaux" },
      {
        name: "description",
        content: "Pilotage des commandes de travaux par programmation, secteur et tranche.",
      },
    ],
  }),
  component: DashboardTravauxPage,
});

type Commande = CommandeTravaux;
type ClassementRow = {
  label: string;
  value: number;
  ville?: string;
  tranche?: string;
};
const SECTEURS = ["GT", "GE", "CP"] as const;
const SECTOR_COLORS = { GT: "#2563eb", GE: "#0f766e", CP: "#c2410c" };
const PAGE_SIZE = 20;

const money = (value: unknown) =>
  typeof value === "number"
    ? new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      }).format(value)
    : "—";
const text = (value: unknown) => (value == null ? "" : String(value));

const cityOf = (address: unknown) => {
  const value = text(address).trim();
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.at(-1) || "Ville non renseignée";
};

/** Slider d'années (double curseur Radix) : remplace les <input type="range"> natifs. */
function YearRangeSlider({
  min,
  max,
  value,
  onChange,
}: {
  min: number;
  max: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
}) {
  return (
    <SliderPrimitive.Root
      min={min}
      max={max}
      step={1}
      value={value}
      onValueChange={(v) => onChange([v[0] as number, v[1] as number])}
      className="relative flex w-full touch-none select-none items-center"
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-slate-200">
        <SliderPrimitive.Range className="absolute h-full bg-blue-600" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block h-4 w-4 rounded-full border-2 border-blue-600 bg-white shadow transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50" />
      <SliderPrimitive.Thumb className="block h-4 w-4 rounded-full border-2 border-blue-600 bg-white shadow transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50" />
    </SliderPrimitive.Root>
  );
}

/** Normalisation et matching de villes + secteur dérivé : helpers importés de "@/lib/travaux"
 * (secteurDe, matchVille, repartitionCommandesParSecteur, buildDataVilles). */

const yearOf = (row: Commande) => {
  if (row.annee_exercice) return String(row.annee_exercice);
  const date = row.date_demarrage || row.date_fin_travaux || row.date_communication;
  return date ? date.slice(0, 4) : "Sans année";
};

function Kpi({
  label,
  value,
  detail,
  trend,
}: {
  label: string;
  value: string;
  detail?: string;
  trend?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm hover:shadow-md transition-shadow">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <p className="text-2xl font-black text-slate-900">{value}</p>
        {trend && (
          <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase tracking-tighter">
            {trend}
          </span>
        )}
      </div>
      {detail && <p className="mt-1 text-[10px] font-bold text-slate-400">{detail}</p>}
    </div>
  );
}

function MultiSelect({
  label,
  options,
  selected,
  onChange,
  icon: Icon,
}: {
  label: string;
  options: { label: string; value: string; sub?: string }[];
  selected: string[];
  onChange: (vals: string[]) => void;
  icon?: LucideIcon;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 w-full justify-between text-[10px] font-black uppercase border-slate-200 rounded-xl px-3"
        >
          <div className="flex items-center gap-2 overflow-hidden">
            {Icon && <Icon className="size-3.5 text-slate-400 shrink-0" />}
            <span className="truncate">
              {selected.length === 0 ? `Tous ${label}` : `${selected.length} ${label}`}
            </span>
          </div>
          <ChevronRight className="size-3 text-slate-400 rotate-90 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0 rounded-2xl border-slate-200 shadow-2xl" align="start">
        <div className="p-3 border-b bg-slate-50/50 flex items-center justify-between">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
            {label}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange([])}
            className="text-[9px] font-black text-blue-600 h-6 px-2"
          >
            TOUT DÉCOCHER
          </Button>
        </div>
        <div className="max-h-64 overflow-y-auto p-2 custom-scrollbar space-y-1">
          {options.map((opt) => (
            <label
              key={opt.value}
              className="flex items-start gap-3 p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors group"
            >
              <Checkbox
                checked={selected.includes(opt.value)}
                onCheckedChange={(v) =>
                  onChange(v ? [...selected, opt.value] : selected.filter((x) => x !== opt.value))
                }
                className="mt-0.5"
              />
              <div className="flex flex-col">
                <span
                  className={`text-[11px] font-black uppercase tracking-tight ${selected.includes(opt.value) ? "text-blue-600" : "text-slate-700"}`}
                >
                  {opt.label}
                </span>
                {opt.sub && (
                  <span className="text-[9px] font-bold text-slate-400 uppercase leading-none mt-0.5">
                    {opt.sub}
                  </span>
                )}
              </div>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

const DashboardMap = lazy(() => import("@/components/DashboardMap"));

function ClientOnlyMap({
  dataVilles,
  money,
  missing,
}: {
  dataVilles: { ville: string; lat: number; lng: number; value: number }[];
  money: (v: number) => string;
  missing: number;
}) {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);
  if (!isClient)
    return (
      <div className="h-full w-full bg-slate-50 flex items-center justify-center text-[10px] font-black uppercase text-slate-300">
        Chargement carte...
      </div>
    );

  return (
    <Suspense
      fallback={
        <div className="h-full w-full bg-slate-50 flex items-center justify-center text-[10px] font-black uppercase text-slate-300">
          Chargement carte...
        </div>
      }
    >
      <DashboardMap dataVilles={dataVilles} money={money} missing={missing} />
    </Suspense>
  );
}

function DashboardTravauxPage() {
  const queryClient = useQueryClient();
  const fetchDashboard = useServerFn(getTravauxDashboard);
  const updateCommande = useServerFn(updateCommandeTravaux);
  const resolveHistory = useServerFn(resolveHistoriqueTravaux);

  const { data, isLoading, isError, error } = useQuery<TravauxDashboardData>({
    queryKey: ["travaux-dashboard"],
    queryFn: () => fetchDashboard(),
  });

  const fetchVillesGeo = useServerFn(getVillesGeo);
  const { data: villesGeo } = useQuery<VilleGeo[]>({
    queryKey: ["villes-geo"],
    queryFn: () => fetchVillesGeo(),
    staleTime: 1000 * 60 * 30,
  });

  const allCommandes = data?.commandes ?? [];
  const historique = data?.historique ?? [];
  const recentImports = data?.imports ?? [];
  const tranchesDetails = data?.tranchesDetails ?? [];

  // Exercice courant (jamais codé en dur) — utilisé pour l'état dérivé « Pas réalisé ».
  const exercice = exerciceCourant();

  // États Filtres
  const [yearRange, setYearRange] = useState<[number, number]>([2020, exerciceCourant()]);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [progFilter, setProgFilter] = useState({ prog: true, hors: true });
  const [selectedSectors, setSelectedSectors] = useState<string[]>([...SECTEURS]);
  const [selectedTranches, setSelectedTranches] = useState<string[]>([]);
  const [selectedVilles, setSelectedVilles] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedEtats, setSelectedEtats] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showAllTranches, setShowAllTranches] = useState(false);
  const [mapMode, setMapMode] = useState<"map" | "classement">("map");
  const [rankingMode, setRankingMode] = useState<"ville" | "tranche" | "adresse">("ville");

  // États Filtres En-tête Tableau
  const [tableFilters, setTableFilters] = useState<
    Record<string, { min?: number; max?: number; selected?: string[]; search?: string }>
  >({});
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>({
    key: "engage",
    direction: "desc",
  });

  // États Modales
  const [drilldownSector, setDrilldownSector] = useState<string | null>(null);
  const [selectedModif, setSelectedModif] = useState<HistoriqueTravaux | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<Commande | null>(null);
  const [historyFor, setHistoryFor] = useState<Commande | null>(null);
  const [selectedImportErrors, setSelectedImportErrors] = useState<ImportTravaux | null>(null);
  const [versionChoice, setVersionChoice] = useState<"A" | "B">("B");

  // État Édition
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Commande>>({});

  const mutation = useMutation({
    mutationFn: (variables: { id: string; data: Partial<Commande> }) =>
      updateCommande({ data: variables }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["travaux-dashboard"] });
      setIsEditing(false);
      setSelectedDetail((prev) => (prev ? ({ ...prev, ...editForm } as Commande) : null));
    },
  });

  const resolveMutation = useMutation({
    mutationFn: (variables: {
      id: string;
      keepVersion: "A" | "B";
      commandeId: string;
      data: Record<string, unknown> | null;
    }) => resolveHistory({ data: variables }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["travaux-dashboard"] });
      setSelectedModif(null);
    },
  });

  const options = useMemo(() => {
    const years = [...new Set(allCommandes.map(yearOf))]
      .filter((y) => y !== "Sans année")
      .map(Number)
      .sort((a, b) => a - b);
    const villes = [...new Set(allCommandes.map((c) => cityOf(c.adresse)))]
      .sort()
      .map((v) => ({ label: v, value: v }));
    const tranchesMap = new Map<string, { label: string; value: string; sub: string }>();
    allCommandes.forEach((c) => {
      if (!c.tranche_code) return;
      if (!tranchesMap.has(c.tranche_code)) {
        const detail = tranchesDetails.find((td) => td.code === c.tranche_code);
        tranchesMap.set(c.tranche_code, {
          label: c.tranche_code,
          value: c.tranche_code,
          sub: `${detail?.localite || cityOf(c.adresse)}`,
        });
      }
    });
    const tranches = [...tranchesMap.values()].sort((a, b) => a.value.localeCompare(b.value));
    return { years, tranches, villes };
  }, [allCommandes, tranchesDetails]);

  // Options pour les filtres du Journal des Commandes (Paramètres)
  const typeOptions = useMemo(() => {
    const map = new Map<string, { label: string; value: string }>();
    allCommandes.forEach((c) => {
      if (!c.corps_etat) return;
      if (!map.has(c.corps_etat))
        map.set(c.corps_etat, { label: c.corps_etat, value: c.corps_etat });
    });
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [allCommandes]);

  const etatOptions = useMemo(() => {
    // États métier réels (whitelist ETATS_METIER) présents dans les données, y compris
    // l'état dérivé « Pas réalisé ». Les valeurs parasites (dates, montants) sont exclues.
    const found = new Set<string>();
    allCommandes.forEach((c) => {
      found.add(etatMetier(c, exercice));
    });
    return ETATS_METIER.filter((s) => found.has(s)).map((s) => ({ label: s, value: s }));
  }, [allCommandes, exercice]);

  // Commandes réellement affichables : actives par défaut, + archivées si demandé.
  // « Pas réalisé » sélectionné explicitement inclut les archivées nécessaires à ce résultat.
  const visibleCommandes = useMemo(
    () =>
      allCommandes.filter((row) =>
        visibleArchivage(row, { includeArchived, selectedEtats, exercice }),
      ),
    [allCommandes, includeArchived, selectedEtats, exercice],
  );

  // Domaine du slider : années d'exercice disponibles (y compris archivées), élargies,
  // jamais réduites à une seule année — le slider reste utilisable avec une seule année.
  const yearDomain = useMemo<[number, number]>(() => sliderYearDomain(options.years), [options.years]);

  useEffect(() => {
    if (options.years.length > 0) {
      const lo = options.years[0] as number;
      const hi = options.years[options.years.length - 1] as number;
      // On conserve la sélection utilisateur tant qu'elle reste dans le domaine.
      setYearRange(([a, b]) => (a < lo || b > hi || a > b ? [lo, hi] : [a, b]));
    }
  }, [options.years]);

  const filtered = useMemo(() => {
    let result = visibleCommandes.filter((row) => {
      const year = Number(yearOf(row));
      const isProg = !!row.ligne_budget;
      const sect = secteurDe(row);
      const ville = cityOf(row.adresse);
      const matchesYear = isNaN(year) || (year >= yearRange[0] && year <= yearRange[1]);
      const matchesProg = (isProg && progFilter.prog) || (!isProg && progFilter.hors);
      const matchesSect = selectedSectors.includes(sect);
      const matchesTranche =
        selectedTranches.length === 0 ||
        (row.tranche_code && selectedTranches.includes(row.tranche_code));
      const matchesVille = selectedVilles.length === 0 || selectedVilles.includes(ville);
      const matchesType =
        selectedTypes.length === 0 ||
        (row.corps_etat && selectedTypes.includes(row.corps_etat));
      const matchesEtat =
        selectedEtats.length === 0 || selectedEtats.includes(etatMetier(row, exercice));
      const matchesSearch =
        !search ||
        [
          row.numero_commande,
          row.adresse,
          row.descriptif,
          row.fournisseur,
          row.numero_fournisseur,
        ].some((v) => text(v).toLowerCase().includes(search.toLowerCase()));
      return (
        matchesYear &&
        matchesProg &&
        matchesSect &&
        matchesTranche &&
        matchesVille &&
        matchesType &&
        matchesEtat &&
        matchesSearch
      );
    });

    Object.entries(tableFilters).forEach(([key, filter]) => {
      if (filter?.min !== undefined)
        result = result.filter(
          (r) => (Number((r as unknown as Record<string, unknown>)[key]) || 0) >= (filter.min ?? 0),
        );
      if (filter?.max !== undefined)
        result = result.filter(
          (r) => (Number((r as unknown as Record<string, unknown>)[key]) || 0) <= (filter.max ?? 0),
        );
      if (filter?.selected && filter.selected.length > 0)
        result = result.filter((r) =>
          filter.selected!.includes(String((r as unknown as Record<string, unknown>)[key])),
        );
      if (filter?.search !== undefined && filter.search !== "")
        result = result.filter((r) =>
          text((r as unknown as Record<string, unknown>)[key])
            .toLowerCase()
            .includes(filter.search!.toLowerCase()),
        );
    });

    if (sortConfig) {
      result.sort((a, b) => {
        if (sortConfig.key === "city") {
          const va = cityOf(a.adresse);
          const vb = cityOf(b.adresse);
          return sortConfig.direction === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
        }
        const va = (a as unknown as Record<string, unknown>)[sortConfig.key];
        const vb = (b as unknown as Record<string, unknown>)[sortConfig.key];
        if (typeof va === "number" && typeof vb === "number")
          return sortConfig.direction === "asc" ? va - vb : vb - va;
        return sortConfig.direction === "asc"
          ? text(va).localeCompare(text(vb))
          : text(vb).localeCompare(text(va));
      });
    }
    return result;
  }, [
    visibleCommandes,
    includeArchived,
    yearRange,
    progFilter,
    selectedSectors,
    selectedTranches,
    selectedVilles,
    selectedTypes,
    selectedEtats,
    search,
    tableFilters,
    sortConfig,
  ]);

  const stats = useMemo(() => {
    const budget = filtered.reduce((s, r) => s + (r.budget || 0), 0);
    const engage = filtered.reduce((s, r) => s + (r.engage || 0), 0);
    const count = filtered.length;
    const countProg = filtered.filter((r) => !!r.ligne_budget).length;
    // Source unique de vérité : etatMetier() (même logique que le filtre État).
    const countDone = filtered.filter((r) => {
      const e = etatMetier(r, exercice);
      return e === "Terminés" || e === "Close";
    }).length;
    return {
      budget,
      engage,
      pctHors: count ? Math.round(((count - countProg) / count) * 100) : 0,
      pctProg: count ? Math.round((countProg / count) * 100) : 0,
      done: countDone,
      total: count,
    };
  }, [filtered, exercice]);

  // Périmètre explicite du compteur « Commandes » — calculé dynamiquement, jamais codé en dur.
  const actifsTotal = allCommandes.filter((c) => c.actif).length;
  const archivesTotal = allCommandes.length - actifsTotal;

  const dataSecteur = useMemo(() => repartitionCommandesParSecteur(filtered), [filtered]);

  /** Ville « propre » dérivée de l'adresse (via le cache de géocodage si disponible). */
  const villeDe = (adresse: string) =>
    matchVille(cityOf(adresse), villesGeo ?? [])?.ville ?? cityOf(adresse);

  const dataClassement = useMemo<ClassementRow[]>(() => {
    if (rankingMode === "ville") {
      const map = filtered.reduce(
        (acc, r) => {
          const city = villeDe(r.adresse || "");
          acc[city] = (acc[city] || 0) + (r.engage || 0);
          return acc;
        },
        {} as Record<string, number>,
      );
      return Object.entries(map)
        .filter(([_, v]) => v > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([label, value]) => ({ label, value }));
    }

    if (rankingMode === "tranche") {
      // Classement par tranche : la ville affichée est celle avec le plus gros montant engagé.
      const map = filtered.reduce(
        (acc, r) => {
          const tranche = r.tranche_code || "Sans tranche";
          const ville = villeDe(r.adresse || "");
          const engage = r.engage || 0;
          const g = acc.get(tranche) ?? { tranche, ville, value: 0, villeValue: -1 };
          g.value += engage;
          if (engage > g.villeValue) {
            g.villeValue = engage;
            g.ville = ville;
          }
          acc.set(tranche, g);
          return acc;
        },
        new Map<string, { tranche: string; ville: string; value: number; villeValue: number }>(),
      );
      return [...map.values()]
        .filter((g) => g.value > 0)
        .sort((a, b) => b.value - a.value)
        .map((g) => ({ label: g.tranche, ville: g.ville, value: g.value }));
    }

    // Classement par adresse : la ville et la/les tranche(s) sont affichées à côté.
    const map = filtered.reduce(
      (acc, r) => {
        const adresse = r.adresse || "Adresse inconnue";
        const g = acc.get(adresse) ?? {
          adresse,
          ville: villeDe(adresse),
          tranches: new Set<string>(),
          value: 0,
        };
        g.value += r.engage || 0;
        if (r.tranche_code) g.tranches.add(r.tranche_code);
        acc.set(adresse, g);
        return acc;
      },
      new Map<string, { adresse: string; ville: string; tranches: Set<string>; value: number }>(),
    );
    return [...map.values()]
      .filter((g) => g.value > 0)
      .sort((a, b) => b.value - a.value)
      .map((g) => ({
        label: g.adresse,
        ville: g.ville,
        tranche: [...g.tranches].sort().join(" / "),
        value: g.value,
      }));
  }, [filtered, rankingMode, villesGeo]);

  // Villes géocodées avec le montant investi agrégé (pour la cartographie couleur).
  const { dataVilles, nonLocalisees: villesNonLocalisees } = useMemo(
    () => buildDataVilles(filtered, villesGeo ?? []),
    [filtered, villesGeo],
  );

  const dataTranche = useMemo(() => {
    const map = filtered.reduce(
      (acc, r) => {
        const t = r.tranche_code || "Sans tranche";
        if (!acc[t]) acc[t] = { engage: 0, adresse: r.adresse || "Adresse inconnue" };
        acc[t].engage += r.engage || 0;
        return acc;
      },
      {} as Record<string, { engage: number; adresse: string }>,
    );
    const total = stats.engage || 1;
    return Object.entries(map)
      .map(([name, data]) => ({
        name,
        value: data.engage,
        adresse: data.adresse,
        pct: ((data.engage / total) * 100).toFixed(1),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, showAllTranches ? 20 : 5);
  }, [filtered, stats.engage, showAllTranches]);

  const dataDrilldown = useMemo(() => {
    if (!drilldownSector) return [];
    const map = filtered
      .filter((r) => secteurDe(r) === drilldownSector)
      .reduce(
        (acc, r) => {
          const c = r.corps_etat || "Non renseigné";
          acc[c] = (acc[c] || 0) + (r.engage || 0);
          return acc;
        },
        {} as Record<string, number>,
      );
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filtered, drilldownSector]);

  const historyMap = useMemo(() => {
    const map = new Map<string, HistoriqueTravaux>();
    historique.forEach((h) => {
      if (!h.resolu && !map.has(h.commande_id)) map.set(h.commande_id, h);
    });
    return map;
  }, [historique]);

  const reset = () => {
    if (options.years.length > 0)
      setYearRange([options.years[0] as number, options.years[options.years.length - 1] as number]);
    setProgFilter({ prog: true, hors: true });
    setSelectedSectors([...SECTEURS]);
    setSelectedTranches([]);
    setSelectedVilles([]);
    setSelectedTypes([]);
    setSelectedEtats([]);
    setSearch("");
    setTableFilters({});
    setPage(1);
  };

  const handleLastYear = () => {
    const last = options.years[options.years.length - 1];
    if (last) setYearRange([last, last]);
  };

  const handleEditStart = () => {
    if (!selectedDetail) return;
    setEditForm({ ...selectedDetail });
    setIsEditing(true);
  };
  const handleSave = () => {
    if (!selectedDetail?.id) return;
    mutation.mutate({ id: selectedDetail.id, data: editForm });
  };

  const handleResolve = () => {
    if (!selectedModif) return;
    const dataToKeep = versionChoice === "A" ? selectedModif.avant : selectedModif.apres;
    resolveMutation.mutate({
      id: selectedModif.id,
      keepVersion: versionChoice,
      commandeId: selectedModif.commande_id,
      data: dataToKeep,
    });
  };

  const toggleSort = (key: string) => {
    setSortConfig((prev) =>
      prev?.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "desc" },
    );
  };

  if (isLoading)
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 font-black text-slate-300 uppercase tracking-widest">
        Initialisation du Dashboard Pro...
      </div>
    );

  if (isError) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center">
        <AlertTriangle className="size-10 text-red-500" />
        <div className="max-w-lg">
          <h2 className="text-lg font-black text-slate-900 uppercase tracking-wide">
            Impossible de charger le dashboard
          </h2>
          <p className="mt-2 text-sm font-medium text-slate-500">
            La connexion à la base de données a échoué. Vérifiez que les variables{" "}
            <code>EXT_SUPABASE_URL</code> et <code>EXT_SUPABASE_SERVICE_ROLE_KEY</code>{" "}
            sont configurées, puis rechargez la page.
          </p>
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 font-mono text-xs text-red-600">
            {message}
          </p>
          <Button className="mt-5" size="sm" onClick={() => window.location.reload()}>
            Recharger la page
          </Button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50/50 pb-12 text-slate-900 font-sans">
      <header className="sticky top-0 z-20 border-b bg-white/90 backdrop-blur-lg shadow-sm">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg text-white shadow-blue-200 shadow-lg">
              <Wrench className="size-5" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight uppercase">TRAVAUX ANALYTICS</h1>
              <p className="text-[9px] text-muted-foreground font-black uppercase tracking-widest">
                Pilotage Patrimonial
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            {recentImports.length > 0 && (
              <div className="hidden md:flex items-center gap-3 border-r pr-6">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Dernier Import :
                </span>
                <button
                  onClick={() => setSelectedImportErrors(recentImports[0] || null)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[9px] font-black uppercase transition-all ${(recentImports[0]?.erreurs || 0) > 0 ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-green-50 text-green-600"}`}
                >
                  {(recentImports[0]?.erreurs || 0) > 0 ? (
                    <AlertCircle className="size-3" />
                  ) : (
                    <CheckCircle2 className="size-3" />
                  )}
                  {recentImports[0]?.erreurs || 0} ERREURS
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="font-black text-[10px] tracking-widest"
              >
                <Link to="/">ACCUEIL</Link>
              </Button>
              <Button
                asChild
                size="sm"
                className="bg-slate-900 hover:bg-slate-800 text-[10px] font-black tracking-widest px-4"
              >
                <Link to="/import-travaux">
                  <Upload className="size-3.5 mr-2" /> NOUVEL IMPORT
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="px-4 py-6 space-y-6 max-w-full">
        {/* SECTION FILTRES */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <ListFilter className="size-4" /> Filtres de Pilotage
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={reset}
              className="text-[9px] font-black text-slate-400 hover:text-red-500 uppercase tracking-widest"
            >
              <RotateCcw className="size-3 mr-1" /> RÉINITIALISER
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <div className="space-y-4">
              <Label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                Période (Slider)
              </Label>
              <div className="px-2 pt-2">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                    {yearRange[0]}
                  </span>
                  <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                    {yearRange[1]}
                  </span>
                </div>
                <YearRangeSlider
                  min={yearDomain[0]}
                  max={yearDomain[1]}
                  value={yearRange}
                  onChange={setYearRange}
                />
              </div>
            </div>
            <div className="space-y-3">
              <Label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                Multi-Sélection Tranches
              </Label>
              <MultiSelect
                label="Tranches"
                options={options.tranches}
                selected={selectedTranches}
                onChange={setSelectedTranches}
                icon={Layers}
              />
            </div>
            <div className="space-y-3">
              <Label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                Multi-Sélection Villes
              </Label>
              <MultiSelect
                label="Villes"
                options={options.villes}
                selected={selectedVilles}
                onChange={setSelectedVilles}
                icon={MapPin}
              />
            </div>
            <div className="space-y-3">
              <Label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                Secteur & Programmation
              </Label>
              <div className="flex flex-wrap gap-2">
                {SECTEURS.map((s) => (
                  <button
                    key={s}
                    onClick={() =>
                      setSelectedSectors((prev) =>
                        prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
                      )
                    }
                    className={`px-2 py-1 rounded-lg text-[9px] font-black transition-all border ${selectedSectors.includes(s) ? "bg-blue-600 text-white border-blue-600 shadow-md" : "bg-slate-50 text-slate-500 border-slate-200"}`}
                  >
                    {s}
                  </button>
                ))}
                <div className="w-full h-px bg-slate-100 my-1" />
                <button
                  onClick={() => setProgFilter((p) => ({ ...p, prog: !p.prog }))}
                  className={`px-2 py-1 rounded-lg text-[9px] font-black transition-all border ${progFilter.prog ? "bg-green-600 text-white border-green-600 shadow-md" : "bg-slate-50 text-slate-500 border-slate-200"}`}
                >
                  PROG.
                </button>
                <button
                  onClick={() => setProgFilter((p) => ({ ...p, hors: !p.hors }))}
                  className={`px-2 py-1 rounded-lg text-[9px] font-black transition-all border ${progFilter.hors ? "bg-orange-600 text-white border-orange-600 shadow-md" : "bg-slate-50 text-slate-500 border-slate-200"}`}
                >
                  HORS
                </button>
              </div>
            </div>
            <div className="space-y-3">
              <Label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                Recherche Rapide
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 size-3.5 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="CMD, ADRESSE..."
                  className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-4 text-[10px] font-black uppercase focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          </div>
        </section>

        {/* KPIs */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Kpi label="Engagé Total" value={money(stats.engage)} trend="ACTUEL" />
          <Kpi label="Budget Prévu" value={money(stats.budget)} trend="CIBLE" />
          <Kpi label="% Programmation" value={`${stats.pctProg}%`} trend="QUALITÉ" />
          <Kpi
            label="Commandes"
            value={stats.total.toString()}
            detail={`${stats.done} terminées · ${actifsTotal} actives · ${archivesTotal} archivées`}
            trend="FLUX"
          />
        </section>

        {/* CARTE & GRAPHIQUES */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <article className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-6 shadow-sm overflow-hidden relative min-h-[450px]">
            <div className="flex items-center justify-between mb-6 relative z-10">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <MapIcon className="size-4 text-blue-600" /> Cartographie vs Classement
              </h3>
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setMapMode("map")}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${mapMode === "map" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                >
                  <MapIcon className="size-3 mr-1.5 inline" /> Carte
                </button>
                <button
                  onClick={() => setMapMode("classement")}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${mapMode === "classement" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                >
                  <BarChart3 className="size-3 mr-1.5 inline" /> Classement
                </button>
              </div>
            </div>
            {mapMode === "map" ? (
              <div className="absolute inset-0 z-0">
                <ClientOnlyMap
                  dataVilles={dataVilles}
                  money={money}
                  missing={villesNonLocalisees}
                />
              </div>
            ) : (
              <>
                <div className="flex bg-slate-100 p-1 rounded-xl w-max mb-4">
                  {(["ville", "tranche", "adresse"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setRankingMode(mode)}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${rankingMode === mode ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                    >
                      {mode === "ville" ? "Ville" : mode === "tranche" ? "Tranche" : "Adresse"}
                    </button>
                  ))}
                </div>
                <div className="space-y-4 h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                  {dataClassement.map((row, idx) => {
                    const max = dataClassement[0]?.value || 1;
                    const pct = (row.value / max) * 100;
                    const color = pct > 70 ? "bg-red-500" : pct > 40 ? "bg-orange-400" : "bg-yellow-400";
                    return (
                      <div key={`${rankingMode}-${idx}-${row.label}`} className="group relative">
                        <div className="flex items-center justify-between mb-1 gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-[10px] font-black text-slate-700 uppercase truncate">
                              {row.label}
                            </span>
                            {row.ville && (
                              <span className="text-[9px] font-bold text-slate-400 truncate">
                                {row.tranche ? `· ${row.ville} · Tr. ${row.tranche}` : `· ${row.ville}`}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-black text-slate-900 shrink-0">
                            {money(row.value)}
                          </span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-1000 ${color}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </article>
          <article className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Répartition Type
              </h3>
              <Filter className="size-3.5 text-slate-300" />
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dataSecteur}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={10}
                    onClick={(e) => setDrilldownSector(e.name)}
                    className="cursor-pointer"
                  >
                    {dataSecteur.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={SECTOR_COLORS[entry.name as keyof typeof SECTOR_COLORS]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0]?.payload as {
                          name: string;
                          value: number;
                          engage: number;
                        };
                        return (
                          <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-2xl border-none">
                            <p className="text-[10px] font-black uppercase mb-1">{d.name}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase mb-2">
                              {d.value} commandes
                            </p>
                            <p className="text-xs font-black text-blue-400">
                              Engagé : {money(d.engage)}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconType="circle"
                    wrapperStyle={{
                      fontSize: "9px",
                      fontWeight: "black",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-4 text-[9px] text-center text-slate-400 font-black uppercase tracking-widest">
              Cliquez pour voir les corps d'état
            </p>
          </article>
        </div>

        {/* Classement Tranches */}
        <article className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Classement des Tranches (Top Engagé)
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAllTranches(!showAllTranches)}
              className="text-[9px] font-black uppercase tracking-widest border-slate-200 rounded-xl"
            >
              {showAllTranches ? "TOP 5" : "TOP 20"}
            </Button>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataTranche} layout="vertical" margin={{ left: 20, right: 100 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis
                  dataKey="name"
                  type="category"
                  fontSize={9}
                  fontWeight="black"
                  width={100}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0]?.payload;
                      return (
                        <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-2xl border-none">
                          <p className="text-[10px] font-black uppercase mb-1">{d.name}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase mb-2">
                            {d.adresse}
                          </p>
                          <p className="text-xs font-black text-blue-400">{money(d.value)}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="value" fill="#2563eb" radius={[0, 8, 8, 0]} barSize={25}>
                  <LabelList
                    dataKey="value"
                    position="right"
                    formatter={(v: number) => money(v)}
                    className="text-[9px] font-black fill-slate-900"
                  />
                  {dataTranche.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? "#1e40af" : "#3b82f6"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        {/* JOURNAL DES COMMANDES */}
        <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b bg-slate-50/50 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-900">
                Journal des Commandes
              </h3>
              <Badge className="bg-slate-200 text-slate-700 text-[9px] font-black uppercase tracking-tighter rounded-lg">
                {filtered.length} LIGNES
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                  Années
                </Label>
                <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                  {yearRange[0]}
                </span>
                <div className="relative w-36 h-6 flex items-center">
                  <YearRangeSlider
                    min={yearDomain[0]}
                    max={yearDomain[1]}
                    value={yearRange}
                    onChange={setYearRange}
                  />
                </div>
                <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                  {yearRange[1]}
                </span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <Checkbox
                  checked={includeArchived}
                  onCheckedChange={(checked) => setIncludeArchived(checked === true)}
                  className="size-4"
                />
                <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">
                  Inclure archivées
                </span>
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-[9px] font-black uppercase tracking-widest border-slate-200 rounded-lg h-8"
                  >
                    <SlidersHorizontal className="size-3 mr-1.5" /> PARAMÈTRES
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-96 p-4 rounded-2xl space-y-5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-slate-900 tracking-widest">
                      Filtres du Journal
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedTranches([]);
                        setSelectedTypes([]);
                        setSelectedEtats([]);
                        setProgFilter({ prog: true, hors: true });
                      }}
                      className="text-[9px] font-black text-red-500 h-6 px-2"
                    >
                      EFFACER
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                      Tranche
                    </Label>
                    <MultiSelect
                      label="Tranches"
                      options={options.tranches}
                      selected={selectedTranches}
                      onChange={setSelectedTranches}
                      icon={Layers}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                      Type
                    </Label>
                    <MultiSelect
                      label="Types"
                      options={typeOptions}
                      selected={selectedTypes}
                      onChange={setSelectedTypes}
                      icon={Wrench}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                      État
                    </Label>
                    <MultiSelect
                      label="États"
                      options={etatOptions}
                      selected={selectedEtats}
                      onChange={setSelectedEtats}
                      icon={CheckCircle2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                      Programmation
                    </Label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setProgFilter((p) => ({ ...p, prog: !p.prog }))}
                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black transition-all border ${progFilter.prog ? "bg-green-600 text-white border-green-600 shadow-md" : "bg-slate-50 text-slate-500 border-slate-200"}`}
                      >
                        PROG.
                      </button>
                      <button
                        onClick={() => setProgFilter((p) => ({ ...p, hors: !p.hors }))}
                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black transition-all border ${progFilter.hors ? "bg-orange-600 text-white border-orange-600 shadow-md" : "bg-slate-50 text-slate-500 border-slate-200"}`}
                      >
                        HORS
                      </button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLastYear}
                className="text-[9px] font-black uppercase tracking-widest border-slate-200 rounded-lg h-8"
              >
                DERNIÈRE ANNÉE
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-[10px] border-collapse">
              <thead className="bg-slate-50 border-b text-slate-400 font-black uppercase tracking-widest">
                <tr>
                  <th className="p-4 w-20">Année</th>
                  <th className="p-4 w-32">
                    <button
                      onClick={() => toggleSort("numero_commande")}
                      className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                    >
                      N° Commande{" "}
                      {sortConfig?.key === "numero_commande" &&
                        (sortConfig.direction === "asc" ? (
                          <ArrowUp className="size-3" />
                        ) : (
                          <ArrowDown className="size-3" />
                        ))}
                    </button>
                  </th>
                  <th className="p-4 w-24">
                    <button
                      onClick={() => toggleSort("tranche_code")}
                      className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                    >
                      Tranche{" "}
                      {sortConfig?.key === "tranche_code" &&
                        (sortConfig.direction === "asc" ? (
                          <ArrowUp className="size-3" />
                        ) : (
                          <ArrowDown className="size-3" />
                        ))}
                    </button>
                  </th>
                  <th className="p-4 w-48">Adresse</th>
                  <th className="p-4 w-28">
                    <button
                      onClick={() => toggleSort("city")}
                      className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                    >
                      Ville{" "}
                      {sortConfig?.key === "city" &&
                        (sortConfig.direction === "asc" ? (
                          <ArrowUp className="size-3" />
                        ) : (
                          <ArrowDown className="size-3" />
                        ))}
                    </button>
                  </th>
                  <th className="p-4 w-56">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="flex items-center gap-1 hover:text-blue-600">
                          Descriptif <Search className="size-3" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 p-4 rounded-2xl">
                        <Label className="text-[9px] font-black uppercase mb-4 block">
                          Recherche Descriptif
                        </Label>
                        <div className="relative">
                          <Search className="absolute left-3 top-2.5 size-3.5 text-slate-400" />
                          <Input
                            type="text"
                            value={tableFilters["descriptif"]?.search ?? ""}
                            onChange={(e) =>
                              setTableFilters((p) => ({
                                ...p,
                                descriptif: {
                                  ...(p["descriptif"] ?? {}),
                                  search: e.target.value,
                                },
                              }))
                            }
                            placeholder="Rechercher dans le descriptif..."
                            autoFocus
                            className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-4 text-[10px] font-black uppercase focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                        {tableFilters["descriptif"]?.search ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setTableFilters((p) => {
                                const next = { ...(p["descriptif"] ?? {}) };
                                delete next.search;
                                return { ...p, descriptif: next };
                              })
                            }
                            className="mt-2 text-[9px] font-black text-red-500 h-6 px-2"
                          >
                            EFFACER LA RECHERCHE
                          </Button>
                        ) : null}
                      </PopoverContent>
                    </Popover>
                  </th>
                  <th className="p-4 w-24">Type</th>
                  <th className="p-4 w-28">Entreprise</th>
                  <th className="p-4 w-32 text-right">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="flex items-center gap-1 ml-auto hover:text-blue-600">
                          Engagé <Filter className="size-3" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-4 rounded-2xl">
                        <Label className="text-[9px] font-black uppercase mb-4 block">
                          Plage Engagé (€)
                        </Label>
                        <div className="space-y-4">
                          <Input
                            type="number"
                            placeholder="Min"
                            onChange={(e) => {
                              const value = Number(e.target.value);
                              setTableFilters((p) => ({
                                ...p,
                                engage: {
                                  ...(p["engage"] ?? {}),
                                  ...(value ? { min: value } : {}),
                                },
                              }));
                            }}
                            className="h-8 text-[10px] font-black"
                          />
                          <Input
                            type="number"
                            placeholder="Max"
                            onChange={(e) => {
                              const value = Number(e.target.value);
                              setTableFilters((p) => ({
                                ...p,
                                engage: {
                                  ...(p["engage"] ?? {}),
                                  ...(value ? { max: value } : {}),
                                },
                              }));
                            }}
                            className="h-8 text-[10px] font-black"
                          />
                        </div>
                      </PopoverContent>
                    </Popover>
                  </th>
                  <th className="p-4 w-32 text-right">Payé</th>
                  <th className="p-4 w-16 text-center">Prog.</th>
                  <th className="p-4 w-24">État</th>
                  <th className="p-4 w-12 text-center">ACT.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((row) => {
                  const modif = historyMap.get(row.id);
                  const sect = secteurDe(row);
                  const isProg = !!row.ligne_budget;
                  return (
                    <tr key={row.id} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="p-4 font-bold text-slate-400">{yearOf(row)}</td>
                      <td className="p-4 font-black text-blue-600 truncate">
                        <button
                          onClick={() => setSelectedDetail(row)}
                          className="hover:underline flex items-center gap-1"
                        >
                          {row.numero_commande}
                          <Info className="size-3 opacity-0 group-hover:opacity-100" />
                        </button>
                      </td>
                      <td className="p-4 font-black text-slate-700 truncate">
                        <Link
                          to="/adresses"
                          search={{
                            q: "",
                            ville: undefined,
                            tranche: row.tranche_code || undefined,
                            rue: undefined,
                            adresse: undefined,
                          }}
                          className="hover:underline"
                        >
                          {row.tranche_code || "—"}
                        </Link>
                      </td>
                      <td className="p-4 font-bold text-slate-600 truncate uppercase">
                        {row.adresse || "—"}
                      </td>
                      <td className="p-4 font-bold text-slate-500 truncate uppercase">
                        {cityOf(row.adresse) || "—"}
                      </td>
                      <td className="p-4 text-slate-500 truncate">{row.descriptif || "—"}</td>
                      <td className="p-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[8px] font-black ${sect === "GT" ? "bg-blue-100 text-blue-700" : sect === "GE" ? "bg-teal-100 text-teal-700" : "bg-orange-100 text-orange-700"}`}
                        >
                          {sect}
                        </span>
                      </td>
                      <td className="p-4 font-bold text-slate-500 truncate">
                        {row.numero_fournisseur || "—"}
                      </td>
                      <td className="p-4 text-right font-black text-slate-900">
                        {money(row.engage)}
                      </td>
                      <td className="p-4 text-right text-slate-600">{money(row.paye)}</td>
                      <td className="p-4 text-center">
                        <div
                          className={`mx-auto size-2 rounded-full ${isProg ? "bg-green-500 shadow-green-200" : "bg-slate-300"} shadow-sm`}
                        />
                      </td>
                      <td className="p-4 truncate">
                        <span className="text-slate-400 font-black uppercase text-[8px]">
                          {row.etat_travaux || row.etat_commande || "—"}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        {modif ? (
                          <button
                            onClick={() => {
                              setSelectedModif(modif);
                              setVersionChoice("B");
                            }}
                            className="text-amber-500 hover:scale-110"
                          >
                            <AlertTriangle className="size-4 fill-amber-50" />
                          </button>
                        ) : (
                          <div className="size-4 mx-auto rounded-full border-2 border-slate-100 group-hover:border-slate-200" />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="p-4 bg-slate-50/50 border-t flex items-center justify-between">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
              PAGE {page} SUR {Math.ceil(filtered.length / PAGE_SIZE) || 1}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 font-black text-[9px] rounded-xl uppercase tracking-widest"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                PRÉCÉDENT
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 font-black text-[9px] rounded-xl uppercase tracking-widest"
                disabled={page * PAGE_SIZE >= filtered.length}
                onClick={() => setPage((p) => p + 1)}
              >
                SUIVANT
              </Button>
            </div>
          </div>
        </section>
      </div>

      {/* MODALE FICHE DÉTAILLÉE ÉDITABLE */}
      <Dialog
        open={!!selectedDetail}
        onOpenChange={(o) => {
          if (!o) {
            setSelectedDetail(null);
            setIsEditing(false);
          }
        }}
      >
        <DialogContent className="max-w-5xl rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-slate-900 p-8 text-white relative">
            <div className="bg-slate-800/50 rounded-2xl p-4 mb-6 border border-white/5">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">
                Descriptif complet
              </p>
              {isEditing ? (
                <Textarea
                  value={editForm.descriptif || ""}
                  onChange={(e) => setEditForm((p) => ({ ...p, descriptif: e.target.value }))}
                  className="bg-slate-800 border-slate-700 text-xs font-medium text-white min-h-[60px] rounded-xl"
                />
              ) : (
                <p className="text-xs text-slate-300 leading-relaxed font-medium">
                  {selectedDetail?.descriptif || "Aucun descriptif renseigné."}
                </p>
              )}
            </div>
            <div className="mb-6">
              <h2 className="text-2xl font-black uppercase tracking-tighter mb-1">
                Fiche Commande #{selectedDetail?.numero_commande}
              </h2>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">
                Détail exhaustif & Édition Directe
              </p>
            </div>
            <div className="flex items-center justify-between mb-8">
              <div className="grid grid-cols-2 md:grid-cols-6 gap-8 flex-1">
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-slate-500 uppercase">Type</p>
                  {isEditing ? (
                    <select
                      value={editForm.secteur || ""}
                      onChange={(e) => setEditForm((p) => ({ ...p, secteur: e.target.value }))}
                      className="bg-slate-800 border-slate-700 text-xs font-black w-full rounded p-1 outline-none"
                    >
                      <option value="GT">GT</option>
                      <option value="GE">GE</option>
                      <option value="CP">CP</option>
                    </select>
                  ) : (
                    <p className="text-sm font-black">
                      {selectedDetail ? secteurDe(selectedDetail) : "—"}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-slate-500 uppercase">Tranche</p>
                  <p className="text-sm font-black text-blue-400">
                    <Link
                      to="/adresses"
                      search={{
                        q: "",
                        ville: undefined,
                        tranche: selectedDetail?.tranche_code || undefined,
                        rue: undefined,
                        adresse: undefined,
                      }}
                      className="hover:underline"
                    >
                      {selectedDetail?.tranche_code || "—"}
                    </Link>
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-slate-500 uppercase">ID Lot</p>
                  {isEditing ? (
                    <Input
                      value={editForm.lot_code || ""}
                      onChange={(e) => setEditForm((p) => ({ ...p, lot_code: e.target.value }))}
                      className="bg-slate-800 border-slate-700 text-xs font-black h-7 rounded-lg"
                    />
                  ) : (
                    <p className="text-sm font-black text-teal-400">
                      {selectedDetail?.lot_code ? (
                        <Link
                          to="/adresses"
                          search={{
                            q: selectedDetail.lot_code,
                            ville: undefined,
                            tranche: undefined,
                            rue: undefined,
                            adresse: undefined,
                          }}
                          className="hover:underline flex items-center gap-1"
                        >
                          {selectedDetail.lot_code} <ChevronRight className="size-3" />
                        </Link>
                      ) : (
                        "Non rattaché"
                      )}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-slate-500 uppercase">État</p>
                  {isEditing ? (
                    <Input
                      value={editForm.etat_travaux || ""}
                      onChange={(e) => setEditForm((p) => ({ ...p, etat_travaux: e.target.value }))}
                      className="bg-slate-800 border-slate-700 text-xs font-black h-7 rounded-lg"
                    />
                  ) : (
                    <p className="text-sm font-black uppercase text-amber-400">
                      {selectedDetail?.etat_travaux || selectedDetail?.etat_commande || "—"}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-slate-500 uppercase">Prog.</p>
                  <p className="text-sm font-black uppercase">
                    {selectedDetail?.ligne_budget ? "Programmée" : "Hors Budget"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-slate-500 uppercase">Année</p>
                  <p className="text-sm font-black uppercase">
                    {selectedDetail?.annee_exercice ?? "—"}
                  </p>
                </div>
              </div>
              <div className="ml-8">
                {!isEditing ? (
                  <div className="flex gap-2">
                    <Button
                      onClick={handleEditStart}
                      variant="outline"
                      className="bg-white/10 border-white/20 hover:bg-white/20 text-white font-black text-[10px] uppercase tracking-widest rounded-xl"
                    >
                      <Edit3 className="size-3.5 mr-2" /> MODIFIER
                    </Button>
                    <Button
                      onClick={() => setHistoryFor(selectedDetail)}
                      variant="ghost"
                      className="text-white/80 hover:text-white font-black text-[10px] uppercase tracking-widest rounded-xl"
                    >
                      <History className="size-3.5 mr-2" /> HISTORIQUE
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      onClick={handleSave}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-black text-[10px] uppercase tracking-widest rounded-xl"
                    >
                      <Save className="size-3.5 mr-2" /> SAUVER
                    </Button>
                    <Button
                      onClick={() => setIsEditing(false)}
                      variant="ghost"
                      className="text-white font-black text-[10px] uppercase tracking-widest rounded-xl"
                    >
                      ANNULER
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-12 bg-white">
            <div className="space-y-8">
              <section>
                <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 mb-4">
                  <Building2 className="size-4 text-blue-600" /> Localisation & Nature
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Adresse</span>
                    {isEditing ? (
                      <Input
                        value={editForm.adresse || ""}
                        onChange={(e) => setEditForm((p) => ({ ...p, adresse: e.target.value }))}
                        className="text-xs font-black h-7 w-48 rounded-lg"
                      />
                    ) : (
                      <span className="text-xs font-black text-slate-700">
                        {selectedDetail?.adresse || "—"}
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                      Corps d'état
                    </span>
                    {isEditing ? (
                      <Input
                        value={editForm.corps_etat || ""}
                        onChange={(e) => setEditForm((p) => ({ ...p, corps_etat: e.target.value }))}
                        className="text-xs font-black h-7 w-48 rounded-lg"
                      />
                    ) : (
                      <span className="text-xs font-black text-slate-700">
                        {selectedDetail?.corps_etat || "—"}
                      </span>
                    )}
                  </div>
                </div>
              </section>
              <section>
                <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 mb-4">
                  <User className="size-4 text-blue-600" /> Intervenants
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                      Entreprise
                    </span>
                    {isEditing ? (
                      <div className="flex gap-2">
                        <Input
                          value={editForm.fournisseur || ""}
                          onChange={(e) =>
                            setEditForm((p) => ({ ...p, fournisseur: e.target.value }))
                          }
                          className="text-xs font-black h-7 w-32 rounded-lg"
                        />
                        <Input
                          value={editForm.numero_fournisseur || ""}
                          onChange={(e) =>
                            setEditForm((p) => ({ ...p, numero_fournisseur: e.target.value }))
                          }
                          className="text-xs font-black h-7 w-16 rounded-lg"
                        />
                      </div>
                    ) : (
                      <span className="text-xs font-black text-slate-700">
                        {selectedDetail?.fournisseur || "—"} ({selectedDetail?.numero_fournisseur})
                      </span>
                    )}
                  </div>
                </div>
              </section>
            </div>
            <div className="space-y-8">
              <section>
                <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 mb-4">
                  <Euro className="size-4 text-blue-600" /> Finance
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl">
                    <p className="text-[9px] font-black text-slate-400 uppercase">Engagé</p>
                    {isEditing ? (
                      <Input
                        type="number"
                        value={editForm.engage || 0}
                        onChange={(e) =>
                          setEditForm((p) => ({ ...p, engage: Number(e.target.value) }))
                        }
                        className="text-xs font-black h-7 rounded-lg"
                      />
                    ) : (
                      <p className="text-lg font-black text-blue-700">
                        {money(selectedDetail?.engage)}
                      </p>
                    )}
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl">
                    <p className="text-[9px] font-black text-slate-400 uppercase">Payé</p>
                    {isEditing ? (
                      <Input
                        type="number"
                        value={editForm.paye || 0}
                        onChange={(e) =>
                          setEditForm((p) => ({ ...p, paye: Number(e.target.value) }))
                        }
                        className="text-xs font-black h-7 rounded-lg"
                      />
                    ) : (
                      <p className="text-lg font-black">{money(selectedDetail?.paye)}</p>
                    )}
                  </div>
                </div>
              </section>
            </div>
          </div>
          <DialogFooter className="p-6 bg-white border-t">
            <Button
              onClick={() => {
                setSelectedDetail(null);
                setIsEditing(false);
              }}
              className="w-full bg-slate-900 font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl h-12"
            >
              FERMER LA FICHE
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DRILL-DOWN SECTEUR */}
      <Dialog open={!!drilldownSector} onOpenChange={(o) => !o && setDrilldownSector(null)}>
        <DialogContent className="max-w-xl rounded-3xl border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black uppercase tracking-tight">
              Détail : {drilldownSector}
            </DialogTitle>
            <DialogDescription className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Répartition Engagé par Corps d'état
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
            {dataDrilldown.map((d, i) => (
              <div
                key={d.name}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-blue-200 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-[9px] font-black text-slate-300">#0{i + 1}</span>
                  <span className="text-[10px] font-black text-slate-700 uppercase">{d.name}</span>
                </div>
                <span className="text-[10px] font-black text-blue-600">{money(d.value)}</span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button
              onClick={() => setDrilldownSector(null)}
              className="w-full bg-slate-900 font-black text-[10px] rounded-xl uppercase tracking-widest h-12"
            >
              FERMER
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ALERTE MODIFICATIONS (⚠️) */}
      <Dialog open={!!selectedModif} onOpenChange={(o) => !o && setSelectedModif(null)}>
        <DialogContent className="max-w-4xl rounded-3xl overflow-hidden p-0 border-none shadow-2xl">
          <div className="bg-amber-500 p-6 text-white">
            <div className="flex items-center gap-3">
              <AlertTriangle className="size-8" />
              <div>
                <h2 className="text-xl font-black uppercase tracking-tight">
                  Conflit de version détecté
                </h2>
                <p className="text-[10px] font-black opacity-80 uppercase tracking-widest">
                  Commande N°{" "}
                  {(
                    selectedModif as unknown as { travaux_commandes?: { numero_commande?: string } }
                  )?.travaux_commandes?.numero_commande || "—"}
                </p>
              </div>
            </div>
          </div>
          <div className="p-8 space-y-8 bg-white">
            <div className="grid grid-cols-2 gap-8">
              <div
                className={`rounded-2xl border-2 p-6 transition-all ${versionChoice === "A" ? "border-blue-600 bg-blue-50/30 ring-4 ring-blue-50" : "border-slate-100 bg-slate-50"}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                    VERSION ACTUELLE (A)
                  </span>
                  <RadioGroup
                    value={versionChoice}
                    onValueChange={(v) => setVersionChoice(v as "A" | "B")}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="A" id="vA" />
                      <Label
                        htmlFor="vA"
                        className="text-[10px] font-black cursor-pointer uppercase"
                      >
                        GARDER L'ANCIENNE
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
                <div className="space-y-3">
                  {selectedModif?.avant &&
                    Object.entries(selectedModif.avant).map(([k, v]) => (
                      <div
                        key={k}
                        className="flex justify-between text-[10px] border-b border-slate-100 pb-1"
                      >
                        <span className="text-slate-400 font-black uppercase tracking-tighter">
                          {k.replace(/_/g, " ")}
                        </span>
                        <span className="text-slate-900 font-bold">{text(v)}</span>
                      </div>
                    ))}
                </div>
              </div>
              <div
                className={`rounded-2xl border-2 p-6 transition-all ${versionChoice === "B" ? "border-blue-600 bg-blue-50/30 ring-4 ring-blue-50" : "border-slate-100 bg-slate-50"}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                    VERSION IMPORTÉE (B)
                  </span>
                  <RadioGroup
                    value={versionChoice}
                    onValueChange={(v) => setVersionChoice(v as "A" | "B")}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="B" id="vB" />
                      <Label
                        htmlFor="vB"
                        className="text-[10px] font-black cursor-pointer uppercase"
                      >
                        GARDER LA NOUVELLE
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
                <div className="space-y-3">
                  {selectedModif?.apres &&
                    Object.entries(selectedModif.apres).map(([k, v]) => {
                      const changed =
                        JSON.stringify(selectedModif.avant?.[k]) !== JSON.stringify(v);
                      return (
                        <div
                          key={k}
                          className={`flex justify-between text-[10px] border-b border-slate-100 pb-1 ${changed ? "text-blue-600 font-black bg-blue-50 -mx-2 px-2 rounded" : ""}`}
                        >
                          <span className="text-slate-400 font-black uppercase tracking-tighter">
                            {k.replace(/_/g, " ")}
                          </span>
                          <span>{text(v)}</span>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
            <div className="flex gap-4">
              <Button
                className="flex-1 h-12 bg-slate-900 hover:bg-slate-800 text-white font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl shadow-xl"
                onClick={handleResolve}
                disabled={resolveMutation.isPending}
              >
                VALIDER LA DÉCISION
              </Button>
              <Button
                variant="ghost"
                className="h-12 px-8 font-black text-[11px] uppercase tracking-widest rounded-2xl"
                onClick={() => setSelectedModif(null)}
              >
                ANNULER
              </Button>
            </div>
            {resolveMutation.isError ? (
              <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                La résolution a échoué :{" "}
                {resolveMutation.error instanceof Error
                  ? resolveMutation.error.message
                  : "erreur inconnue"}
                . L'alerte reste active.
              </p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* ERREURS IMPORT */}
      <Dialog
        open={!!selectedImportErrors}
        onOpenChange={(o) => !o && setSelectedImportErrors(null)}
      >
        <DialogContent className="max-w-2xl rounded-3xl border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2 text-red-600">
              <AlertCircle className="size-5" /> Analyse des Erreurs d'Import
            </DialogTitle>
            <DialogDescription className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Fichier : {selectedImportErrors?.fichier}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
            <div className="bg-red-50 p-5 rounded-2xl border border-red-100 text-xs text-red-800 font-bold uppercase tracking-tight leading-relaxed">
              {selectedImportErrors?.erreurs} lignes ont été rejetées car le numéro de commande
              était manquant ou les données financières étaient corrompues.
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Total Scanné</p>
                <p className="text-xl font-black text-slate-900">{selectedImportErrors?.lignes}</p>
              </div>
              <div className="p-4 rounded-2xl bg-green-50 border border-green-100">
                <p className="text-[9px] font-black text-green-400 uppercase mb-1">Réussites</p>
                <p className="text-xl font-black text-green-700">{selectedImportErrors?.creees}</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setSelectedImportErrors(null)}
              className="w-full bg-slate-900 font-black text-[10px] rounded-2xl uppercase tracking-widest h-12"
            >
              COMPRIS
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {historyFor ? (
        <CommandeHistoriqueDialog commande={historyFor} onClose={() => setHistoryFor(null)} />
      ) : null}
    </main>
  );
}
function CommandeHistoriqueDialog({
  commande,
  onClose,
}: {
  commande: Commande;
  onClose: () => void;
}) {
  const fetchHistory = useServerFn(getCommandeHistorique);
  const { data, isLoading } = useQuery({
    queryKey: ["commande-historique", commande.id],
    queryFn: () => fetchHistory({ data: { commandeId: commande.id } }),
  });
  const rows = (data ?? []) as HistoriqueTravaux[];

  const operationLabel: Record<string, string> = {
    creation: "Création",
    modification: "Modification",
    archivage: "Archivage",
    conflit: "Conflit de réimport",
    resolution: "Résolution",
    report: "Report d'exercice",
  };
  const keyLabel: Record<string, string> = {
    numero_commande: "N° commande",
    annee_exercice: "Année",
    budget: "Budget",
    engage: "Engagé",
    paye: "Payé",
    ecart: "Écart",
    solde: "Solde",
    fournisseur: "Fournisseur",
    lot_code: "Lot",
    descriptif: "Description",
    adresse: "Adresse",
    etat_travaux: "État",
  };
  const displayedKeys = [
    "numero_commande",
    "annee_exercice",
    "budget",
    "engage",
    "paye",
    "ecart",
    "fournisseur",
    "lot_code",
    "descriptif",
    "adresse",
    "etat_travaux",
  ];
  const moneyKeys = new Set(["budget", "engage", "paye", "ecart", "solde"]);
  const fmt = (k: string, v: string | number | boolean | null | undefined) =>
    v === null || v === undefined
      ? "—"
      : typeof v === "number" && moneyKeys.has(k)
        ? money(v)
        : String(v);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="size-4 text-blue-600" />
            Historique — Commande N° {commande.numero_commande}
          </DialogTitle>
          <DialogDescription>
            Année d'exercice : {commande.annee_exercice ?? "—"} · {rows.length} événement(s)
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement de l'historique…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun événement enregistré.</p>
        ) : (
          <div className="space-y-3">
            {rows.map((h) => {
              const avant = h.avant ?? {};
              const apres = h.apres ?? {};
              const isConflit = h.operation === "conflit";
              const isResolution = h.operation === "resolution";
              return (
                <div
                  key={h.id}
                  className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                      {operationLabel[h.operation] ?? h.operation}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold">
                      {new Date(h.created_at).toLocaleString("fr-FR")}
                    </span>
                  </div>

                  {isResolution ? (
                    <p className="text-xs font-bold text-slate-700">
                      Version conservée : {String(apres["version_conservee"] ?? "—")}
                    </p>
                  ) : null}

                  {isConflit ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl bg-white border border-slate-100 p-3 space-y-1">
                        <p className="text-[9px] font-black uppercase text-slate-400">
                          Ancienne version
                        </p>
                        {displayedKeys.map((k) => (
                          <p key={k} className="flex justify-between gap-2">
                            <span className="text-slate-400">{keyLabel[k] ?? k}</span>
                            <span
                              className={
                                String(avant[k]) !== String(apres[k])
                                  ? "text-red-500 font-bold"
                                  : "text-slate-700"
                              }
                            >
                              {fmt(k, avant[k])}
                            </span>
                          </p>
                        ))}
                      </div>
                      <div className="rounded-xl bg-white border border-slate-100 p-3 space-y-1">
                        <p className="text-[9px] font-black uppercase text-slate-400">
                          Nouvelle version
                        </p>
                        {displayedKeys.map((k) => (
                          <p key={k} className="flex justify-between gap-2">
                            <span className="text-slate-400">{keyLabel[k] ?? k}</span>
                            <span
                              className={
                                String(avant[k]) !== String(apres[k])
                                  ? "text-green-600 font-bold"
                                  : "text-slate-700"
                              }
                            >
                              {fmt(k, apres[k])}
                            </span>
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl bg-white border border-slate-100 p-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        {displayedKeys
                          .filter((k) => apres[k] !== null && apres[k] !== undefined)
                          .map((k) => (
                            <p key={k} className="flex justify-between gap-2">
                              <span className="text-slate-400">{keyLabel[k] ?? k}</span>
                              <span className="text-slate-700 font-bold truncate">
                                {fmt(k, apres[k])}
                              </span>
                            </p>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <DialogFooter>
          <Button
            onClick={onClose}
            className="w-full bg-slate-900 font-black text-[10px] rounded-2xl uppercase tracking-widest h-12"
          >
            FERMER
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

