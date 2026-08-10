import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, ArrowDownUp, FilterX, Gauge, Search, Upload, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
type History = HistoriqueTravaux;
const SECTEURS = ["GT", "GE", "CP"] as const;
const SECTOR_COLORS = { GT: "#2563eb", GE: "#0f766e", CP: "#c2410c" };
const PAGE_SIZE = 20;

const money = (value: unknown) => typeof value === "number" ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value) : "—";
const dateYear = (value: unknown) => value ? String(value).slice(0, 4) : null;
const text = (value: unknown) => value == null ? "" : String(value);
const sectorOf = (row: Commande) => {
  const value = `${text(row.secteur)} ${text(row.corps_etat)}`.toLowerCase();
  if (row.secteur && (SECTEURS as readonly string[]).includes(row.secteur)) return row.secteur;
  if (/maconner|isolation|espace ext|divers/.test(value)) return "GT";
  if (/electric|couverture|hall|cage/.test(value)) return "GE";
  if (/plomberie|menuiser|toiture|fermeture|etanche/.test(value)) return "CP";
  return "GT";
};
const yearOf = (row: Commande) => dateYear(row.date_demarrage) ?? dateYear(row.date_fin_travaux) ?? dateYear(row.date_communication) ?? "Sans année";
const cityOf = (address: unknown) => {
  const value = text(address).trim();
  const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.at(-1) || "Ville non renseignée";
};
const isDone = (value: unknown) => /termine|terminé|acheve|achevé|clos|realise|réalisé/i.test(text(value));

