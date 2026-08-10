import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { AlertTriangle, ArrowDownUp, FilterX, LayoutDashboard, ListFilter, RotateCcw, Search, Upload, Wrench, MapPin, History, ChevronRight, Info, Building2, Calendar, FileText, User, Euro, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  getTravauxDashboard,
  type CommandeTravaux,
  type HistoriqueTravaux,
  type TravauxDashboardData,
} from "@/lib/travaux.dashboard.functions";

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

// Helper pour extraire la ville
const cityOf = (address: unknown) => {
  const value = text(address).trim();
  const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.at(-1) || "Ville non renseignée";
};

// Helper pour le secteur (logique identique à l'import)
const sectorOf = (row: Commande) => {
  const corps_etat = row.corps_etat?.toLowerCase() || "";
  if (["maconnerie", "isolation", "divers", "espaces ext"].some(k => corps_etat.includes(k))) return "GT";
  if (["electricite", "couvertures", "halls", "cages"].some(k => corps_etat.includes(k))) return "GE";
  if (["plomberie", "menuiseries", "toitures", "fermetures", "etancheite"].some(k => corps_etat.includes(k))) return "CP";
  return "GT"; // Par défaut
};

// Helper pour l'année
const yearOf = (row: Commande) => {
  const date = row.date_demarrage || row.date_fin_travaux || row.date_communication;
  return date ? date.slice(0, 4) : "Sans année";
};

