import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { UBOChainVisualizer } from "@/components/ubo/UBOChainVisualizer";
import { Shield, Users, AlertTriangle, Building2, RefreshCw, Download, Eye, User, Link2 } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function UBORegistry() {
  const { workspaceId } = useAuth();
  const navigate = useNavigate();
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [persons, setPersons] = useState<any[]>([]);
  const [personDocs, setPersonDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [calcProgress, setCalcProgress] = useState({ current: 0, total: 0 });
  const [lastCalcTime, setLastCalcTime] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [thresholdOnly, setThresholdOnly] = useState(false);
  const [minPct, setMinPct] = useState([0]);
  const [nationalityFilter, setNationalityFilter] = useState("all");

  // Chain visualizer
  const [selectedChain, setSelectedChain] = useState<any>(null);

  const fetchData = async () => {
    if (!workspaceId) return;
    const [snapshotsRes, companiesRes, personsRes, docsRes] = await Promise.all([
      supabase.from("ubo_snapshots").select("*").eq("workspace_id", workspaceId).eq("snapshot_type", "live"),
      supabase.from("entities").select("id, name, type, nationality_or_jurisdiction").eq("workspace_id", workspaceId).eq("type", "company"),
      supabase.from("entities").select("id, name, type, nationality_or_jurisdiction, date_of_birth_or_incorporation").eq("workspace_id", workspaceId).eq("type", "person"),
      supabase.from("documents").select("*").eq("workspace_id", workspaceId).in("document_type", ["Passport", "National ID"]),
    ]);
    setSnapshots(snapshotsRes.data || []);
    setCompanies(companiesRes.data || []);
    setPersons(personsRes.data || []);
    setPersonDocs(docsRes.data || []);
    
    // Get last calc time
    const latest = (snapshotsRes.data || []).reduce((max: string | null, s: any) => {
      if (!max || s.calculated_at > max) return s.calculated_at;
      return max;
    }, null);
    setLastCalcTime(latest);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [workspaceId]);

  const handleRecalculateAll = async () => {
    if (!workspaceId) return;
    setCalculating(true);
    const liveCompanies = companies;
    setCalcProgress({ current: 0, total: liveCompanies.length });
    
    for (let i = 0; i < liveCompanies.length; i++) {
      setCalcProgress({ current: i + 1, total: liveCompanies.length });
      const { error } = await supabase.rpc("calculate_ubo", { p_company_entity_id: liveCompanies[i].id });
      if (error) console.error("UBO calc error for", liveCompanies[i].name, error);
    }
    
    toast.success("UBO calculation complete for all companies");
    setCalculating(false);
    fetchData();
  };

  const entityMap = useMemo(() => {
    const map: Record<string, any> = {};
    [...companies, ...persons].forEach(e => { map[e.id] = e; });
    return map;
  }, [companies, persons]);

  const getPassportStatus = (personId: string) => {
    const docs = personDocs.filter(d => d.entity_id === personId);
    const passport = docs.find(d => d.document_type === "Passport");
    return passport;
  };

  // Compute nationalities for filter
  const nationalities = useMemo(() => {
    const set = new Set<string>();
    persons.forEach(p => { if (p.nationality_or_jurisdiction) set.add(p.nationality_or_jurisdiction); });
    return Array.from(set).sort();
  }, [persons]);

  const nonCircularSnapshots = useMemo(() => snapshots.filter(s => !s.circular_detected), [snapshots]);
  const circularSnapshots = useMemo(() => snapshots.filter(s => s.circular_detected), [snapshots]);

  // Unresolved: companies with no person UBOs found
  const companiesWithUBO = useMemo(() => new Set(nonCircularSnapshots.map(s => s.company_entity_id)), [nonCircularSnapshots]);
  const unresolvedCompanies = useMemo(() => {
    // Companies that have been calculated but have no UBO results, 
    // or companies that haven't been calculated at all but have equity links
    return companies.filter(c => !companiesWithUBO.has(c.id));
  }, [companies, companiesWithUBO]);

  // Summary stats
  const totalUBOs = useMemo(() => new Set(nonCircularSnapshots.map(s => s.person_entity_id)).size, [nonCircularSnapshots]);
  const aboveThreshold = useMemo(() => nonCircularSnapshots.filter(s => s.is_above_threshold).length, [nonCircularSnapshots]);
  const companiesCalculated = useMemo(() => companiesWithUBO.size, [companiesWithUBO]);

  // Filter snapshots
  const filtered = useMemo(() => {
    return nonCircularSnapshots.filter(s => {
      const person = entityMap[s.person_entity_id];
      const company = entityMap[s.company_entity_id];
      if (!person || !company) return false;
      
      if (search) {
        const q = search.toLowerCase();
        if (!person.name.toLowerCase().includes(q) && !company.name.toLowerCase().includes(q)) return false;
      }
      if (companyFilter !== "all" && s.company_entity_id !== companyFilter) return false;
      if (thresholdOnly && !s.is_above_threshold) return false;
      if (Number(s.effective_economic_pct) < minPct[0] && Number(s.effective_voting_pct) < minPct[0]) return false;
      if (nationalityFilter !== "all" && person.nationality_or_jurisdiction !== nationalityFilter) return false;
      return true;
    });
  }, [nonCircularSnapshots, search, companyFilter, thresholdOnly, minPct, nationalityFilter, entityMap]);

  const handleExportCSV = () => {
    const headers = ["Company", "UBO Name", "Nationality", "Date of Birth", "Passport Number", "Passport Expiry", "Economic %", "Voting %", "Layers", "Above Threshold"];
    const rows = filtered.map(s => {
      const person = entityMap[s.person_entity_id];
      const company = entityMap[s.company_entity_id];
      const passport = getPassportStatus(s.person_entity_id);
      const chain = Array.isArray(s.ownership_chain) ? s.ownership_chain : [];
      return [
        company?.name || "",
        person?.name || "",
        person?.nationality_or_jurisdiction || "",
        person?.date_of_birth_or_incorporation || "",
        passport?.document_number || "",
        passport?.expiry_date || "",
        Number(s.effective_economic_pct).toFixed(2),
        Number(s.effective_voting_pct).toFixed(2),
        Math.max(0, chain.length - 1).toString(),
        s.is_above_threshold ? "Yes" : "No",
      ];
    });
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `ubo-register-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const getPctBadge = (pct: number) => {
    if (pct >= 25) return <Badge className="bg-destructive text-destructive-foreground">{pct.toFixed(2)}%</Badge>;
    if (pct >= 10) return <Badge className="bg-warning text-warning-foreground">{pct.toFixed(2)}%</Badge>;
    return <Badge variant="secondary">{pct.toFixed(2)}%</Badge>;
  };

  const getChainPreview = (chain: any[]) => {
    if (!Array.isArray(chain) || chain.length === 0) return "—";
    return chain.map(c => c.entity_name).join(" → ");
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ultimate Beneficial Owner Registry</h1>
          <p className="text-sm text-muted-foreground mt-1">Calculated effective ownership across all holding structures</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button onClick={handleRecalculateAll} disabled={calculating}>
            <RefreshCw className={`mr-2 h-4 w-4 ${calculating ? "animate-spin" : ""}`} />
            {calculating ? `Calculating ${calcProgress.current} of ${calcProgress.total}...` : "Recalculate All"}
          </Button>
          {lastCalcTime && (
            <span className="text-xs text-muted-foreground">Last updated: {format(new Date(lastCalcTime), "MMM dd, yyyy HH:mm")}</span>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total UBOs Identified</CardTitle>
            <Users className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold">{totalUBOs}</div></CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Above 25% Threshold</CardTitle>
            <Shield className="h-5 w-5 text-destructive" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold text-destructive">{aboveThreshold}</div></CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unresolved Chains</CardTitle>
            <AlertTriangle className="h-5 w-5 text-warning" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold text-warning">{unresolvedCompanies.length}</div></CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Companies Calculated</CardTitle>
            <Building2 className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold">{companiesCalculated}</div></CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="shadow-sm">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-1 block">Search</label>
              <Input placeholder="Search UBO or company name..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="w-[200px]">
              <label className="text-sm font-medium mb-1 block">Company</label>
              <Select value={companyFilter} onValueChange={setCompanyFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Companies</SelectItem>
                  {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[180px]">
              <label className="text-sm font-medium mb-1 block">Nationality</label>
              <Select value={nationalityFilter} onValueChange={setNationalityFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {nationalities.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={thresholdOnly} onCheckedChange={setThresholdOnly} />
              <label className="text-sm">Above 25% only</label>
            </div>
            <div className="w-[160px]">
              <label className="text-sm font-medium mb-1 block">Min % ({minPct[0]}%)</label>
              <Slider value={minPct} onValueChange={setMinPct} max={100} step={1} />
            </div>
            <Button variant="outline" onClick={handleExportCSV}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* UBO Registry Table */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">UBO Registry ({filtered.length} records)</CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Shield className="h-12 w-12 mb-4 opacity-30" />
              <p className="text-lg font-medium">No UBO records found</p>
              <p className="text-sm">Click "Recalculate All" to generate UBO data.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>UBO Name</TableHead>
                  <TableHead>Nationality</TableHead>
                  <TableHead>Economic %</TableHead>
                  <TableHead>Voting %</TableHead>
                  <TableHead>Layers</TableHead>
                  <TableHead>Chain</TableHead>
                  <TableHead>Threshold</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => {
                  const person = entityMap[s.person_entity_id];
                  const company = entityMap[s.company_entity_id];
                  const chain = Array.isArray(s.ownership_chain) ? s.ownership_chain : [];
                  const layers = Math.max(0, chain.length - 1);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{company?.name || "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3 text-primary" />
                          {person?.name || "—"}
                        </div>
                      </TableCell>
                      <TableCell>{person?.nationality_or_jurisdiction || "—"}</TableCell>
                      <TableCell>{getPctBadge(Number(s.effective_economic_pct))}</TableCell>
                      <TableCell>{getPctBadge(Number(s.effective_voting_pct))}</TableCell>
                      <TableCell><Badge variant="outline">{layers} layer{layers !== 1 ? "s" : ""}</Badge></TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground truncate max-w-[200px] block">
                          {getChainPreview(chain)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {s.is_above_threshold ? (
                          <Badge className="bg-destructive text-destructive-foreground">✓ Above</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setSelectedChain(s)}>
                            <Eye className="h-4 w-4 mr-1" /> Chain
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => navigate(`/entities/${s.person_entity_id}`)}>
                            <User className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Circular Ownership Warnings */}
      {circularSnapshots.length > 0 && (
        <Card className="shadow-sm border-warning/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" /> Circular Ownership Detected
            </CardTitle>
          </CardHeader>
          <CardContent>
            {circularSnapshots.map((s, i) => {
              const chain = Array.isArray(s.ownership_chain) ? s.ownership_chain : [];
              return (
                <div key={i} className="flex items-center gap-2 py-2 border-b last:border-0">
                  <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
                  <span className="text-sm">{getChainPreview(chain)}</span>
                  <span className="text-xs text-muted-foreground ml-auto">UBO calculation incomplete for this chain</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Unresolved Chains */}
      {unresolvedCompanies.length > 0 && (
        <Card className="shadow-sm border-warning/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Link2 className="h-5 w-5 text-warning" /> Unresolved Chains
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Issue</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unresolvedCompanies.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      No natural person found at the top of the ownership chain. Add ownership links to complete the UBO chain.
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => navigate(`/entities/${c.id}`)}>
                        Fix →
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Chain Visualizer Modal */}
      <Dialog open={!!selectedChain} onOpenChange={(v) => !v && setSelectedChain(null)}>
        <DialogContent className="max-w-[95vw] h-[90vh] p-0">
          {selectedChain && (
            <UBOChainVisualizer
              snapshot={selectedChain}
              personName={entityMap[selectedChain.person_entity_id]?.name || "Unknown"}
              companyName={entityMap[selectedChain.company_entity_id]?.name || "Unknown"}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