function DashboardTravauxPage() {
  const fetchDashboard = useServerFn(getTravauxDashboard);
  const { data, isLoading, error } = useQuery<TravauxDashboardData>({ queryKey: ["travaux-dashboard"], queryFn: () => fetchDashboard() });
  const commandes = data?.commandes ?? [];
  const historique = data?.historique ?? [];
  const [years, setYears] = useState<string[]>([]);
  const [programmations, setProgrammations] = useState(["Programmée", "Hors Budget"]);
  const [sectors, setSectors] = useState<string[]>([...SECTEURS]);
  const [tranche, setTranche] = useState("Toutes les tranches");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortDesc, setSortDesc] = useState(true);
  const [selectedHistory, setSelectedHistory] = useState<History | null>(null);
  const [drilldownSector, setDrilldownSector] = useState<string | null>(null);
  const [showTop20, setShowTop20] = useState(false);
  const [historyChoice, setHistoryChoice] = useState("B");

  const options = useMemo(() => ({
    years: [...new Set(commandes.map(yearOf))].sort((a, b) => b.localeCompare(a)),
    tranches: [...new Set(commandes.map((row) => text(row.tranche_code)).filter(Boolean))].sort(),
  }), [commandes]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return commandes.filter((row) => {
      const programmation = row.ligne_budget ? "Programmée" : "Hors Budget";
      const matchesQuery = !query || [row.numero_commande, row.adresse, row.tranche_code, row.descriptif].some((value) => text(value).toLowerCase().includes(query));
      return (!years.length || years.includes(yearOf(row))) && programmations.includes(programmation) && sectors.includes(sectorOf(row)) && (tranche === "Toutes les tranches" || row.tranche_code === tranche) && matchesQuery;
    });
  }, [commandes, years, programmations, sectors, tranche, search]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => (Number(a.engage ?? 0) - Number(b.engage ?? 0)) * (sortDesc ? -1 : 1)), [filtered, sortDesc]);
  const visible = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const stats = useMemo(() => {
    const budget = filtered.reduce((sum, row) => sum + Number(row.budget ?? 0), 0);
    const engage = filtered.reduce((sum, row) => sum + Number(row.engage ?? 0), 0);
    const programmed = filtered.filter((row) => row.ligne_budget).length;
    return { budget, engage, programmed, horsBudget: filtered.length - programmed, done: filtered.filter((row) => isDone(row.etat_travaux ?? row.etat_commande)).length };
  }, [filtered]);
  const donut = useMemo(() => SECTEURS.map((secteur) => ({ name: secteur, value: filtered.filter((row) => sectorOf(row) === secteur).reduce((sum, row) => sum + Number(row.engage ?? 0), 0) })), [filtered]);
  const cities = useMemo(() => Object.entries(filtered.reduce<Record<string, number>>((result, row) => { const city = cityOf(row.adresse); result[city] = (result[city] ?? 0) + Number(row.engage ?? 0); return result; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 12), [filtered]);
  const rankings = useMemo(() => Object.entries(filtered.reduce<Record<string, number>>((result, row) => { const key = text(row.tranche_code) || "Sans tranche"; result[key] = (result[key] ?? 0) + Number(row.engage ?? 0); return result; }, {})).sort((a, b) => b[1] - a[1]), [filtered]);
  const drilldown = useMemo(() => Object.entries(filtered.filter((row) => sectorOf(row) === drilldownSector).reduce<Record<string, number>>((result, row) => { const key = text(row.corps_etat) || "Corps d’état non renseigné"; result[key] = (result[key] ?? 0) + Number(row.engage ?? 0); return result; }, {})).sort((a, b) => b[1] - a[1]), [filtered, drilldownSector]);
  const historyByCommand = useMemo(() => new Map(historique.map((item) => [item.commande_id, item])), [historique]);

  const reset = () => { setYears([]); setProgrammations(["Programmée", "Hors Budget"]); setSectors([...SECTEURS]); setTranche("Toutes les tranches"); setSearch(""); setPage(1); };
  const toggleValue = (value: string, values: string[], setter: (next: string[]) => void) => setter(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);

  return <main className="min-h-screen bg-background">
    <header className="border-b bg-card"><div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-4 sm:px-6"><div className="mr-auto"><h1 className="flex items-center gap-2 text-lg font-semibold"><Wrench className="size-5 text-primary" /> Dashboard suivi travaux</h1><p className="text-sm text-muted-foreground">Analyse des commandes, dépenses et modifications historisées</p></div><div className="flex gap-2"><Button asChild variant="outline"><Link to="/">Patrimoine</Link></Button><Button asChild><Link to="/import-travaux"><Upload className="size-4" /> Import travaux</Link></Button></div></div></header>
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
      <section className="grid gap-3 rounded-xl border bg-card p-4 shadow-panel lg:grid-cols-[1.2fr_1fr_1fr_1fr_auto]">
        <label className="space-y-1 text-sm"><span className="font-medium">Années</span><select multiple value={years} onChange={(event) => { setYears([...event.target.selectedOptions].map((option) => option.value)); setPage(1); }} className="h-20 w-full rounded-md border bg-background px-2 py-1 text-sm">{options.years.map((year) => <option key={year}>{year}</option>)}</select></label>
        <label className="space-y-1 text-sm"><span className="font-medium">Tranche / ER</span><select value={tranche} onChange={(event) => { setTranche(event.target.value); setPage(1); }} className="h-9 w-full rounded-md border bg-background px-2 text-sm"><option>Toutes les tranches</option>{options.tranches.map((item) => <option key={item}>{item}</option>)}</select></label>
        <fieldset className="space-y-2 text-sm"><legend className="font-medium">Programmation</legend>{["Programmée", "Hors Budget"].map((item) => <label key={item} className="flex items-center gap-2"><input type="checkbox" checked={programmations.includes(item)} onChange={() => toggleValue(item, programmations, setProgrammations)} />{item}</label>)}</fieldset>
        <fieldset className="space-y-2 text-sm"><legend className="font-medium">Secteur</legend><div className="flex flex-wrap gap-3">{SECTEURS.map((item) => <label key={item} className="flex items-center gap-2"><input type="checkbox" checked={sectors.includes(item)} onChange={() => toggleValue(item, sectors, setSectors)} />{item}</label>)}</div></fieldset>
        <Button variant="outline" onClick={reset}><FilterX className="size-4" /> Réinitialiser</Button>
      </section>
      {isLoading ? <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">Chargement des données travaux…</p> : null}
      {error ? <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{error instanceof Error ? error.message : "Dashboard indisponible"}</p> : null}
      {!isLoading && !error ? <>
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Kpi label="Budget total" value={money(stats.budget)} /><Kpi label="Engagé" value={money(stats.engage)} /><Kpi label="Programmé" value={`${filtered.length ? Math.round(stats.programmed / filtered.length * 100) : 0}%`} detail={`${stats.programmed} commande(s)`} /><Kpi label="Terminés" value={String(stats.done)} detail={`sur ${filtered.length}`} /></section>
        <section className="grid gap-5 lg:grid-cols-2"><article className="rounded-xl border bg-card p-4 shadow-panel"><h2 className="mb-3 font-semibold">Engagé par secteur</h2><div className="h-64"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={donut} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={3} onClick={(entry) => setDrilldownSector(String(entry.name))}>{donut.map((item) => <Cell key={item.name} fill={SECTOR_COLORS[item.name as keyof typeof SECTOR_COLORS]} cursor="pointer" />)}</Pie><Tooltip formatter={(value) => money(value)} /></PieChart></ResponsiveContainer></div><div className="flex justify-center gap-4 text-xs">{SECTEURS.map((item) => <span key={item} className="flex items-center gap-1"><i className={`size-2 rounded-full ${item === "GT" ? "bg-blue-600" : item === "GE" ? "bg-teal-700" : "bg-orange-700"}`} />{item}</span>)}</div></article><article className="rounded-xl border bg-card p-4 shadow-panel"><h2 className="mb-3 font-semibold">Dépenses par ville</h2><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{cities.map(([city, value], index) => <div key={city} className={`rounded-lg p-3 text-xs ${index < 3 ? "bg-primary/35" : index < 6 ? "bg-primary/25" : index < 9 ? "bg-primary/15" : "bg-primary/10"}`}><p className="truncate font-medium">{city}</p><p className="mt-1 font-semibold">{money(value)}</p></div>)}</div></article></section>
        <section className="grid gap-5 lg:grid-cols-[1fr_2fr]"><article className="rounded-xl border bg-card p-4 shadow-panel"><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Classement tranches</h2><Button variant="ghost" size="sm" onClick={() => setShowTop20(!showTop20)}>{showTop20 ? "Voir top 5" : "Voir plus"}</Button></div><div className="h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={rankings.slice(0, showTop20 ? 20 : 5).map(([name, value]) => ({ name, value }))} layout="vertical" margin={{ left: 8, right: 10 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" tickFormatter={(value) => `${Math.round(value / 1000)}k`} /><YAxis type="category" dataKey="name" width={78} tick={{ fontSize: 10 }} /><Tooltip formatter={(value) => money(value)} /><Bar dataKey="value" fill="#2563eb" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div></article><article className="rounded-xl border bg-card p-4 shadow-panel"><div className="mb-3 flex flex-wrap items-center gap-2"><h2 className="mr-auto font-semibold">Commandes</h2><div className="relative"><Search className="absolute left-2 top-2 size-4 text-muted-foreground" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Adresse, tranche…" className="h-9 rounded-md border bg-background pl-8 pr-3 text-sm" /></div><Button variant="ghost" size="icon" onClick={() => setSortDesc(!sortDesc)} title="Inverser le tri"><ArrowDownUp className="size-4" /></Button></div><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="border-b text-muted-foreground"><tr><th className="p-2">Actions</th><th className="p-2">Tranche</th><th className="p-2">Adresse</th><th className="p-2">Descriptif</th><th className="p-2 text-right">Budget</th><th className="p-2 text-right">Engagé</th><th className="p-2 text-right">Payé</th><th className="p-2 text-right">Solde</th><th className="p-2">État</th></tr></thead><tbody className="divide-y">{visible.map((row) => { const change = historyByCommand.get(row.id); return <tr key={row.id} className="hover:bg-accent/30"><td className="p-2">{change ? <button className="text-warning" title="Voir la modification" onClick={() => { setSelectedHistory(change); setHistoryChoice("B"); }}><AlertTriangle className="size-4" /></button> : <span className="text-muted-foreground">—</span>}</td><td className="p-2"><Link className="text-primary hover:underline" to="/adresses" search={{ q: "", ville: undefined, tranche: row.tranche_code, rue: undefined, adresse: undefined }}>{row.tranche_code || "—"}</Link></td><td className="max-w-36 truncate p-2">{row.adresse || "—"}</td><td className="max-w-52 truncate p-2">{row.descriptif || "—"}</td><td className="p-2 text-right">{money(row.budget)}</td><td className="p-2 text-right font-medium">{money(row.engage)}</td><td className="p-2 text-right">{money(row.paye)}</td><td className="p-2 text-right">{money(row.solde)}</td><td className="p-2">{row.etat_travaux || row.etat_commande || "—"}</td></tr>; })}</tbody></table></div><div className="mt-3 flex items-center justify-between text-xs text-muted-foreground"><span>{sorted.length} commande(s) · page {page}/{pages}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Précédent</Button><Button variant="outline" size="sm" disabled={page === pages} onClick={() => setPage(page + 1)}>Suivant</Button></div></div></article></section>
      </> : null}
    </div>
    <Dialog open={!!drilldownSector} onOpenChange={(open) => !open && setDrilldownSector(null)}><DialogContent><DialogHeader><DialogTitle>Répartition {drilldownSector}</DialogTitle><DialogDescription>Montant engagé par corps d’état pour les filtres actifs.</DialogDescription></DialogHeader><div className="space-y-2">{drilldown.map(([name, value]) => <div key={name} className="flex items-center justify-between rounded-lg border p-3 text-sm"><span>{name}</span><strong>{money(value)}</strong></div>)}{drilldown.length === 0 ? <p className="text-sm text-muted-foreground">Aucune donnée disponible.</p> : null}</div></DialogContent></Dialog>
    <Dialog open={!!selectedHistory} onOpenChange={(open) => !open && setSelectedHistory(null)}><DialogContent className="max-w-4xl"><DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="size-4 text-warning" /> Comparaison de modification</DialogTitle><DialogDescription>Commande concernée : {selectedHistory?.commande_id ?? "—"} · {selectedHistory?.created_at ? new Date(selectedHistory.created_at).toLocaleString("fr-FR") : ""}</DialogDescription></DialogHeader><div className="grid gap-4 md:grid-cols-2"><Version title="Version A · avant" value={selectedHistory?.avant} /><Version title="Version B · après" value={selectedHistory?.apres} /></div><fieldset className="flex flex-wrap gap-4 text-sm"><legend className="mb-2 w-full font-medium">Version à conserver dans votre analyse</legend><label className="flex items-center gap-2"><input type="radio" name="history-choice" value="A" checked={historyChoice === "A"} onChange={(event) => setHistoryChoice(event.target.value)} /> Garder A</label><label className="flex items-center gap-2"><input type="radio" name="history-choice" value="B" checked={historyChoice === "B"} onChange={(event) => setHistoryChoice(event.target.value)} /> Garder B</label><Button className="ml-auto" onClick={() => setSelectedHistory(null)}>Valider</Button></fieldset></DialogContent></Dialog>
  </main>;
}

function Kpi({ label, value, detail }: { label: string; value: string; detail?: string }) { return <div className="rounded-xl border bg-card p-4 shadow-panel"><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="tabnum mt-1 text-2xl font-semibold">{value}</p>{detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}</div>; }
function Version({ title, value }: { title: string; value: unknown }) { return <div className="rounded-lg border bg-muted/30 p-3"><h3 className="mb-2 text-sm font-semibold">{title}</h3><pre className="max-h-72 overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(value ?? {}, null, 2)}</pre></div>; }