function Kpi({ label, value, detail, trend }: { label: string; value: string; detail?: string; trend?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm hover:shadow-md transition-shadow">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <p className="text-2xl font-black text-slate-900">{value}</p>
        {trend && <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase tracking-tighter">{trend}</span>}
      </div>
      {detail && <p className="mt-1 text-[10px] font-bold text-slate-400">{detail}</p>}
    </div>
  );
}

function DashboardTravauxPage() {
  const fetchDashboard = useServerFn(getTravauxDashboard);
  const { data, isLoading, error } = useQuery<TravauxDashboardData>({ queryKey: ["travaux-dashboard"], queryFn: () => fetchDashboard() });
  
  const allCommandes = data?.commandes ?? [];
  const historique = data?.historique ?? [];
  
  // États Filtres
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [progFilter, setProgFilter] = useState({ prog: true, hors: true });
  const [selectedSectors, setSelectedSectors] = useState<string[]>([...SECTEURS]);
  const [selectedTranche, setSelectedTranche] = useState("Toutes");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showAllTranches, setShowAllTranches] = useState(false);

  // États Modales
  const [drilldownSector, setDrilldownSector] = useState<string | null>(null);
  const [selectedModif, setSelectedModif] = useState<HistoriqueTravaux | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<Commande | null>(null);
  const [versionChoice, setVersionChoice] = useState<"A" | "B">("B");

  const options = useMemo(() => {
    const years = [...new Set(allCommandes.map(yearOf))].filter(y => y !== "Sans année").sort((a, b) => b.localeCompare(a));
    const tranches = [...new Set(allCommandes.map(c => c.tranche_code).filter(Boolean))].sort() as string[];
    return { years, tranches };
  }, [allCommandes]);

  const filtered = useMemo(() => {
    return allCommandes.filter((row) => {
      const year = yearOf(row);
      const isProg = !!row.ligne_budget;
      const sect = sectorOf(row);
      
      const matchesYear = selectedYears.length === 0 || selectedYears.includes(year);
      const matchesProg = (isProg && progFilter.prog) || (!isProg && progFilter.hors);
      const matchesSect = selectedSectors.includes(sect);
      const matchesTranche = selectedTranche === "Toutes" || row.tranche_code === selectedTranche;
      const matchesSearch = !search || [row.numero_commande, row.adresse, row.descriptif, row.fournisseur, row.numero_fournisseur].some(v => text(v).toLowerCase().includes(search.toLowerCase()));

      return matchesYear && matchesProg && matchesSect && matchesTranche && matchesSearch;
    });
  }, [allCommandes, selectedYears, progFilter, selectedSectors, selectedTranche, search]);

  const stats = useMemo(() => {
    const budget = filtered.reduce((s, r) => s + (r.budget || 0), 0);
    const engage = filtered.reduce((s, r) => s + (r.engage || 0), 0);
    const count = filtered.length;
    const countProg = filtered.filter(r => !!r.ligne_budget).length;
    const countDone = filtered.filter(r => /termine|clos|acheve/i.test(text(r.etat_travaux || r.etat_commande))).length;
    
    return { 
      budget, 
      engage, 
      pctHors: count ? Math.round((count - countProg) / count * 100) : 0,
      pctProg: count ? Math.round(countProg / count * 100) : 0,
      done: countDone,
      total: count
    };
  }, [filtered]);

  // Données Graphiques
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
    return Object.entries(map)
      .filter(([_, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const dataTranche = useMemo(() => {
    const map = filtered.reduce((acc, r) => {
      const t = r.tranche_code || "Sans tranche";
      acc[t] = (acc[t] || 0) + (r.engage || 0);
      return acc;
    }, {} as Record<string, number>);
    const total = stats.engage || 1;
    return Object.entries(map)
      .map(([name, value]) => ({ name, value, pct: (value / total * 100).toFixed(1) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, showAllTranches ? 20 : 5);
  }, [filtered, stats.engage, showAllTranches]);

  const dataDrilldown = useMemo(() => {
    if (!drilldownSector) return [];
    const map = filtered
      .filter(r => sectorOf(r) === drilldownSector)
      .reduce((acc, r) => {
        const c = r.corps_etat || "Non renseigné";
        acc[c] = (acc[c] || 0) + (r.engage || 0);
        return acc;
      }, {} as Record<string, number>);
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filtered, drilldownSector]);

  const historyMap = useMemo(() => {
    const map = new Map<string, HistoriqueTravaux>();
    historique.forEach(h => {
      if (!map.has(h.commande_id)) map.set(h.commande_id, h);
    });
    return map;
  }, [historique]);

  const reset = () => {
    setSelectedYears([]);
    setProgFilter({ prog: true, hors: true });
    setSelectedSectors([...SECTEURS]);
    setSelectedTranche("Toutes");
    setSearch("");
    setPage(1);
  };

  if (isLoading) return <div className="flex h-screen items-center justify-center bg-slate-50 font-black text-slate-300 uppercase tracking-widest">Initialisation du Dashboard Pro...</div>;

  return (
    <main className="min-h-screen bg-slate-50/50 pb-12 text-slate-900 font-sans">
      {/* Header Builder.io Style */}
      <header className="sticky top-0 z-20 border-b bg-white/90 backdrop-blur-lg shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg text-white shadow-blue-200 shadow-lg">
              <Wrench className="size-5" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight uppercase">TRAVAUX ANALYTICS</h1>
              <p className="text-[9px] text-muted-foreground font-black uppercase tracking-widest">Pilotage Immobilier Pro</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="ghost" size="sm" className="font-black text-[10px] tracking-widest"><Link to="/">ACCUEIL</Link></Button>
            <Button asChild size="sm" className="bg-slate-900 hover:bg-slate-800 text-[10px] font-black tracking-widest px-4"><Link to="/import-travaux"><Upload className="size-3.5 mr-2" /> NOUVEL IMPORT</Link></Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-6">
        {/* SECTION FILTRES */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <ListFilter className="size-4" /> Filtres Dynamiques
            </div>
            <Button variant="ghost" size="sm" onClick={reset} className="text-[9px] font-black text-slate-400 hover:text-red-500 uppercase tracking-widest">
              <RotateCcw className="size-3 mr-1" /> RÉINITIALISER
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
            <div className="space-y-3">
              <Label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Années d'exercice</Label>
              <div className="flex flex-wrap gap-1.5">
                {options.years.map(y => (
                  <button 
                    key={y} 
                    onClick={() => setSelectedYears(prev => prev.includes(y) ? prev.filter(a => a !== y) : [...prev, y])}
                    className={`px-3 py-1 rounded-full text-[10px] font-black transition-all border ${
                      selectedYears.includes(y) ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Programmation</Label>
              <div className="flex gap-4 items-center h-8">
                <label className="flex items-center gap-2 text-[10px] font-black text-slate-600 cursor-pointer group">
                  <Checkbox checked={progFilter.prog} onCheckedChange={(v) => setProgFilter(p => ({ ...p, prog: !!v }))} />
                  <span className={progFilter.prog ? "text-blue-600" : ""}>PROGRAMMÉE</span>
                </label>
                <label className="flex items-center gap-2 text-[10px] font-black text-slate-600 cursor-pointer group">
                  <Checkbox checked={progFilter.hors} onCheckedChange={(v) => setProgFilter(p => ({ ...p, hors: !!v }))} />
                  <span className={progFilter.hors ? "text-orange-600" : ""}>HORS BUDGET</span>
                </label>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Secteur</Label>
              <div className="flex gap-4 items-center h-8">
                {SECTEURS.map(s => (
                  <label key={s} className="flex items-center gap-2 text-[10px] font-black text-slate-600 cursor-pointer">
                    <Checkbox checked={selectedSectors.includes(s)} onCheckedChange={(v) => setSelectedSectors(prev => v ? [...prev, s] : prev.filter(x => x !== s))} />
                    {s}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-3 lg:col-span-2">
              <Label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Tranche / Ensemble Résidentiel</Label>
              <select 
                value={selectedTranche} 
                onChange={(e) => setSelectedTranche(e.target.value)}
                className="w-full h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase shadow-inner focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="Toutes">TOUTES LES TRANCHES</option>
                {options.tranches.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
        </section>

        {/* SECTION VISUALISATIONS (KPIs) */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Kpi label="Budget Total" value={money(stats.budget)} trend="PREV" />
          <Kpi label="% Hors Budget" value={`${stats.pctHors}%`} trend="ALERTE" />
          <Kpi label="% Programmé" value={`${stats.pctProg}%`} trend="OK" />
          <Kpi label="Terminés" value={stats.done.toString()} detail={`sur ${stats.total} commandes`} trend="STATUT" />
        </section>

        {/* GRAPHIQUES LIGNE 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Donut Chart - Répartition GT/GE/CP */}
          <article className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Répartition par Secteur (Engagé)</h3>
              <div className="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded uppercase">Interactif</div>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={dataSecteur} 
                    dataKey="value" 
                    nameKey="name" 
                    cx="50%" 
                    cy="50%" 
                    innerRadius={70} 
                    outerRadius={100} 
                    paddingAngle={8}
                    onClick={(e) => setDrilldownSector(e.name)}
                    className="cursor-pointer"
                  >
                    {dataSecteur.map((entry) => (
                      <Cell key={entry.name} fill={SECTOR_COLORS[entry.name as keyof typeof SECTOR_COLORS]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => money(v)} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 'bold' }} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'black', textTransform: 'uppercase' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-4 text-[9px] text-center text-slate-400 font-black uppercase tracking-widest">CLIQUEZ SUR UN SECTEUR POUR DRILL-DOWN</p>
          </article>

          {/* Heatmap Géographique - Dépenses par ville */}
          <article className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Heatmap Dépenses par Ville</h3>
              <MapPin className="size-4 text-red-500" />
            </div>
            <div className="space-y-3 h-72 overflow-y-auto pr-2 custom-scrollbar">
              {dataHeatmap.map(([city, val], idx) => {
                const max = dataHeatmap[0]?.[1] || 1;
                const pct = (val / max) * 100;
                const color = pct > 70 ? 'bg-red-500' : pct > 30 ? 'bg-blue-500' : 'bg-blue-200';
                return (
                  <div key={city} className="group relative">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-black text-slate-700 uppercase truncate max-w-[150px]">{city}</span>
                      <span className="text-[10px] font-black text-slate-900">{money(val)}</span>
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
          </article>
        </div>

        {/* Classement Tranches */}
        <article className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Classement Tranches (Engagé)</h3>
            <Button variant="outline" size="sm" onClick={() => setShowAllTranches(!showAllTranches)} className="text-[9px] font-black uppercase tracking-widest border-slate-200">
              {showAllTranches ? "VOIR TOP 5" : "VOIR PLUS (TOP 20)"}
            </Button>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataTranche} layout="vertical" margin={{ left: 20, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" fontSize={9} fontWeight="black" width={100} axisLine={false} tickLine={false} />
                <Tooltip 
                  formatter={(v) => money(v)} 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 'bold' }}
                />
                <Bar dataKey="value" fill="#2563eb" radius={[0, 6, 6, 0]} barSize={25}>
                  {dataTranche.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? "#1e40af" : "#3b82f6"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        {/* TABLEAU DÉTAIL PRINCIPAL */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b bg-slate-50/50 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-900">Journal des Commandes</h3>
              <span className="bg-slate-200 text-slate-700 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter">{filtered.length} LIGNES</span>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-2.5 size-3.5 text-slate-400" />
              <input 
                value={search} 
                onChange={(e) => { setSearch(e.target.value); setPage(1); }} 
                placeholder="RECHERCHER ADRESSE, TRANCHE..." 
                className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 text-[10px] font-black uppercase focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm" 
              />
            </div>
          </div>
          
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-[10px] border-collapse">
              <thead className="bg-slate-50 border-b text-slate-400 font-black uppercase tracking-widest">
                <tr>
                  <th className="p-4 w-10">ACT.</th>
                  <th className="p-4">N° Commande</th>
                  <th className="p-4">Entreprise</th>
                  <th className="p-4">Tranche</th>
                  <th className="p-4">Adresse</th>
                  <th className="p-4">Descriptif</th>
                  <th className="p-4 text-right">Budget</th>
                  <th className="p-4 text-right">Engagé</th>
                  <th className="p-4 text-right">Payé</th>
                  <th className="p-4 text-right">Solde</th>
                  <th className="p-4">Secteur</th>
                  <th className="p-4">État</th>
                  <th className="p-4">Prog.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE).map((row) => {
                  const modif = historyMap.get(row.id);
                  const sect = sectorOf(row);
                  const isProg = !!row.ligne_budget;
                  return (
                    <tr key={row.id} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="p-4">
                        {modif ? (
                          <button 
                            onClick={() => { setSelectedModif(modif); setVersionChoice("B"); }}
                            className="text-amber-500 hover:scale-110 transition-transform"
                          >
                            <AlertTriangle className="size-4 fill-amber-50" />
                          </button>
                        ) : (
                          <div className="size-4 rounded-full border-2 border-slate-100 group-hover:border-slate-200" />
                        )}
                      </td>
                      <td className="p-4 font-black text-blue-600">
                        <button onClick={() => setSelectedDetail(row)} className="hover:underline flex items-center gap-1">
                          {row.numero_commande}
                          <Info className="size-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      </td>
                      <td className="p-4 font-bold text-slate-500">{row.numero_fournisseur || "—"}</td>
                      <td className="p-4 font-black text-slate-700">
                        <Link to="/adresses" search={{ q: "", ville: undefined, tranche: row.tranche_code || undefined, rue: undefined, adresse: undefined }} className="hover:underline">
                          {row.tranche_code || "—"}
                        </Link>
                      </td>
                      <td className="p-4 font-bold text-slate-600 truncate max-w-[120px] uppercase">{row.adresse || "—"}</td>
                      <td className="p-4 text-slate-500 truncate max-w-[180px]">{row.descriptif || "—"}</td>
                      <td className="p-4 text-right font-medium text-slate-400">{money(row.budget)}</td>
                      <td className="p-4 text-right font-black text-slate-900">{money(row.engage)}</td>
                      <td className="p-4 text-right text-slate-600">{money(row.paye)}</td>
                      <td className="p-4 text-right font-bold text-slate-400">{money(row.solde)}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black ${
                          sect === 'GT' ? 'bg-blue-100 text-blue-700' : 
                          sect === 'GE' ? 'bg-teal-100 text-teal-700' : 
                          'bg-orange-100 text-orange-700'
                        }`}>
                          {sect}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-slate-400 font-black uppercase text-[8px]">{row.etat_travaux || row.etat_commande || "—"}</span>
                      </td>
                      <td className="p-4">
                        <div className={`size-2 rounded-full ${isProg ? 'bg-green-500 shadow-green-200' : 'bg-slate-300'} shadow-sm`} title={isProg ? 'Programmée' : 'Hors Budget'} />
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
              <Button variant="outline" size="sm" className="h-8 font-black text-[9px] rounded-xl uppercase tracking-widest" disabled={page === 1} onClick={() => setPage(p => p - 1)}>PRÉCÉDENT</Button>
              <Button variant="outline" size="sm" className="h-8 font-black text-[9px] rounded-xl uppercase tracking-widest" disabled={page * PAGE_SIZE >= filtered.length} onClick={() => setPage(p => p + 1)}>SUIVANT</Button>
            </div>
          </div>
        </section>
      </div>

      {/* MODALE FICHE DÉTAILLÉE COMMANDE */}
      <Dialog open={!!selectedDetail} onOpenChange={(o) => !o && setSelectedDetail(null)}>
        <DialogContent className="max-w-4xl rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-slate-900 p-8 text-white relative">
            <div className="flex items-center gap-4 mb-6">
              <div className="bg-blue-600 p-3 rounded-2xl shadow-lg">
                <FileText className="size-8" />
              </div>
              <div>
                <h2 className="text-2xl font-black uppercase tracking-tighter">Fiche Commande #{selectedDetail?.numero_commande}</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Détail exhaustif des travaux</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="space-y-1">
                <p className="text-[9px] font-black text-slate-500 uppercase">Secteur</p>
                <p className="text-sm font-black">{selectedDetail ? sectorOf(selectedDetail) : "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[9px] font-black text-slate-500 uppercase">Tranche</p>
                <p className="text-sm font-black text-blue-400">{selectedDetail?.tranche_code || "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[9px] font-black text-slate-500 uppercase">État</p>
                <p className="text-sm font-black uppercase text-amber-400">{selectedDetail?.etat_travaux || selectedDetail?.etat_commande || "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[9px] font-black text-slate-500 uppercase">Programmation</p>
                <p className="text-sm font-black uppercase">{selectedDetail?.ligne_budget ? "Programmée" : "Hors Budget"}</p>
              </div>
            </div>
          </div>
          
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-12 bg-white">
            <div className="space-y-8">
              <section>
                <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 mb-4">
                  <Building2 className="size-4 text-blue-600" /> Informations Générales
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Adresse</span>
                    <span className="text-xs font-black text-slate-700">{selectedDetail?.adresse || "—"}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Corps d'état</span>
                    <span className="text-xs font-black text-slate-700">{selectedDetail?.corps_etat || "—"}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Nature analytique</span>
                    <span className="text-xs font-black text-slate-700">{selectedDetail?.nature_analytique || "—"}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Ligne Budget</span>
                    <span className="text-xs font-black text-slate-700">{selectedDetail?.ligne_budget || "—"}</span>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 mb-4">
                  <User className="size-4 text-blue-600" /> Intervenants
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Entreprise</span>
                    <span className="text-xs font-black text-slate-700">{selectedDetail?.fournisseur || "—"} ({selectedDetail?.numero_fournisseur})</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Chargé d'opération</span>
                    <span className="text-xs font-black text-slate-700">{selectedDetail?.charge_operation || "—"}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Chargé de clientèle</span>
                    <span className="text-xs font-black text-slate-700">{selectedDetail?.charge_clientele || "—"}</span>
                  </div>
                </div>
              </section>
            </div>

            <div className="space-y-8">
              <section>
                <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 mb-4">
                  <Euro className="size-4 text-blue-600" /> Données Financières
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl">
                    <p className="text-[9px] font-black text-slate-400 uppercase">Budget Initial</p>
                    <p className="text-lg font-black">{money(selectedDetail?.budget)}</p>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                    <p className="text-[9px] font-black text-blue-400 uppercase">Montant Engagé</p>
                    <p className="text-lg font-black text-blue-700">{money(selectedDetail?.engage)}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl">
                    <p className="text-[9px] font-black text-slate-400 uppercase">Montant Payé</p>
                    <p className="text-lg font-black">{money(selectedDetail?.paye)}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl">
                    <p className="text-[9px] font-black text-slate-400 uppercase">Solde Restant</p>
                    <p className="text-lg font-black">{money(selectedDetail?.solde)}</p>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 mb-4">
                  <Calendar className="size-4 text-blue-600" /> Calendrier & Suivi
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Date Démarrage</span>
                    <span className="text-xs font-black text-slate-700">{selectedDetail?.date_demarrage || "—"}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Date Fin Travaux</span>
                    <span className="text-xs font-black text-slate-700">{selectedDetail?.date_fin_travaux || "—"}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Support Com.</span>
                    <span className="text-xs font-black text-slate-700">{selectedDetail?.support_communication || "—"}</span>
                  </div>
                </div>
              </section>
            </div>
          </div>
          
          <div className="p-8 bg-slate-50 border-t">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Descriptif complet</h3>
            <p className="text-xs text-slate-600 leading-relaxed font-medium bg-white p-4 rounded-2xl border border-slate-200">
              {selectedDetail?.descriptif || "Aucun descriptif renseigné pour cette commande."}
            </p>
          </div>

          <DialogFooter className="p-6 bg-white">
            <Button onClick={() => setSelectedDetail(null)} className="w-full bg-slate-900 font-black text-xs uppercase tracking-widest rounded-2xl h-12">FERMER LA FICHE</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODALE DRILL-DOWN SECTEUR */}
      <Dialog open={!!drilldownSector} onOpenChange={(o) => !o && setDrilldownSector(null)}>
        <DialogContent className="max-w-xl rounded-2xl border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black uppercase tracking-tight">Détail Secteur : {drilldownSector}</DialogTitle>
            <DialogDescription className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Répartition Engagé par Corps d'état</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
            {dataDrilldown.map((d, i) => (
              <div key={d.name} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-blue-200 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-[9px] font-black text-slate-300">#0{i+1}</span>
                  <span className="text-[10px] font-black text-slate-700 uppercase">{d.name}</span>
                </div>
                <span className="text-[10px] font-black text-blue-600">{money(d.value)}</span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => setDrilldownSector(null)} className="w-full bg-slate-900 font-black text-[10px] rounded-xl uppercase tracking-widest">FERMER</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODALE ALERTE MODIFICATIONS (⚠️) */}
      <Dialog open={!!selectedModif} onOpenChange={(o) => !o && setSelectedModif(null)}>
        <DialogContent className="max-w-4xl rounded-3xl overflow-hidden p-0 border-none shadow-2xl">
          <div className="bg-amber-500 p-6 text-white">
            <div className="flex items-center gap-3">
              <AlertTriangle className="size-8" />
              <div>
                <h2 className="text-xl font-black uppercase tracking-tight">Alerte Modification Détectée</h2>
                <p className="text-[10px] font-black opacity-80 uppercase tracking-widest">
                  Commande N° {(selectedModif as any)?.travaux_commandes?.numero_commande || "—"} • Modifié le {selectedModif ? new Date(selectedModif.created_at).toLocaleDateString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}
                </p>
              </div>
            </div>
          </div>
          
          <div className="p-8 space-y-8 bg-white">
            <div className="grid grid-cols-2 gap-8">
              {/* Version A */}
              <div className={`rounded-2xl border-2 p-6 transition-all ${versionChoice === 'A' ? 'border-blue-600 bg-blue-50/30 ring-4 ring-blue-50' : 'border-slate-100 bg-slate-50'}`}>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">VERSION A (ORIGINAL)</span>
                  <RadioGroup value={versionChoice} onValueChange={(v) => setVersionChoice(v as "A" | "B")}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="A" id="vA" className="border-slate-300 text-blue-600" />
                      <Label htmlFor="vA" className="text-[10px] font-black cursor-pointer uppercase tracking-widest">GARDER A</Label>
                    </div>
                  </RadioGroup>
                </div>
                <div className="space-y-3">
                  {selectedModif?.avant && Object.entries(selectedModif.avant).map(([k, v]) => (
                    <div key={k} className="flex justify-between text-[10px] border-b border-slate-100 pb-1">
                      <span className="text-slate-400 font-black uppercase tracking-tighter">{k.replace(/_/g, ' ')}</span>
                      <span className="text-slate-900 font-bold">{text(v)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Version B */}
              <div className={`rounded-2xl border-2 p-6 transition-all ${versionChoice === 'B' ? 'border-blue-600 bg-blue-50/30 ring-4 ring-blue-50' : 'border-slate-100 bg-slate-50'}`}>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">VERSION B (MODIFIÉ)</span>
                  <RadioGroup value={versionChoice} onValueChange={(v) => setVersionChoice(v as "A" | "B")}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="B" id="vB" className="border-slate-300 text-blue-600" />
                      <Label htmlFor="vB" className="text-[10px] font-black cursor-pointer uppercase tracking-widest">GARDER B</Label>
                    </div>
                  </RadioGroup>
                </div>
                <div className="space-y-3">
                  {selectedModif?.apres && Object.entries(selectedModif.apres).map(([k, v]) => {
                    const changed = JSON.stringify(selectedModif.avant?.[k]) !== JSON.stringify(v);
                    return (
                      <div key={k} className={`flex justify-between text-[10px] border-b border-slate-100 pb-1 ${changed ? 'text-blue-600 font-black bg-blue-50 -mx-2 px-2 rounded' : ''}`}>
                        <span className="text-slate-400 font-black uppercase tracking-tighter">{k.replace(/_/g, ' ')}</span>
                        <span>{text(v)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            
            <Button 
              className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-slate-200 transition-all hover:-translate-y-1 active:translate-y-0"
              onClick={() => setSelectedModif(null)}
            >
              VALIDER LA DÉCISION
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
