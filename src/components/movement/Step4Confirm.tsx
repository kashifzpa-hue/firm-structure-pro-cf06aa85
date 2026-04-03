import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Loader2 } from "lucide-react";

interface Step4Props {
  data: any;
  entities: any[];
  companies: any[];
  outOfOrderAcknowledged: boolean;
  onOutOfOrderChange: (v: boolean) => void;
  onCircularDetected: (detected: boolean) => void;
}

const CIRCULAR_CHECK_TYPES = ["TRANSFER", "ISSUANCE", "CAPITAL_INCREASE"];

export function Step4Confirm({ data, entities, companies, outOfOrderAcknowledged, onOutOfOrderChange, onCircularDetected }: Step4Props) {
  const { workspaceId } = useAuth();
  const [hasEarlierDrafts, setHasEarlierDrafts] = useState(false);
  const [circularChecking, setCircularChecking] = useState(false);
  const [circularDetected, setCircularDetected] = useState(false);
  const [circularCheckError, setCircularCheckError] = useState(false);
  const isFuture = data.movement_date && new Date(data.movement_date) > new Date();

  const entityName = (id: string) => entities.find(e => e.id === id)?.name || "—";
  const companyName = companies.find(c => c.id === data.company_entity_id)?.name || "—";

  // Check for earlier drafts
  useEffect(() => {
    if (!data.company_entity_id || !data.share_class_id || !data.movement_date || !workspaceId) return;
    supabase.from("movements").select("id")
      .eq("company_entity_id", data.company_entity_id)
      .eq("share_class_id", data.share_class_id)
      .eq("status", "draft")
      .lt("movement_date", data.movement_date)
      .eq("workspace_id", workspaceId)
      .limit(1)
      .then(({ data: drafts }) => setHasEarlierDrafts((drafts || []).length > 0));
  }, [data.company_entity_id, data.share_class_id, data.movement_date, workspaceId]);

  // Circular ownership check
  useEffect(() => {
    const shouldCheck = CIRCULAR_CHECK_TYPES.includes(data.movement_type) && data.to_entity_id && data.company_entity_id;
    if (!shouldCheck) {
      setCircularDetected(false);
      setCircularCheckError(false);
      onCircularDetected(false);
      return;
    }

    setCircularChecking(true);
    setCircularCheckError(false);

    supabase.rpc("check_circular_ownership", {
      p_company_entity_id: data.to_entity_id,
      p_potential_owner_id: data.company_entity_id,
    }).then(({ data: isCircular, error }) => {
      setCircularChecking(false);
      if (error) {
        console.error("Circular check failed:", error);
        setCircularCheckError(true);
        setCircularDetected(false);
        onCircularDetected(false);
        return;
      }
      setCircularDetected(!!isCircular);
      onCircularDetected(!!isCircular);
    });
  }, [data.company_entity_id, data.to_entity_id, data.movement_type]);

  return (
    <div className="space-y-6">
      <h3 className="font-semibold text-lg">Movement Summary</h3>

      <div className="rounded-lg border p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-muted-foreground">Company:</span> <span className="font-medium">{companyName}</span></div>
          <div><span className="text-muted-foreground">Type:</span> <Badge variant="outline">{data.movement_type?.replace(/_/g, " ")}</Badge></div>
          <div><span className="text-muted-foreground">Date:</span> <span className="font-medium">{data.movement_date || "—"}</span></div>
          <div><span className="text-muted-foreground">Shares:</span> <span className="font-medium">{(data.shares_transferred || 0).toLocaleString()}</span></div>
          {data.from_entity_id && <div><span className="text-muted-foreground">From:</span> <span className="font-medium">{entityName(data.from_entity_id)}</span></div>}
          {data.to_entity_id && <div><span className="text-muted-foreground">To:</span> <span className="font-medium">{entityName(data.to_entity_id)}</span></div>}
          {data.total_consideration && <div><span className="text-muted-foreground">Consideration:</span> <span className="font-medium">{data.currency || ""} {data.total_consideration?.toLocaleString()}</span></div>}
          {data.reference_number && <div><span className="text-muted-foreground">Reference:</span> <span className="font-medium">{data.reference_number}</span></div>}
        </div>
      </div>

      {circularChecking && (
        <Alert className="border-blue-300 bg-blue-50">
          <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
          <AlertDescription className="text-blue-800 text-sm">
            Checking ownership structure...
          </AlertDescription>
        </Alert>
      )}

      {circularCheckError && (
        <Alert className="border-amber-300 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 text-sm">
            Could not verify ownership chain. Proceed with caution.
          </AlertDescription>
        </Alert>
      )}

      {circularDetected && !circularChecking && (
        <Alert className="border-destructive bg-destructive/5">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <AlertDescription className="text-destructive text-sm">
            <strong>Circular ownership detected.</strong> {entityName(data.to_entity_id)} already appears in the ownership chain above {companyName}.
            The Confirm button is blocked — use "Confirm with Exception" if a legal exception applies.
          </AlertDescription>
        </Alert>
      )}

      {isFuture && (
        <Alert className="border-amber-300 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 text-sm">
            This movement is future-dated. It can only be saved as Draft and must be manually confirmed when the date arrives.
          </AlertDescription>
        </Alert>
      )}

      {hasEarlierDrafts && (
        <Alert className="border-amber-300 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 text-sm space-y-2">
            <p>There are earlier draft movements for this company and share class. Confirming out of order may create inconsistencies.</p>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={outOfOrderAcknowledged} onCheckedChange={v => onOutOfOrderChange(!!v)} />
              <span className="text-sm">I understand and wish to proceed</span>
            </label>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
