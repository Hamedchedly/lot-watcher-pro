import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Line, LineChart, Legend } from "recharts";
import { AlertTriangle, ArrowDownUp, FilterX, Gauge, Search, Upload, Wrench, Calendar, LayoutDashboard, ListFilter, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
const PAGE_SIZE = 15;

const money = (value: unknown) => typeof value === "number" ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value) : "—";
const text = (value: unknown) => value == null ? "" : String(value);

function Kpi({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}

function DashboardTravauxPage() {
  const fetchDashboard = useServerFn(getTravauxDashboard);
  const { data, isLoading, error } = useQuery<TravauxDashboardData>({ queryKey: ["travaux-dashboard"], queryFn: () => fetchDashboard() });
  
  const allCommandes = data?.commandes ?? [];
  
  // Filtres
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [progFilter, setProgFilter] = useState({ prog: true, hors: true });
  const [selectedSectors, setSelectedSectors] = useState<string[]>([...SECTEURS]);
  const [selectedTranche, setSelectedTranche] = useState("Toutes");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const options = useMemo(() => {
    const years = [...new Set(allCommandes.map(c => c.annee_exercice?.toString()).filter(Boolean))].sort((a, b) => b!.localeCompare(a!)) as string[];
    const tranches = [...new Set(allCommandes.map(c => c.tranche_code).filter(Boolean))].sort() as string[];
    return { years, tranches };
  }, [allCommandes]);

  const filtered = useMemo(() => {
    return allCommandes.filter((row) => {
      const year = row.annee_exercice?.toString();
      const prog = row.classification_programmation;
      const sect = row.classification_secteur;
      
      const matchesYear = selectedYears.length === 0 || (year && selectedYears.includes(year));
      const matchesProg = (prog === "Programmée" && progFilter.prog) || (prog === "Hors Budget" && progFilter.hors);
      const matchesSect = !sect || selectedSectors.includes(sect);
      const matchesTranche = selectedTranche === "Toutes" || row.tranche_code === selectedTranche;
      const matchesSearch = !search || [row.numero_commande, row.adresse, row.descriptif, row.fournisseur].some(v => text(v).toLowerCase().includes(search.toLowerCase()));

      return matchesYear && matchesProg && matchesSect && matchesTranche && matchesSearch;
    });
  }, [allCommandes, selectedYears, progFilter, selectedSectors, selectedTranche, search]);

  const stats = useMemo(() => {
    const budget = filtered.reduce((s, r) => s + (r.budget || 0), 0);
    const engage = filtered.reduce((s, r) => s + (r.engage || 0), 0);
    const paye = filtered.reduce((s, r) => s + (r.paye || 0), 0);
    const count = filtered.length;
    const countProg = filtered.filter(r => r.classification_programmation === "Programmée").length;
    return { budget, engage, paye, count, countProg };
  }, [filtered]);

  // Graphiques
  const dataSecteur = useMemo(() => SECTEURS.map(s => ({
    name: s,
    value: filtered.filter(r => r.classification_secteur === s).reduce((sum, r) => sum + (r.engage || 0), 0)
  })).filter(d => d.value > 0), [filtered]);

  const dataProg = useMemo(() => [
    { name: "Programmée", value: filtered.filter(r => r.classification_programmation === "Programmée").reduce((sum, r) => sum + (r.engage || 0), 0) },
    { name: "Hors Budget", value: filtered.filter(r => r.classification_programmation === "Hors Budget").reduce((sum, r) => sum + (r.engage || 0), 0) }
  ].filter(d => d.value > 0), [filtered]);

  const dataTranche = useMemo(() => {
    const map = filtered.reduce((acc, r) => {
      const t = r.tranche_code || "Sans tranche";
      acc[t] = (acc[t] || 0) + (r.engage || 0);
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [filtered]);

  const dataCorpsEtat = useMemo(() => {
    const map = filtered.reduce((acc, r) => {
      const c = r.corps_etat || "Non renseigné";
      acc[c] = (acc[c] || 0) + (r.engage || 0);
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [filtered]);

  const reset = () => {
    setSelectedYears([]);
    setProgFilter({ prog: true, hors: true });
    setSelectedSectors([...SECTEURS]);
    setSelectedTranche("Toutes");
    setSearch("");
    setPage(1);
  };

  if (isLoading) return <div className="p-8 text-center">Chargement du dashboard...</div>;

  return (
    <main className="min-h-screen bg-slate-50/50 pb-12">
      <header className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2 text-slate-900">
              <LayoutDashboard className="size-5 text-blue-600" /> Dashboard Travaux 2023-2024
            </h1>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm"><Link to="/">Patrimoine</Link></Button>
            <Button asChild size="sm"><Link to="/import-travaux"><Upload className="size-4 mr-2" /> Import</Link></Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-6">
        {/* Filtres */}
        <section className="bg-white rounded-xl border p-4 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
            <ListFilter className="size-4" /> Filtres de recherche
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <div className="space-y-2">
              <Label className="text-xs uppercase text-muted-foreground">Années</Label>
              <div className="flex flex-wrap gap-1">
                {options.years.map(y => (
                  <Button 
                    key={y} 
                    variant={selectedYears.includes(y) ? "default" : "outline"} 
                    size="sm" 
                    className="h-7 px-2 text-xs"
                    onClick={() => setSelectedYears(prev => prev.includes(y) ? prev.filter(a => a !== y) : [...prev, y])}
                  >
                    {y}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase text-muted-foreground">Programmation</Label>
              <div className="flex gap-4 items-center h-9">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={progFilter.prog} onCheckedChange={(v) => setProgFilter(p => ({ ...p, prog: !!v }))} />
                  Programmée
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={progFilter.hors} onCheckedChange={(v) => setProgFilter(p => ({ ...p, hors: !!v }))} />
                  Hors Budget
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase text-muted-foreground">Secteur</Label>
              <div className="flex gap-3 items-center h-9">
                {SECTEURS.map(s => (
                  <label key={s} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Checkbox checked={selectedSectors.includes(s)} onCheckedChange={(v) => setSelectedSectors(prev => v ? [...prev, s] : prev.filter(x => x !== s))} />
                    {s}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase text-muted-foreground">Tranche / ER</Label>
              <select 
                value={selectedTranche} 
                onChange={(e) => setSelectedTranche(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="Toutes">Toutes les tranches</option>
                {options.tranches.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="flex items-end">
              <Button variant="ghost" size="sm" onClick={reset} className="text-slate-500 hover:text-slate-900">
                <RotateCcw className="size-4 mr-2" /> Réinitialiser
              </Button>
            </div>
          </div>
        </section>

        {/* KPIs */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Kpi label="Engagé Total" value={money(stats.engage)} />
          <Kpi label="Budget Prévu" value={money(stats.budget)} />
          <Kpi label="Payé" value={money(stats.paye)} />
          <Kpi label="Commandes" value={stats.count.toString()} detail={`${stats.countProg} programmées`} />
        </section>

        {/* Visualisations */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Secteur Pie */}
          <div className="bg-white rounded-xl border p-5 shadow-sm">
            <h3 className="text-sm font-semibold mb-4">Répartition par Secteur</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={dataSecteur} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {dataSecteur.map((entry) => (
                      <Cell key={entry.name} fill={SECTOR_COLORS[entry.name as keyof typeof SECTOR_COLORS] || "#8884d8"} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => money(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Programmation Pie */}
          <div className="bg-white rounded-xl border p-5 shadow-sm">
            <h3 className="text-sm font-semibold mb-4">Programmation vs Hors Budget</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={dataProg} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5}>
                    <Cell fill="#3b82f6" />
                    <Cell fill="#f59e0b" />
                  </Pie>
                  <Tooltip formatter={(v) => money(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Corps d'état Bar */}
          <div className="bg-white rounded-xl border p-5 shadow-sm">
            <h3 className="text-sm font-semibold mb-4">Top 8 Corps d'état (Engagé)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dataCorpsEtat} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={100} fontSize={10} />
                  <Tooltip formatter={(v) => money(v)} />
                  <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Classement Tranches */}
        <div className="bg-white rounded-xl border p-5 shadow-sm">
          <h3 className="text-sm font-semibold mb-4">Top 10 Tranches par Dépenses</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataTranche}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={10} />
                <YAxis tickFormatter={(v) => `${Math.round(v/1000)}k`} />
                <Tooltip formatter={(v) => money(v)} />
                <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Liste des commandes */}
        <section className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="text-sm font-semibold">Détail des commandes ({filtered.length})</h3>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2 size-4 text-muted-foreground" />
              <input 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
                placeholder="Rechercher..." 
                className="h-8 w-full rounded-md border bg-slate-50 pl-8 pr-3 text-xs focus:bg-white transition-colors" 
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="p-3 font-medium">N° Commande</th>
                  <th className="p-3 font-medium">Tranche</th>
                  <th className="p-3 font-medium">Secteur</th>
                  <th className="p-3 font-medium">Programmation</th>
                  <th className="p-3 font-medium">Corps d'état</th>
                  <th className="p-3 font-medium text-right">Budget</th>
                  <th className="p-3 font-medium text-right">Engagé</th>
                  <th className="p-3 font-medium text-right">Payé</th>
                  <th className="p-3 font-medium">État</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE).map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-medium text-blue-600">{row.numero_commande}</td>
                    <td className="p-3">{row.tranche_code || "—"}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        row.classification_secteur === 'GT' ? 'bg-blue-100 text-blue-700' : 
                        row.classification_secteur === 'GE' ? 'bg-teal-100 text-teal-700' : 
                        'bg-orange-100 text-orange-700'
                      }`}>
                        {row.classification_secteur || "—"}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`text-[10px] ${row.classification_programmation === 'Programmée' ? 'text-green-600 font-medium' : 'text-slate-400'}`}>
                        {row.classification_programmation}
                      </span>
                    </td>
                    <td className="p-3 truncate max-w-[150px]">{row.corps_etat || "—"}</td>
                    <td className="p-3 text-right">{money(row.budget)}</td>
                    <td className="p-3 text-right font-semibold">{money(row.engage)}</td>
                    <td className="p-3 text-right">{money(row.paye)}</td>
                    <td className="p-3">
                      <span className="text-slate-500 italic">{row.etat_travaux || row.etat_commande || "—"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 bg-slate-50 border-t flex items-center justify-between text-[11px] text-slate-500">
            <span>Affichage de {(page-1)*PAGE_SIZE + 1} à {Math.min(page*PAGE_SIZE, filtered.length)} sur {filtered.length} commandes</span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" className="h-7 text-[10px]" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Précédent</Button>
              <Button variant="outline" size="sm" className="h-7 text-[10px]" disabled={page * PAGE_SIZE >= filtered.length} onClick={() => setPage(p => p + 1)}>Suivant</Button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
