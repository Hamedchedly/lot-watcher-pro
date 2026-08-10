import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend, LabelList } from "recharts";
import { AlertTriangle, ArrowDownUp, FilterX, LayoutDashboard, ListFilter, RotateCcw, Search, Upload, Wrench, MapPin, History, ChevronRight, Info, Building2, Calendar, FileText, User, Euro, CheckCircle2, Edit3, Save, X, AlertCircle, Map as MapIcon, Filter, ArrowUp, ArrowDown, Layers, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import {
  getTravauxDashboard,
  updateCommandeTravaux,
  resolveHistoriqueTravaux,
  type CommandeTravaux,
  type HistoriqueTravaux,
  type TravauxDashboardData,
  type ImportTravaux,
} from "@/lib/travaux.dashboard.functions";

// Fix pour les icônes Leaflet par défaut
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

export const Route = createFileRoute("/dashboard-travaux")({
  head: () => ({ meta: [{ title: "Dashboard suivi travaux" }, { name: "description", content: "Pilotage des commandes de travaux par programmation, secteur et tranche." }] }),
  component: DashboardTravauxPage,
});

type Commande = CommandeTravaux;
const SECTEURS = ["GT", "GE", "CP"] as const;
const SECTOR_COLORS = { GT: "#2563eb", GE: "#0f766e", CP: "#c2410c" };
const PAGE_SIZE = 20;

const money = (value: unknown) => typeof value === "number" ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value) : "—";
const text = (value: unknown) => value == null ? "" : String(value);

const cityOf = (address: unknown) => {
  const value = text(address).trim();
  const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.at(-1) || "Ville non renseignée";
};

const sectorOf = (row: Commande) => {
  const corps_etat = row.corps_etat?.toLowerCase() || "";
  if (["maconnerie", "isolation", "divers", "espaces ext"].some(k => corps_etat.includes(k))) return "GT";
  if (["electricite", "couvertures", "halls", "cages"].some(k => corps_etat.includes(k))) return "GE";
  if (["plomberie", "menuiseries", "toitures", "fermetures", "etancheite"].some(k => corps_etat.includes(k))) return "CP";
  return "GT"; // Par défaut
};

const yearOf = (row: Commande) => {
  const date = row.date_demarrage || row.date_fin_travaux || row.date_communication;
  return date ? date.slice(0, 4) : "Sans année";
};

