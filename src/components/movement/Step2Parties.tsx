import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

interface Step2Props {
  data: any;
  onChange: (updates: any) => void;
  entities: any[];
}

export function Step2Parties({ data, onChange, entities }: Step2Props) {
  const { workspaceId } = useAuth();
  const [equityLinks, setEquityLinks] = useState<any[]>([]);
  const [shareClass, setShareClass] = useState<any>(null);

  const needsFrom = ["TRANSFER", "INHERITANCE", "GIFT", "COURT_ORDER", "CANCELLATION", "CAPITAL_DECREASE"].includes(data.movement_type);
  const needsTo = ["TRANSFER", "INHERITANCE", "GIFT", "COURT_ORDER", "ISSUANCE", "CAPITAL_INCREASE"].includes(data.movement_type);
  const isCapitalChange = ["CAPITAL_INCREASE", "CAPITAL_DECREASE"].includes(data.movement_type);

  useEffect(() => {
    if (!data.company_entity_id || !data.share_class_id || !workspaceId) return;
    Promise.all([
      supabase.from("equity_links")
        .select("*, owner:entities!equity_links_owner_entity_id_fkey(id, name, type)")
        .eq("owned_entity_id", data.company_entity_id)
        .eq("share_class_id", data.share_class_id)
        .eq("workspace_id", workspaceId)
        .is("end_date", null),
      supabase.from("share_classes").select("*").eq("id", data.share_class_id).single(),
    ]).then(([linksRes, scRes]) => {
      setEquityLinks(linksRes.data || []);
      setShareClass(scRes.data);
    });
  }, [data.company_entity_id, data.share_class_id, workspaceId]);

  const fromHolding = equityLinks.find(l => l.owner_entity_id === data.from_entity_id);
  const sharesError = needsFrom && fromHolding && data.shares_transferred > (fromHolding.shares_owned || 0);

  // Dilution preview for capital changes
  const showDilutionPreview = isCapitalChange && data.shares_transferred > 0 && shareClass;

  const newTotal = isCapitalChange && shareClass
    ? data.movement_type === "CAPITAL_INCREASE"
      ? shareClass.total_shares_issued + (data.shares_transferred || 0)
      : Math.max(0, shareClass.total_shares_issued - (data.shares_transferred || 0))
    : shareClass?.total_shares_issued || 0;

  return (
    <div className="space-y-6">
      {needsFrom && (
        <div className="space-y-2">
          <Label>{data.movement_type === "CANCELLATION" || data.movement_type === "CAPITAL_DECREASE" ? "Holder *" : "From Entity *"}</Label>
          <Select value={data.from_entity_id || ""} onValueChange={v => onChange({ from_entity_id: v })}>
            <SelectTrigger><SelectValue placeholder="Select entity" /></SelectTrigger>
            <SelectContent>
              {equityLinks.map(l => (
                <SelectItem key={l.owner_entity_id} value={l.owner_entity_id}>
                  {l.owner?.name} ({(l.shares_owned || 0).toLocaleString()} shares)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fromHolding && (
            <p className="text-xs text-muted-foreground">Current holding: {fromHolding.shares_owned?.toLocaleString()} shares ({Number(fromHolding.percentage).toFixed(2)}%)</p>
          )}
        </div>
      )}

      {needsTo && (
        <div className="space-y-2">
          <Label>{data.movement_type === "ISSUANCE" || data.movement_type === "CAPITAL_INCREASE" ? "Recipient *" : "To Entity *"}</Label>
          <Select value={data.to_entity_id || ""} onValueChange={v => onChange({ to_entity_id: v })}>
            <SelectTrigger><SelectValue placeholder="Select entity" /></SelectTrigger>
            <SelectContent>
              {entities.filter(e => e.id !== data.from_entity_id).map(e => (
                <SelectItem key={e.id} value={e.id}>{e.name} ({e.type})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label>Shares to {data.movement_type === "CANCELLATION" || data.movement_type === "CAPITAL_DECREASE" ? "Cancel" : "Transfer"} *</Label>
        <Input
          type="number"
          min={1}
          value={data.shares_transferred || ""}
          onChange={e => onChange({ shares_transferred: parseInt(e.target.value) || 0 })}
        />
        {sharesError && (
          <Alert className="border-destructive bg-destructive/10">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <AlertDescription className="text-destructive text-xs">
              Cannot transfer more shares than the holder owns ({fromHolding.shares_owned?.toLocaleString()}).
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Dilution preview for capital changes */}
      {showDilutionPreview && (
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Dilution / Concentration Preview</Label>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Shareholder</TableHead>
                <TableHead>Shares</TableHead>
                <TableHead>Current %</TableHead>
                <TableHead>After %</TableHead>
                <TableHead>Change</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {equityLinks.map(l => {
                const currentPct = shareClass.total_shares_issued > 0 ? (l.shares_owned / shareClass.total_shares_issued) * 100 : 0;
                const newShares = l.owner_entity_id === data.to_entity_id
                  ? l.shares_owned + (data.shares_transferred || 0)
                  : l.owner_entity_id === data.from_entity_id
                    ? l.shares_owned - (data.shares_transferred || 0)
                    : l.shares_owned;
                const newPct = newTotal > 0 ? (newShares / newTotal) * 100 : 0;
                const diff = newPct - currentPct;
                return (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.owner?.name}</TableCell>
                    <TableCell>{l.shares_owned.toLocaleString()}</TableCell>
                    <TableCell>{currentPct.toFixed(2)}%</TableCell>
                    <TableCell>{newPct.toFixed(2)}%</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={diff > 0 ? "text-green-600" : diff < 0 ? "text-destructive" : ""}>
                        {diff > 0 ? "+" : ""}{diff.toFixed(2)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground">Total issued: {shareClass.total_shares_issued.toLocaleString()} → {newTotal.toLocaleString()}</p>
        </div>
      )}
    </div>
  );
}
