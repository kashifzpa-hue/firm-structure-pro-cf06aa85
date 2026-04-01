import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { UBOChainVisualizer } from "@/components/ubo/UBOChainVisualizer";
import { Shield, Eye, Building2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface PersonUBOTabProps {
  personEntityId: string;
  personName: string;
}

export function PersonUBOTab({ personEntityId, personName }: PersonUBOTabProps) {
  const { workspaceId } = useAuth();
  const navigate = useNavigate();
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [entities, setEntities] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [selectedChain, setSelectedChain] = useState<any>(null);

  useEffect(() => {
    if (!workspaceId) return;
    const fetch = async () => {
      const [snapshotsRes, entitiesRes] = await Promise.all([
        supabase.from("ubo_snapshots").select("*").eq("person_entity_id", personEntityId).eq("workspace_id", workspaceId).eq("snapshot_type", "live").eq("circular_detected", false),
        supabase.from("entities").select("id, name, type").eq("workspace_id", workspaceId),
      ]);
      setSnapshots(snapshotsRes.data || []);
      const map: Record<string, any> = {};
      (entitiesRes.data || []).forEach(e => { map[e.id] = e; });
      setEntities(map);
      setLoading(false);
    };
    fetch();
  }, [personEntityId, workspaceId]);

  const aboveCount = snapshots.filter(s => s.is_above_threshold).length;

  const getPctBadge = (pct: number) => {
    if (pct >= 25) return <Badge className="bg-destructive text-destructive-foreground">{pct.toFixed(2)}%</Badge>;
    if (pct >= 10) return <Badge className="bg-warning text-warning-foreground">{pct.toFixed(2)}%</Badge>;
    return <Badge variant="secondary">{pct.toFixed(2)}%</Badge>;
  };

  if (loading) return <div className="text-muted-foreground py-8 text-center">Loading...</div>;

  return (
    <div className="space-y-6">
      {snapshots.length > 0 && (
        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <p className="text-sm">
              <strong>{personName}</strong> is a UBO in <strong>{snapshots.length}</strong> compan{snapshots.length === 1 ? "y" : "ies"}, above the 25% threshold in <strong className="text-destructive">{aboveCount}</strong> of them.
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-sm">
        <CardHeader><CardTitle className="text-lg">UBO Exposure</CardTitle></CardHeader>
        <CardContent>
          {snapshots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Shield className="h-10 w-10 mb-3 opacity-30" />
              <p>Not identified as a UBO in any company.</p>
              <p className="text-xs mt-1">Run "Recalculate All" from the UBO Registry page.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Economic %</TableHead>
                  <TableHead>Voting %</TableHead>
                  <TableHead>Threshold</TableHead>
                  <TableHead>Chain</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snapshots.map(s => {
                  const company = entities[s.company_entity_id];
                  const chain = Array.isArray(s.ownership_chain) ? s.ownership_chain : [];
                  return (
                    <TableRow key={s.id}>
                      <TableCell>
                        <button className="flex items-center gap-1 text-primary hover:underline" onClick={() => navigate(`/entities/${s.company_entity_id}`)}>
                          <Building2 className="h-3 w-3" /> {company?.name || "—"}
                        </button>
                      </TableCell>
                      <TableCell>{getPctBadge(Number(s.effective_economic_pct))}</TableCell>
                      <TableCell>{getPctBadge(Number(s.effective_voting_pct))}</TableCell>
                      <TableCell>
                        {s.is_above_threshold ? <Badge className="bg-destructive text-destructive-foreground">✓ Above</Badge> : "—"}
                      </TableCell>
                      <TableCell><span className="text-xs text-muted-foreground">{chain.map((c: any) => c.entity_name).join(" → ")}</span></TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedChain(s)}>
                          <Eye className="h-4 w-4 mr-1" /> View Chain
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

      <Dialog open={!!selectedChain} onOpenChange={(v) => !v && setSelectedChain(null)}>
        <DialogContent className="max-w-[95vw] h-[90vh] p-0">
          {selectedChain && (
            <UBOChainVisualizer
              snapshot={selectedChain}
              personName={personName}
              companyName={entities[selectedChain.company_entity_id]?.name || "Unknown"}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
