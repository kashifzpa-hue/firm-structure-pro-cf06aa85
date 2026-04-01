import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

interface Step4Props {
  data: any;
  entities: any[];
  companies: any[];
  outOfOrderAcknowledged: boolean;
  onOutOfOrderChange: (v: boolean) => void;
}

export function Step4Confirm({ data, entities, companies, outOfOrderAcknowledged, onOutOfOrderChange }: Step4Props) {
  const { workspaceId } = useAuth();
  const [hasEarlierDrafts, setHasEarlierDrafts] = useState(false);
  const isFuture = data.movement_date && new Date(data.movement_date) > new Date();

  const entityName = (id: string) => entities.find(e => e.id === id)?.name || "—";
  const companyName = companies.find(c => c.id === data.company_entity_id)?.name || "—";

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