function Kpi({ label, value, detail, trend }: { label: string; value: string; detail?: string; trend?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm hover:shadow-md transition-shadow">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <p className="text-2xl font-black text-slate-900">{value}</p>
        {trend && <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase tracking-tighter">{trend}</span>}
      </div>
      {detail && <p className="mt-1 text-[10px] font-bold text-slate-400">{detail}</p>}
    </div>
  );
}

function MultiSelect({ label, options, selected, onChange, icon: Icon }: { label: string; options: { label: string; value: string; sub?: string }[]; selected: string[]; onChange: (vals: string[]) => void; icon?: any }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 w-full justify-between text-[10px] font-black uppercase border-slate-200 rounded-xl px-3">
          <div className="flex items-center gap-2 overflow-hidden">
            {Icon && <Icon className="size-3.5 text-slate-400 shrink-0" />}
            <span className="truncate">{selected.length === 0 ? `Tous ${label}` : `${selected.length} ${label}`}</span>
          </div>
          <ChevronRight className="size-3 text-slate-400 rotate-90 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0 rounded-2xl border-slate-200 shadow-2xl" align="start">
        <div className="p-3 border-b bg-slate-50/50 flex items-center justify-between">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{label}</span>
          <Button variant="ghost" size="sm" onClick={() => onChange([])} className="text-[9px] font-black text-blue-600 h-6 px-2">TOUT DÉCOCHER</Button>
        </div>
        <div className="max-h-64 overflow-y-auto p-2 custom-scrollbar space-y-1">
          {options.map(opt => (
            <label key={opt.value} className="flex items-start gap-3 p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors group">
              <Checkbox checked={selected.includes(opt.value)} onCheckedChange={(v) => onChange(v ? [...selected, opt.value] : selected.filter(x => x !== opt.value))} className="mt-0.5" />
              <div className="flex flex-col">
                <span className={`text-[11px] font-black uppercase tracking-tight ${selected.includes(opt.value) ? 'text-blue-600' : 'text-slate-700'}`}>{opt.label}</span>
                {opt.sub && <span className="text-[9px] font-bold text-slate-400 uppercase leading-none mt-0.5">{opt.sub}</span>}
              </div>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function DashboardTravauxPage() {
  const queryClient = useQueryClient();
  const fetchDashboard = useServerFn(getTravauxDashboard);
  const updateCommande = useServerFn(updateCommandeTravaux);
  const resolveHistory = useServerFn(resolveHistoriqueTravaux);
  
  const { data, isLoading } = useQuery<TravauxDashboardData>({ queryKey: ["travaux-dashboard"], queryFn: () => fetchDashboard() });
  
  const allCommandes = data?.commandes ?? [];
  const historique = data?.historique ?? [];
  const recentImports = data?.imports ?? [];
  const tranchesDetails = data?.tranchesDetails ?? [];
  
  // États Filtres
  const [yearRange, setYearRange] = useState<[number, number]>([2020, new Date().getFullYear()]);
  const [progFilter, setProgFilter] = useState({ prog: true, hors: true });
  const [selectedSectors, setSelectedSectors] = useState<string[]>([...SECTEURS]);
  const [selectedTranches, setSelectedTranches] = useState<string[]>([]);
  const [selectedVilles, setSelectedVilles] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showAllTranches, setShowAllTranches] = useState(false);
  const [mapMode, setMapMode] = useState<"map" | "heatmap">("heatmap");

  // États Filtres En-tête Tableau
  const [tableFilters, setTableFilters] = useState<Record<string, any>>({});
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({ key: 'engage', direction: 'desc' });

  // États Modales
  const [drilldownSector, setDrilldownSector] = useState<string | null>(null);
  const [selectedModif, setSelectedModif] = useState<HistoriqueTravaux | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<Commande | null>(null);
  const [selectedImportErrors, setSelectedImportErrors] = useState<ImportTravaux | null>(null);
  const [versionChoice, setVersionChoice] = useState<"A" | "B">("B");
  
  // État Édition
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Commande>>({});

  const mutation = useMutation({
    mutationFn: (variables: { id: string; data: Partial<Commande> }) => updateCommande({ data: variables }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["travaux-dashboard"] });
      setIsEditing(false);
      setSelectedDetail(prev => prev ? { ...prev, ...editForm } as Commande : null);
    }
  });

  const resolveMutation = useMutation({
    mutationFn: (variables: { id: string; keepVersion: "A" | "B"; commandeId: string; data: any }) => resolveHistory({ data: variables }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["travaux-dashboard"] });
      setSelectedModif(null);
    }
  });

  const options = useMemo(() => {
    const years = [...new Set(allCommandes.map(yearOf))].filter(y => y !== "Sans année").map(Number).sort((a, b) => a - b);
    const villes = [...new Set(allCommandes.map(c => cityOf(c.adresse)))].sort().map(v => ({ label: v, value: v }));
    const tranchesMap = new Map<string, { label: string; value: string; sub: string }>();
    allCommandes.forEach(c => {
      if (!c.tranche_code) return;
      if (!tranchesMap.has(c.tranche_code)) {
        const detail = tranchesDetails.find(td => td.code === c.tranche_code);
        tranchesMap.set(c.tranche_code, { label: c.tranche_code, value: c.tranche_code, sub: `${detail?.localite || cityOf(c.adresse)}` });
      }
    });
    const tranches = [...tranchesMap.values()].sort((a, b) => a.value.localeCompare(b.value));
    return { years, tranches, villes };
  }, [allCommandes, tranchesDetails]);

  useEffect(() => {
    if (options.years.length > 0) {
      setYearRange([options.years[0] as number, options.years[options.years.length - 1] as number]);
    }
  }, [options.years]);

  const filtered = useMemo(() => {
    let result = allCommandes.filter((row) => {
      const year = Number(yearOf(row));
      const isProg = !!row.ligne_budget;
      const sect = sectorOf(row);
      const ville = cityOf(row.adresse);
      const matchesYear = isNaN(year) || (year >= yearRange[0] && year <= yearRange[1]);
      const matchesProg = (isProg && progFilter.prog) || (!isProg && progFilter.hors);
      const matchesSect = selectedSectors.includes(sect);
      const matchesTranche = selectedTranches.length === 0 || (row.tranche_code && selectedTranches.includes(row.tranche_code));
      const matchesVille = selectedVilles.length === 0 || selectedVilles.includes(ville);
      const matchesSearch = !search || [row.numero_commande, row.adresse, row.descriptif, row.fournisseur, row.numero_fournisseur].some(v => text(v).toLowerCase().includes(search.toLowerCase()));
      return matchesYear && matchesProg && matchesSect && matchesTranche && matchesVille && matchesSearch;
    });

    Object.entries(tableFilters).forEach(([key, filter]) => {
      if (filter.min !== undefined) result = result.filter(r => (Number((r as any)[key]) || 0) >= filter.min);
      if (filter.max !== undefined) result = result.filter(r => (Number((r as any)[key]) || 0) <= filter.max);
      if (filter.selected && filter.selected.length > 0) result = result.filter(r => filter.selected.includes(String((r as any)[key])));
    });

    if (sortConfig) {
      result.sort((a, b) => {
        const va = (a as any)[sortConfig.key];
        const vb = (b as any)[sortConfig.key];
        if (typeof va === 'number') return sortConfig.direction === 'asc' ? va - vb : vb - va;
        return sortConfig.direction === 'asc' ? text(va).localeCompare(text(vb)) : text(vb).localeCompare(text(va));
      });
    }
    return result;
  }, [allCommandes, yearRange, progFilter, selectedSectors, selectedTranches, selectedVilles, search, tableFilters, sortConfig]);

  const stats = useMemo(() => {
    const budget = filtered.reduce((s, r) => s + (r.budget || 0), 0);
    const engage = filtered.reduce((s, r) => s + (r.engage || 0), 0);
    const count = filtered.length;
    const countProg = filtered.filter(r => !!r.ligne_budget).length;
    const countDone = filtered.filter(r => /termine|clos|acheve/i.test(text(r.etat_travaux || r.etat_commande))).length;
    return { budget, engage, pctHors: count ? Math.round((count - countProg) / count * 100) : 0, pctProg: count ? Math.round(countProg / count * 100) : 0, done: countDone, total: count };
  }, [filtered]);

  const dataSecteur = useMemo(() => SECTEURS.map(s => ({
    name: s,
    value: filtered.filter(r => sectorOf(r) === s).reduce((sum, r) => sum + (r.engage || 0), 0)
  })).filter(d => d.value > 0), [filtered]);

  const dataHeatmap = useMemo(() => {
    const map = filtered.reduce((acc, r) => {
      const city = cityOf(r.adresse);
      acc[city] = (acc[city] || 0) + (r.engage || 0);
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(map).filter(([_, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const dataTranche = useMemo(() => {
    const map = filtered.reduce((acc, r) => {
      const t = r.tranche_code || "Sans tranche";
      if (!acc[t]) acc[t] = { engage: 0, adresse: r.adresse || "Adresse inconnue" };
      acc[t].engage += (r.engage || 0);
      return acc;
    }, {} as Record<string, { engage: number; adresse: string }>);
    const total = stats.engage || 1;
    return Object.entries(map).map(([name, data]) => ({ name, value: data.engage, adresse: data.adresse, pct: (data.engage / total * 100).toFixed(1) })).sort((a, b) => b.value - a.value).slice(0, showAllTranches ? 20 : 5);
  }, [filtered, stats.engage, showAllTranches]);

  const dataDrilldown = useMemo(() => {
    if (!drilldownSector) return [];
    const map = filtered.filter(r => sectorOf(r) === drilldownSector).reduce((acc, r) => {
      const c = r.corps_etat || "Non renseigné";
      acc[c] = (acc[c] || 0) + (r.engage || 0);
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filtered, drilldownSector]);

  const historyMap = useMemo(() => {
    const map = new Map<string, HistoriqueTravaux>();
    historique.forEach(h => { if (!h.resolu && !map.has(h.commande_id)) map.set(h.commande_id, h); });
    return map;
  }, [historique]);

  const reset = () => {
    if (options.years.length > 0) setYearRange([options.years[0] as number, options.years[options.years.length - 1] as number]);
    setProgFilter({ prog: true, hors: true });
    setSelectedSectors([...SECTEURS]);
    setSelectedTranches([]);
    setSelectedVilles([]);
    setSearch("");
    setTableFilters({});
    setPage(1);
  };

  const handleLastYear = () => {
    const last = options.years[options.years.length - 1];
    if (last) setYearRange([last, last]);
  };

  const handleEditStart = () => { if (!selectedDetail) return; setEditForm({ ...selectedDetail }); setIsEditing(true); };
  const handleSave = () => { if (!selectedDetail?.id) return; mutation.mutate({ id: selectedDetail.id, data: editForm }); };

  const handleResolve = () => {
    if (!selectedModif) return;
    const dataToKeep = versionChoice === "A" ? selectedModif.avant : selectedModif.apres;
    resolveMutation.mutate({ id: selectedModif.id, keepVersion: versionChoice, commandeId: selectedModif.commande_id, data: dataToKeep });
  };

  const toggleSort = (key: string) => {
    setSortConfig(prev => prev?.key === key ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'desc' });
  };

  if (isLoading) return <div className="flex h-screen items-center justify-center bg-slate-50 font-black text-slate-300 uppercase tracking-widest">Initialisation du Dashboard Pro...</div>;

  return (
    <main className="min-h-screen bg-slate-50/50 pb-12 text-slate-900 font-sans">
      <header className="sticky top-0 z-20 border-b bg-white/90 backdrop-blur-lg shadow-sm">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg text-white shadow-blue-200 shadow-lg"><Wrench className="size-5" /></div>
            <div>
              <h1 className="text-lg font-black tracking-tight uppercase">TRAVAUX ANALYTICS</h1>
              <p className="text-[9px] text-muted-foreground font-black uppercase tracking-widest">Pilotage Patrimonial</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            {recentImports.length > 0 && (
              <div className="hidden md:flex items-center gap-3 border-r pr-6">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Dernier Import :</span>
                <button onClick={() => setSelectedImportErrors(recentImports[0] || null)} className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[9px] font-black uppercase transition-all ${(recentImports[0]?.erreurs || 0) > 0 ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600'}`}>
                  {(recentImports[0]?.erreurs || 0) > 0 ? <AlertCircle className="size-3" /> : <CheckCircle2 className="size-3" />}
                  {recentImports[0]?.erreurs || 0} ERREURS
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <Button asChild variant="ghost" size="sm" className="font-black text-[10px] tracking-widest"><Link to="/">ACCUEIL</Link></Button>
              <Button asChild size="sm" className="bg-slate-900 hover:bg-slate-800 text-[10px] font-black tracking-widest px-4"><Link to="/import-travaux"><Upload className="size-3.5 mr-2" /> NOUVEL IMPORT</Link></Button>
            </div>
          </div>
        </div>
      </header>

      <div className="px-4 py-6 space-y-6 max-w-full">
        {/* SECTION FILTRES */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest"><ListFilter className="size-4" /> Filtres de Pilotage</div>
            <Button variant="ghost" size="sm" onClick={reset} className="text-[9px] font-black text-slate-400 hover:text-red-500 uppercase tracking-widest"><RotateCcw className="size-3 mr-1" /> RÉINITIALISER</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <div className="space-y-4">
              <Label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Période (Slider)</Label>
              <div className="px-2 pt-2">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{yearRange[0]}</span>
                  <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{yearRange[1]}</span>
                </div>
                <div className="relative h-6 flex items-center">
                  <input type="range" min={options.years[0] || 2020} max={options.years[options.years.length - 1] || new Date().getFullYear()} value={yearRange[0]} onChange={(e) => setYearRange([Math.min(Number(e.target.value), yearRange[1]), yearRange[1]])} className="absolute w-full h-1.5 bg-slate-100 rounded-full appearance-none cursor-pointer accent-blue-600 z-10" />
                  <input type="range" min={options.years[0] || 2020} max={options.years[options.years.length - 1] || new Date().getFullYear()} value={yearRange[1]} onChange={(e) => setYearRange([yearRange[0], Math.max(Number(e.target.value), yearRange[0])])} className="absolute w-full h-1.5 bg-transparent appearance-none cursor-pointer accent-blue-600 z-20" />
                </div>
              </div>
            </div>
            <div className="space-y-3"><Label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Multi-Sélection Tranches</Label><MultiSelect label="Tranches" options={options.tranches} selected={selectedTranches} onChange={setSelectedTranches} icon={Layers} /></div>
            <div className="space-y-3"><Label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Multi-Sélection Villes</Label><MultiSelect label="Villes" options={options.villes} selected={selectedVilles} onChange={setSelectedVilles} icon={MapPin} /></div>
            <div className="space-y-3">
              <Label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Secteur & Programmation</Label>
              <div className="flex flex-wrap gap-2">
                {SECTEURS.map(s => (<button key={s} onClick={() => setSelectedSectors(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])} className={`px-2 py-1 rounded-lg text-[9px] font-black transition-all border ${selectedSectors.includes(s) ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>{s}</button>))}
                <div className="w-full h-px bg-slate-100 my-1" />
                <button onClick={() => setProgFilter(p => ({ ...p, prog: !p.prog }))} className={`px-2 py-1 rounded-lg text-[9px] font-black transition-all border ${progFilter.prog ? 'bg-green-600 text-white border-green-600 shadow-md' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>PROG.</button>
                <button onClick={() => setProgFilter(p => ({ ...p, hors: !p.hors }))} className={`px-2 py-1 rounded-lg text-[9px] font-black transition-all border ${progFilter.hors ? 'bg-orange-600 text-white border-orange-600 shadow-md' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>HORS</button>
              </div>
            </div>
            <div className="space-y-3">
              <Label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Recherche Rapide</Label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 size-3.5 text-slate-400" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="CMD, ADRESSE..." className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-4 text-[10px] font-black uppercase focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
            </div>
          </div>
        </section>

        {/* KPIs */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Kpi label="Engagé Total" value={money(stats.engage)} trend="ACTUEL" />
          <Kpi label="Budget Prévu" value={money(stats.budget)} trend="CIBLE" />
          <Kpi label="% Programmation" value={`${stats.pctProg}%`} trend="QUALITÉ" />
          <Kpi label="Commandes" value={stats.total.toString()} detail={`${stats.done} terminées`} trend="FLUX" />
        </section>

        {/* CARTE & GRAPHIQUES */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <article className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-6 shadow-sm overflow-hidden relative min-h-[450px]">
            <div className="flex items-center justify-between mb-6 relative z-10">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2"><MapIcon className="size-4 text-blue-600" /> Cartographie vs Heatmap</h3>
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button onClick={() => setMapMode("map")} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${mapMode === "map" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}><MapIcon className="size-3 mr-1.5 inline" /> Carte</button>
                <button onClick={() => setMapMode("heatmap")} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${mapMode === "heatmap" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}><BarChart3 className="size-3 mr-1.5 inline" /> Heatmap</button>
              </div>
            </div>
            {mapMode === "map" ? (
              <div className="absolute inset-0 z-0">
                <MapContainer center={[48.8566, 2.3522]} zoom={10} className="h-full w-full grayscale-[0.5] contrast-[1.2]">
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  {dataHeatmap.map(([city, val]) => (
                    <Marker key={city} position={[48.8566 + (Math.random() - 0.5) * 0.1, 2.3522 + (Math.random() - 0.5) * 0.1]}>
                      <Popup><div className="p-2 font-sans"><p className="text-[10px] font-black uppercase text-slate-400 mb-1">{city}</p><p className="text-sm font-black text-blue-600">{money(val)}</p></div></Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>
            ) : (
              <div className="space-y-4 h-[350px] overflow-y-auto pr-2 custom-scrollbar mt-4">
                {dataHeatmap.map(([city, val], idx) => {
                  const max = dataHeatmap[0]?.[1] || 1;
                  const pct = (val / max) * 100;
                  const color = pct > 70 ? 'bg-red-500' : pct > 30 ? 'bg-blue-500' : 'bg-blue-200';
                  return (
                    <div key={city} className="group relative">
                      <div className="flex items-center justify-between mb-1"><span className="text-[10px] font-black text-slate-700 uppercase truncate max-w-[200px]">{city}</span><span className="text-[10px] font-black text-slate-900">{money(val)}</span></div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all duration-1000 ${color}`} style={{ width: `${pct}%` }} /></div>
                    </div>
                  );
                })}
              </div>
            )}
          </article>
          <article className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6"><h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Répartition Type</h3><Filter className="size-3.5 text-slate-300" /></div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={dataSecteur} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={10} onClick={(e) => setDrilldownSector(e.name)} className="cursor-pointer">
                    {dataSecteur.map((entry) => <Cell key={entry.name} fill={SECTOR_COLORS[entry.name as keyof typeof SECTOR_COLORS]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => money(v)} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 'bold' }} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '9px', fontWeight: 'black', textTransform: 'uppercase', letterSpacing: '0.1em' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-4 text-[9px] text-center text-slate-400 font-black uppercase tracking-widest">Cliquez pour voir les corps d'état</p>
          </article>
        </div>

        {/* Classement Tranches */}
        <article className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6"><h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Classement des Tranches (Top Engagé)</h3><Button variant="outline" size="sm" onClick={() => setShowAllTranches(!showAllTranches)} className="text-[9px] font-black uppercase tracking-widest border-slate-200 rounded-xl">{showAllTranches ? "TOP 5" : "TOP 20"}</Button></div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataTranche} layout="vertical" margin={{ left: 20, right: 100 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" fontSize={9} fontWeight="black" width={100} axisLine={false} tickLine={false} />
                <Tooltip content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0]?.payload;
                    return (<div className="bg-slate-900 text-white p-3 rounded-2xl shadow-2xl border-none"><p className="text-[10px] font-black uppercase mb-1">{d.name}</p><p className="text-[9px] font-bold text-slate-400 uppercase mb-2">{d.adresse}</p><p className="text-xs font-black text-blue-400">{money(d.value)}</p></div>);
                  }
                  return null;
                }} />
                <Bar dataKey="value" fill="#2563eb" radius={[0, 8, 8, 0]} barSize={25}>
                  <LabelList dataKey="value" position="right" formatter={(v: number) => money(v)} className="text-[9px] font-black fill-slate-900" />
                  {dataTranche.map((entry, index) => <Cell key={`cell-${index}`} fill={index === 0 ? "#1e40af" : "#3b82f6"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        {/* JOURNAL DES COMMANDES */}
        <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b bg-slate-50/50 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3"><h3 className="text-[10px] font-black uppercase tracking-widest text-slate-900">Journal des Commandes</h3><Badge className="bg-slate-200 text-slate-700 text-[9px] font-black uppercase tracking-tighter rounded-lg">{filtered.length} LIGNES</Badge></div>
            <div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={handleLastYear} className="text-[9px] font-black uppercase tracking-widest border-slate-200 rounded-lg h-8">DERNIÈRE ANNÉE</Button></div>
          </div>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-[10px] border-collapse">
              <thead className="bg-slate-50 border-b text-slate-400 font-black uppercase tracking-widest">
                <tr>
                  <th className="p-4 w-20">Année</th>
                  <th className="p-4 w-32"><button onClick={() => toggleSort('numero_commande')} className="flex items-center gap-1 hover:text-blue-600 transition-colors">N° Commande {sortConfig?.key === 'numero_commande' && (sortConfig.direction === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}</button></th>
                  <th className="p-4 w-24">Tranche</th>
                  <th className="p-4 w-48">Adresse</th>
                  <th className="p-4 w-56">Descriptif</th>
                  <th className="p-4 w-24">Type</th>
                  <th className="p-4 w-28">Entreprise</th>
                  <th className="p-4 w-32 text-right">
                    <Popover><PopoverTrigger asChild><button className="flex items-center gap-1 ml-auto hover:text-blue-600">Engagé <Filter className="size-3" /></button></PopoverTrigger><PopoverContent className="w-64 p-4 rounded-2xl"><Label className="text-[9px] font-black uppercase mb-4 block">Plage Engagé (€)</Label><div className="space-y-4"><Input type="number" placeholder="Min" onChange={(e) => setTableFilters(p => ({ ...p, engage: { ...p['engage'], min: Number(e.target.value) || undefined } }))} className="h-8 text-[10px] font-black" /><Input type="number" placeholder="Max" onChange={(e) => setTableFilters(p => ({ ...p, engage: { ...p['engage'], max: Number(e.target.value) || undefined } }))} className="h-8 text-[10px] font-black" /></div></PopoverContent></Popover>
                  </th>
                  <th className="p-4 w-32 text-right">Payé</th>
                  <th className="p-4 w-16 text-center">Prog.</th>
                  <th className="p-4 w-24">État</th>
                  <th className="p-4 w-12 text-center">ACT.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE).map((row) => {
                  const modif = historyMap.get(row.id);
                  const sect = sectorOf(row);
                  const isProg = !!row.ligne_budget;
                  return (
                    <tr key={row.id} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="p-4 font-bold text-slate-400">{yearOf(row)}</td>
                      <td className="p-4 font-black text-blue-600 truncate"><button onClick={() => setSelectedDetail(row)} className="hover:underline flex items-center gap-1">{row.numero_commande}<Info className="size-3 opacity-0 group-hover:opacity-100" /></button></td>
                      <td className="p-4 font-black text-slate-700 truncate"><Link to="/adresses" search={{ q: "", ville: undefined, tranche: row.tranche_code || undefined, rue: undefined, adresse: undefined }} className="hover:underline">{row.tranche_code || "—"}</Link></td>
                      <td className="p-4 font-bold text-slate-600 truncate uppercase">{row.adresse || "—"}</td>
                      <td className="p-4 text-slate-500 truncate">{row.descriptif || "—"}</td>
                      <td className="p-4"><span className={`px-2 py-0.5 rounded text-[8px] font-black ${sect === 'GT' ? 'bg-blue-100 text-blue-700' : sect === 'GE' ? 'bg-teal-100 text-teal-700' : 'bg-orange-100 text-orange-700'}`}>{sect}</span></td>
                      <td className="p-4 font-bold text-slate-500 truncate">{row.numero_fournisseur || "—"}</td>
                      <td className="p-4 text-right font-black text-slate-900">{money(row.engage)}</td>
                      <td className="p-4 text-right text-slate-600">{money(row.paye)}</td>
                      <td className="p-4 text-center"><div className={`mx-auto size-2 rounded-full ${isProg ? 'bg-green-500 shadow-green-200' : 'bg-slate-300'} shadow-sm`} /></td>
                      <td className="p-4 truncate"><span className="text-slate-400 font-black uppercase text-[8px]">{row.etat_travaux || row.etat_commande || "—"}</span></td>
                      <td className="p-4 text-center">{modif ? <button onClick={() => { setSelectedModif(modif); setVersionChoice("B"); }} className="text-amber-500 hover:scale-110"><AlertTriangle className="size-4 fill-amber-50" /></button> : <div className="size-4 mx-auto rounded-full border-2 border-slate-100 group-hover:border-slate-200" />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="p-4 bg-slate-50/50 border-t flex items-center justify-between"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">PAGE {page} SUR {Math.ceil(filtered.length / PAGE_SIZE) || 1}</span><div className="flex gap-2"><Button variant="outline" size="sm" className="h-8 font-black text-[9px] rounded-xl uppercase tracking-widest" disabled={page === 1} onClick={() => setPage(p => p - 1)}>PRÉCÉDENT</Button><Button variant="outline" size="sm" className="h-8 font-black text-[9px] rounded-xl uppercase tracking-widest" disabled={page * PAGE_SIZE >= filtered.length} onClick={() => setPage(p => p + 1)}>SUIVANT</Button></div></div>
        </section>
      </div>

      {/* MODALE FICHE DÉTAILLÉE ÉDITABLE */}
      <Dialog open={!!selectedDetail} onOpenChange={(o) => { if (!o) { setSelectedDetail(null); setIsEditing(false); } }}>
        <DialogContent className="max-w-5xl rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-slate-900 p-8 text-white relative">
            <div className="bg-slate-800/50 rounded-2xl p-4 mb-6 border border-white/5"><p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Descriptif complet</p>{isEditing ? (<Textarea value={editForm.descriptif || ""} onChange={(e) => setEditForm(p => ({ ...p, descriptif: e.target.value }))} className="bg-slate-800 border-slate-700 text-xs font-medium text-white min-h-[60px] rounded-xl" />) : (<p className="text-xs text-slate-300 leading-relaxed font-medium">{selectedDetail?.descriptif || "Aucun descriptif renseigné."}</p>)}</div>
            <div className="mb-6"><h2 className="text-2xl font-black uppercase tracking-tighter mb-1">Fiche Commande #{selectedDetail?.numero_commande}</h2><p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">Détail exhaustif & Édition Directe</p></div>
            <div className="flex items-center justify-between mb-8">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-8 flex-1">
                <div className="space-y-1"><p className="text-[9px] font-black text-slate-500 uppercase">Type</p>{isEditing ? (<select value={editForm.secteur || ""} onChange={(e) => setEditForm(p => ({ ...p, secteur: e.target.value }))} className="bg-slate-800 border-slate-700 text-xs font-black w-full rounded p-1 outline-none"><option value="GT">GT</option><option value="GE">GE</option><option value="CP">CP</option></select>) : (<p className="text-sm font-black">{selectedDetail ? sectorOf(selectedDetail) : "—"}</p>)}</div>
                <div className="space-y-1"><p className="text-[9px] font-black text-slate-500 uppercase">Tranche</p><p className="text-sm font-black text-blue-400"><Link to="/adresses" search={{ q: "", ville: undefined, tranche: selectedDetail?.tranche_code || undefined, rue: undefined, adresse: undefined }} className="hover:underline">{selectedDetail?.tranche_code || "—"}</Link></p></div>
                <div className="space-y-1"><p className="text-[9px] font-black text-slate-500 uppercase">ID Lot</p>{isEditing ? (<Input value={editForm.lot_code || ""} onChange={(e) => setEditForm(p => ({ ...p, lot_code: e.target.value }))} className="bg-slate-800 border-slate-700 text-xs font-black h-7 rounded-lg" />) : (<p className="text-sm font-black text-teal-400">{selectedDetail?.lot_code ? (<Link to="/adresses" search={{ q: selectedDetail.lot_code, ville: undefined, tranche: undefined, rue: undefined, adresse: undefined }} className="hover:underline flex items-center gap-1">{selectedDetail.lot_code} <ChevronRight className="size-3" /></Link>) : "Non rattaché"}</p>)}</div>
                <div className="space-y-1"><p className="text-[9px] font-black text-slate-500 uppercase">État</p>{isEditing ? (<Input value={editForm.etat_travaux || ""} onChange={(e) => setEditForm(p => ({ ...p, etat_travaux: e.target.value }))} className="bg-slate-800 border-slate-700 text-xs font-black h-7 rounded-lg" />) : (<p className="text-sm font-black uppercase text-amber-400">{selectedDetail?.etat_travaux || selectedDetail?.etat_commande || "—"}</p>)}</div>
                <div className="space-y-1"><p className="text-[9px] font-black text-slate-500 uppercase">Prog.</p><p className="text-sm font-black uppercase">{selectedDetail?.ligne_budget ? "Programmée" : "Hors Budget"}</p></div>
              </div>
              <div className="ml-8">{!isEditing ? (<Button onClick={handleEditStart} variant="outline" className="bg-white/10 border-white/20 hover:bg-white/20 text-white font-black text-[10px] uppercase tracking-widest rounded-xl"><Edit3 className="size-3.5 mr-2" /> MODIFIER</Button>) : (<div className="flex gap-2"><Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-500 text-white font-black text-[10px] uppercase tracking-widest rounded-xl"><Save className="size-3.5 mr-2" /> SAUVER</Button><Button onClick={() => setIsEditing(false)} variant="ghost" className="text-white font-black text-[10px] uppercase tracking-widest rounded-xl">ANNULER</Button></div>)}</div>
            </div>
          </div>
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-12 bg-white">
            <div className="space-y-8">
              <section><h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 mb-4"><Building2 className="size-4 text-blue-600" /> Localisation & Nature</h3><div className="space-y-4"><div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-[10px] font-bold text-slate-400 uppercase">Adresse</span>{isEditing ? <Input value={editForm.adresse || ""} onChange={(e) => setEditForm(p => ({ ...p, adresse: e.target.value }))} className="text-xs font-black h-7 w-48 rounded-lg" /> : <span className="text-xs font-black text-slate-700">{selectedDetail?.adresse || "—"}</span>}</div><div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-[10px] font-bold text-slate-400 uppercase">Corps d'état</span>{isEditing ? <Input value={editForm.corps_etat || ""} onChange={(e) => setEditForm(p => ({ ...p, corps_etat: e.target.value }))} className="text-xs font-black h-7 w-48 rounded-lg" /> : <span className="text-xs font-black text-slate-700">{selectedDetail?.corps_etat || "—"}</span>}</div></div></section>
              <section><h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 mb-4"><User className="size-4 text-blue-600" /> Intervenants</h3><div className="space-y-4"><div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-[10px] font-bold text-slate-400 uppercase">Entreprise</span>{isEditing ? (<div className="flex gap-2"><Input value={editForm.fournisseur || ""} onChange={(e) => setEditForm(p => ({ ...p, fournisseur: e.target.value }))} className="text-xs font-black h-7 w-32 rounded-lg" /><Input value={editForm.numero_fournisseur || ""} onChange={(e) => setEditForm(p => ({ ...p, numero_fournisseur: e.target.value }))} className="text-xs font-black h-7 w-16 rounded-lg" /></div>) : <span className="text-xs font-black text-slate-700">{selectedDetail?.fournisseur || "—"} ({selectedDetail?.numero_fournisseur})</span>}</div></div></section>
            </div>
            <div className="space-y-8">
              <section><h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 mb-4"><Euro className="size-4 text-blue-600" /> Finance</h3><div className="grid grid-cols-2 gap-4"><div className="bg-slate-50 p-4 rounded-2xl"><p className="text-[9px] font-black text-slate-400 uppercase">Engagé</p>{isEditing ? <Input type="number" value={editForm.engage || 0} onChange={(e) => setEditForm(p => ({ ...p, engage: Number(e.target.value) }))} className="text-xs font-black h-7 rounded-lg" /> : <p className="text-lg font-black text-blue-700">{money(selectedDetail?.engage)}</p>}</div><div className="bg-slate-50 p-4 rounded-2xl"><p className="text-[9px] font-black text-slate-400 uppercase">Payé</p>{isEditing ? <Input type="number" value={editForm.paye || 0} onChange={(e) => setEditForm(p => ({ ...p, paye: Number(e.target.value) }))} className="text-xs font-black h-7 rounded-lg" /> : <p className="text-lg font-black">{money(selectedDetail?.paye)}</p>}</div></div></section>
            </div>
          </div>
          <DialogFooter className="p-6 bg-white border-t"><Button onClick={() => { setSelectedDetail(null); setIsEditing(false); }} className="w-full bg-slate-900 font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl h-12">FERMER LA FICHE</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DRILL-DOWN SECTEUR */}
      <Dialog open={!!drilldownSector} onOpenChange={(o) => !o && setDrilldownSector(null)}>
        <DialogContent className="max-w-xl rounded-3xl border-none shadow-2xl">
          <DialogHeader><DialogTitle className="text-lg font-black uppercase tracking-tight">Détail : {drilldownSector}</DialogTitle><DialogDescription className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Répartition Engagé par Corps d'état</DialogDescription></DialogHeader>
          <div className="py-4 space-y-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
            {dataDrilldown.map((d, i) => (<div key={d.name} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-blue-200 transition-colors"><div className="flex items-center gap-3"><span className="text-[9px] font-black text-slate-300">#0{i+1}</span><span className="text-[10px] font-black text-slate-700 uppercase">{d.name}</span></div><span className="text-[10px] font-black text-blue-600">{money(d.value)}</span></div>))}
          </div>
          <DialogFooter><Button onClick={() => setDrilldownSector(null)} className="w-full bg-slate-900 font-black text-[10px] rounded-xl uppercase tracking-widest h-12">FERMER</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ALERTE MODIFICATIONS (⚠️) */}
      <Dialog open={!!selectedModif} onOpenChange={(o) => !o && setSelectedModif(null)}>
        <DialogContent className="max-w-4xl rounded-3xl overflow-hidden p-0 border-none shadow-2xl">
          <div className="bg-amber-500 p-6 text-white"><div className="flex items-center gap-3"><AlertTriangle className="size-8" /><div><h2 className="text-xl font-black uppercase tracking-tight">Alerte Modification Détectée</h2><p className="text-[10px] font-black opacity-80 uppercase tracking-widest">Commande N° {(selectedModif as any)?.travaux_commandes?.numero_commande || "—"}</p></div></div></div>
          <div className="p-8 space-y-8 bg-white">
            <div className="grid grid-cols-2 gap-8">
              <div className={`rounded-2xl border-2 p-6 transition-all ${versionChoice === 'A' ? 'border-blue-600 bg-blue-50/30 ring-4 ring-blue-50' : 'border-slate-100 bg-slate-50'}`}><div className="flex items-center justify-between mb-4"><span className="text-[9px] font-black uppercase tracking-widest text-slate-400">VERSION A (ORIGINAL)</span><RadioGroup value={versionChoice} onValueChange={(v) => setVersionChoice(v as "A" | "B")}><div className="flex items-center space-x-2"><RadioGroupItem value="A" id="vA" /><Label htmlFor="vA" className="text-[10px] font-black cursor-pointer uppercase">GARDER A</Label></div></RadioGroup></div><div className="space-y-3">{selectedModif?.avant && Object.entries(selectedModif.avant).map(([k, v]) => (<div key={k} className="flex justify-between text-[10px] border-b border-slate-100 pb-1"><span className="text-slate-400 font-black uppercase tracking-tighter">{k.replace(/_/g, ' ')}</span><span className="text-slate-900 font-bold">{text(v)}</span></div>))}</div></div>
              <div className={`rounded-2xl border-2 p-6 transition-all ${versionChoice === 'B' ? 'border-blue-600 bg-blue-50/30 ring-4 ring-blue-50' : 'border-slate-100 bg-slate-50'}`}><div className="flex items-center justify-between mb-4"><span className="text-[9px] font-black uppercase tracking-widest text-slate-400">VERSION B (MODIFIÉ)</span><RadioGroup value={versionChoice} onValueChange={(v) => setVersionChoice(v as "A" | "B")}><div className="flex items-center space-x-2"><RadioGroupItem value="B" id="vB" /><Label htmlFor="vB" className="text-[10px] font-black cursor-pointer uppercase">GARDER B</Label></div></RadioGroup></div><div className="space-y-3">{selectedModif?.apres && Object.entries(selectedModif.apres).map(([k, v]) => { const changed = JSON.stringify(selectedModif.avant?.[k]) !== JSON.stringify(v); return (<div key={k} className={`flex justify-between text-[10px] border-b border-slate-100 pb-1 ${changed ? 'text-blue-600 font-black bg-blue-50 -mx-2 px-2 rounded' : ''}`}><span className="text-slate-400 font-black uppercase tracking-tighter">{k.replace(/_/g, ' ')}</span><span>{text(v)}</span></div>); })}</div></div>
            </div>
            <div className="flex gap-4"><Button className="flex-1 h-12 bg-slate-900 hover:bg-slate-800 text-white font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl shadow-xl" onClick={handleResolve}>VALIDER LA DÉCISION</Button><Button variant="ghost" className="h-12 px-8 font-black text-[11px] uppercase tracking-widest rounded-2xl" onClick={() => setSelectedModif(null)}>ANNULER</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ERREURS IMPORT */}
      <Dialog open={!!selectedImportErrors} onOpenChange={(o) => !o && setSelectedImportErrors(null)}>
        <DialogContent className="max-w-2xl rounded-3xl border-none shadow-2xl">
          <DialogHeader><DialogTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2 text-red-600"><AlertCircle className="size-5" /> Analyse des Erreurs d'Import</DialogTitle><DialogDescription className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fichier : {selectedImportErrors?.fichier}</DialogDescription></DialogHeader>
          <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
            <div className="bg-red-50 p-5 rounded-2xl border border-red-100 text-xs text-red-800 font-bold uppercase tracking-tight leading-relaxed">{selectedImportErrors?.erreurs} lignes ont été rejetées car le numéro de commande était manquant ou les données financières étaient corrompues.</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100"><p className="text-[9px] font-black text-slate-400 uppercase mb-1">Total Scanné</p><p className="text-xl font-black text-slate-900">{selectedImportErrors?.lignes}</p></div>
              <div className="p-4 rounded-2xl bg-green-50 border border-green-100"><p className="text-[9px] font-black text-green-400 uppercase mb-1">Réussites</p><p className="text-xl font-black text-green-700">{selectedImportErrors?.creees}</p></div>
            </div>
          </div>
          <DialogFooter><Button onClick={() => setSelectedImportErrors(null)} className="w-full bg-slate-900 font-black text-[10px] rounded-2xl uppercase tracking-widest h-12">COMPRIS</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
