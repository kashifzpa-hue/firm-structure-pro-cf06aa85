import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Eye, TableProperties, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";
import { MovementTimeline } from "@/components/MovementTimeline";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface LedgerTabProps {
  companyEntityId: string;
  companyName: string;
  incorporationDate: string | null;
  workspaceId: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-amber-100 text-amber-700",
  confirmed: "bg-green-100 text-green-700",
  voided: "bg-destructive/10 text-destructive",
};

export function LedgerTab({ companyEntityId, companyName, incorporationDate, workspaceId }: LedgerTabProps) {
  const navigate = useNavigate();
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeMachineDate, setTimeMachineDate] = useState("");
  const [timeMachineSnapshot, setTimeMachineSnapshot] = useState<any[] | null>(null);
  const [tmLoading, setTmLoading] = useState(false);

  useEffect(() => {
    supabase.from("movements")
      .select("*, share_class:share_classes(class_name), from_entity:entities!movements_from_entity_id_fkey(name), to_entity:entities!movements_to_entity_id_fkey(name)")
      .eq("company_entity_id", companyEntityId)
      .eq("workspace_id", workspaceId)
      .order("movement_date", { ascending: false })
      .then(({ data }) => { setMovements(data || []); setLoading(false); });
  }, [companyEntityId, workspaceId]);

  const handleTimeMachine = async () => {
    if (!timeMachineDate) return;
    if (incorporationDate && timeMachineDate < incorporationDate) {
      setTimeMachineSnapshot([]);
      return;
    }
    setTmLoading(true);
    // Get all confirmed movements up to date
    const { data: confirmedMov } = await supabase.from("movements")
      .select("*, share_class:share_classes(class_name, total_shares_issued), to_entity:entities!movements_to_entity_id_fkey(name), from_entity:entities!movements_from_entity_id_fkey(name)")
      .eq("company_entity_id", companyEntityId)
      .eq("workspace_id", workspaceId)
      .eq("status", "confirmed")
      .lte("movement_date", timeMachineDate)
      .order("movement_date", { ascending: true });

    // Replay to build snapshot
    const holdings: Record<string, { entityName: string; shareClassName: string; shares: number; shareClassId: string }> = {};
    const totalIssued: Record<string, number> = {};

    (confirmedMov || []).forEach((m: any) => {
      const scId = m.share_class_id;
      const scName = m.share_class?.class_name || "Unknown";

      if (m.movement_type === "CAPITAL_INCREASE") {
        totalIssued[scId] = (totalIssued[scId] || 0) + m.shares_transferred;
      } else if (m.movement_type === "CAPITAL_DECREASE") {
        totalIssued[scId] = (totalIssued[scId] || 0) - m.shares_transferred;
      }

      if (m.from_entity_id) {
        const key = `${m.from_entity_id}_${scId}`;
        if (!holdings[key]) holdings[key] = { entityName: m.from_entity?.name || "Unknown", shareClassName: scName, shares: 0, shareClassId: scId };
        holdings[key].shares -= m.shares_transferred;
      }
      if (m.to_entity_id) {
        const key = `${m.to_entity_id}_${scId}`;
        if (!holdings[key]) holdings[key] = { entityName: m.to_entity?.name || "Unknown", shareClassName: scName, shares: 0, shareClassId: scId };
        holdings[key].shares += m.shares_transferred;
      }
    });

    // Get share class totals for percentage calc
    const { data: shareClasses } = await supabase.from("share_classes")
      .select("id, class_name, total_shares_issued")
      .eq("company_entity_id", companyEntityId)
      .eq("workspace_id", workspaceId);

    const scTotals: Record<string, number> = {};
    (shareClasses || []).forEach(sc => {
      scTotals[sc.id] = totalIssued[sc.id] !== undefined ? totalIssued[sc.id] : sc.total_shares_issued;
    });

    const snapshot = Object.values(holdings)
      .filter(h => h.shares > 0)
      .map(h => ({
        ...h,
        percentage: scTotals[h.shareClassId] > 0 ? (h.shares / scTotals[h.shareClassId]) * 100 : 0,
      }));

    setTimeMachineSnapshot(snapshot);
    setTmLoading(false);
  };

  const isBeforeIncorporation = timeMachineDate && incorporationDate && timeMachineDate < incorporationDate;

  if (loading) return <div className="text-muted-foreground text-center py-8">Loading...</div>;

  return (
    <div className="space-y-6">
      {/* View Toggle */}
      <Tabs defaultValue="table">
        <TabsList>
          <TabsTrigger value="table" className="gap-1.5"><TableProperties className="h-3.5 w-3.5" /> Table View</TabsTrigger>
          <TabsTrigger value="timeline" className="gap-1.5"><Clock className="h-3.5 w-3.5" /> Timeline View</TabsTrigger>
        </TabsList>
        <TabsContent value="timeline" className="mt-4">
          <MovementTimeline movements={movements} companyName={companyName} />
        </TabsContent>
        <TabsContent value="table" className="mt-4">
          <div className="space-y-6">
      {/* Time Machine */}
      <Card className="shadow-sm">
        <CardHeader><CardTitle className="text-lg">Cap Table as of Date</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-end gap-3 mb-4">
            <div className="space-y-1">
              <Label>Select Date</Label>
              <Input type="date" value={timeMachineDate} onChange={e => { setTimeMachineDate(e.target.value); setTimeMachineSnapshot(null); }} />
            </div>
            <Button onClick={handleTimeMachine} disabled={!timeMachineDate || tmLoading}>
              {tmLoading ? "Loading..." : "View Snapshot"}
            </Button>
          </div>
          {isBeforeIncorporation && (
            <p className="text-sm text-muted-foreground">No shareholding data before {incorporationDate}.</p>
          )}
          {timeMachineSnapshot && !isBeforeIncorporation && (
            timeMachineSnapshot.length === 0 ? (
              <p className="text-sm text-muted-foreground">No shareholding data for this date.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Shareholder</TableHead>
                    <TableHead>Share Class</TableHead>
                    <TableHead>Shares</TableHead>
                    <TableHead>%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timeMachineSnapshot.map((h, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{h.entityName}</TableCell>
                      <TableCell>{h.shareClassName}</TableCell>
                      <TableCell>{h.shares.toLocaleString()}</TableCell>
                      <TableCell><Badge variant="secondary">{h.percentage.toFixed(2)}%</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          )}
        </CardContent>
      </Card>

      {/* Movement History */}
      <Card className="shadow-sm">
        <CardHeader><CardTitle className="text-lg">Movements for {companyName}</CardTitle></CardHeader>
        <CardContent>
          {movements.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">No movements recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Share Class</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Shares</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map(m => (
                  <TableRow key={m.id} className={m.status === "voided" ? "opacity-50" : ""}>
                    <TableCell>{format(parseISO(m.movement_date), "MMM dd, yyyy")}</TableCell>
                    <TableCell><Badge variant="outline">{m.movement_type.replace(/_/g, " ")}</Badge></TableCell>
                    <TableCell>{m.share_class?.class_name || "—"}</TableCell>
                    <TableCell>{m.from_entity?.name || "—"}</TableCell>
                    <TableCell>{m.to_entity?.name || "—"}</TableCell>
                    <TableCell>{m.shares_transferred.toLocaleString()}</TableCell>
                    <TableCell><Badge className={STATUS_COLORS[m.status] || ""}>{m.status}</Badge></TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/ledger/${m.id}`)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
