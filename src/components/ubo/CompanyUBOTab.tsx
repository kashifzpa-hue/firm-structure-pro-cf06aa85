import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { StatusBadge } from "@/components/StatusBadge";
import { UBOChainVisualizer } from "@/components/ubo/UBOChainVisualizer";
import { RefreshCw, User, Building2, Shield, Eye, AlertTriangle, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface CompanyUBOTabProps {
  companyEntityId: string;
  companyName: string;
  ownedBy: any[];
  owns: any[];
}

export function CompanyUBOTab({ companyEntityId, companyName, ownedBy, owns }: CompanyUBOTabProps) {
  const { workspaceId } = useAuth();
  const navigate = useNavigate();
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [entities, setEntities] = useState<Record<string, any>>({});
  const [personDocs, setPersonDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [lastCalcTime, setLastCalcTime] = useState<string | null>(null);
  const [selectedChain, setSelectedChain] = useState<any>(null);

  const fetchData = async () => {
    if (!workspaceId) return;
    const [snapshotsRes, entitiesRes, docsRes] = await Promise.all([
      supabase.from("ubo_snapshots").select("*").eq("company_entity_id", companyEntityId).eq("workspace_id", workspaceId).eq("snapshot_type", "live"),
      supabase.from("entities").select("id, name, type, nationality_or_jurisdiction").eq("workspace_id", workspaceId),
      supabase.from("documents").select("*").eq("workspace_id", workspaceId).in("document_type", ["Passport", "National ID"]),
    ]);
    setSnapshots(snapshotsRes.data || []);
    const map: Record<string, any> = {};
    (entitiesRes.data || []).forEach(e => { map[e.id] = e; });
    setEntities(map);
    setPersonDocs(docsRes.data || []);
    const latest = (snapshotsRes.data || []).reduce((max: string | null, s: any) => (!max || s.calculated_at > max) ? s.calculated_at : max, null);
    setLastCalcTime(latest);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [companyEntityId, workspaceId]);

  const handleRecalculate = async () => {
    setCalculating(true);
    const { error } = await supabase.rpc("calculate_ubo", { p_company_entity_id: companyEntityId });
    if (error) toast.error(error.message);
    else toast.success("UBO recalculated for " + companyName);
    setCalculating(false);
    fetchData();
  };

  const nonCircular = snapshots.filter(s => !s.circular_detected && !s.unresolved_chain && s.person_entity_id);
  const circular = snapshots.filter(s => s.circular_detected);
  const unresolvedChains = snapshots.filter(s => s.unresolved_chain);

  const getPctBadge = (pct: number) => {
    if (pct >= 25) return <Badge className="bg-destructive text-destructive-foreground">{pct.toFixed(2)}%</Badge>;
    if (pct >= 10) return <Badge className="bg-warning text-warning-foreground">{pct.toFixed(2)}%</Badge>;
    return <Badge variant="secondary">{pct.toFixed(2)}%</Badge>;
  };

  const getPassport = (personId: string) => personDocs.find(d => d.entity_id === personId && d.document_type === "Passport");

  if (loading) return <div className="text-muted-foreground py-8 text-center">Loading UBO data...</div>;

  return (
    <div className="space-y-6">
      {/* Circular warning */}
      {circular.length > 0 && (
        <Alert className="border-warning/50 bg-warning/5">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertDescription className="text-warning">
            <strong>⚠ Circular Ownership Detected</strong> — UBO calculation cannot be completed for circular chains. Please review ownership links.
          </AlertDescription>
        </Alert>
      )}

      {/* Section 1: Direct Shareholders */}
      <Card className="shadow-sm">
        <CardHeader><CardTitle className="text-lg">Direct Shareholders</CardTitle></CardHeader>
        <CardContent>
          {ownedBy.length === 0 ? (
            <p className="text-muted-foreground text-sm">No direct shareholders linked.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Share Class</TableHead>
                  <TableHead>Shares</TableHead>
                  <TableHead>% Holding</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ownedBy.map(link => (
                  <TableRow key={link.id}>
                    <TableCell className="font-medium">{link.owner?.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs gap-1">
                        {link.owner?.type === "person" ? <User className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
                        {link.owner?.type === "person" ? "Person" : "Company"}
                      </Badge>
                    </TableCell>
                    <TableCell>{link.share_class?.class_name || "—"}</TableCell>
                    <TableCell>{link.shares_owned?.toLocaleString() || "—"}</TableCell>
                    <TableCell>{getPctBadge(Number(link.percentage))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Section 2: Ultimate Beneficial Owners */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Ultimate Beneficial Owners</CardTitle>
            {lastCalcTime && <span className="text-xs text-muted-foreground">Last calculated: {format(new Date(lastCalcTime), "MMM dd, yyyy HH:mm")}</span>}
          </div>
          <Button variant="outline" size="sm" onClick={handleRecalculate} disabled={calculating}>
            <RefreshCw className={`mr-2 h-4 w-4 ${calculating ? "animate-spin" : ""}`} />
            {calculating ? "Calculating..." : "Recalculate"}
          </Button>
        </CardHeader>
        <CardContent>
          {nonCircular.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Shield className="h-10 w-10 mb-3 opacity-30" />
              <p>No UBO data. Click "Recalculate" to generate.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>UBO Name</TableHead>
                  <TableHead>Economic %</TableHead>
                  <TableHead>Voting %</TableHead>
                  <TableHead>Chain</TableHead>
                  <TableHead>Layers</TableHead>
                  <TableHead>Threshold</TableHead>
                  <TableHead>Passport</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {nonCircular.map(s => {
                  const person = entities[s.person_entity_id];
                  const chain = Array.isArray(s.ownership_chain) ? s.ownership_chain : [];
                  const layers = Math.max(0, chain.length - 1);
                  const passport = getPassport(s.person_entity_id);
                  return (
                    <TableRow key={s.id}>
                      <TableCell>
                        <button className="flex items-center gap-1 text-primary hover:underline" onClick={() => navigate(`/entities/${s.person_entity_id}`)}>
                          <User className="h-3 w-3" /> {person?.name || "—"}
                        </button>
                      </TableCell>
                      <TableCell>{getPctBadge(Number(s.effective_economic_pct))}</TableCell>
                      <TableCell>{getPctBadge(Number(s.effective_voting_pct))}</TableCell>
                      <TableCell><span className="text-xs text-muted-foreground">{chain.map(c => c.entity_name).join(" → ")}</span></TableCell>
                      <TableCell><Badge variant="outline">{layers}</Badge></TableCell>
                      <TableCell>
                        {s.is_above_threshold ? <Badge className="bg-destructive text-destructive-foreground">✓ Above</Badge> : "—"}
                      </TableCell>
                      <TableCell>{passport ? <StatusBadge expiryDate={passport.expiry_date} /> : <span className="text-xs text-muted-foreground">No passport</span>}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedChain(s)}>
                          <Eye className="h-4 w-4 mr-1" /> Chain
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Section 3: Where This Company Appears as Owner */}
      {owns.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader><CardTitle className="text-lg">Subsidiaries (This Company as Owner)</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subsidiary</TableHead>
                  <TableHead>Direct %</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {owns.map(link => (
                  <TableRow key={link.id}>
                    <TableCell className="font-medium">{link.owned?.name}</TableCell>
                    <TableCell>{getPctBadge(Number(link.percentage))}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/entities/${link.owned?.id || link.owned_entity_id}`)}>
                        <ExternalLink className="h-4 w-4 mr-1" /> View UBO
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
              personName={entities[selectedChain.person_entity_id]?.name || "Unknown"}
              companyName={companyName}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
