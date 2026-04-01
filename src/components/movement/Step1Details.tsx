import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, ArrowRightLeft, PlusCircle, XCircle, Gift, Gavel, TrendingUp, TrendingDown, FileText, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const MOVEMENT_TYPES = [
  { value: "TRANSFER", label: "Transfer", icon: ArrowRightLeft, desc: "Transfer shares between entities" },
  { value: "ISSUANCE", label: "Issuance", icon: PlusCircle, desc: "Issue new shares to an entity" },
  { value: "CANCELLATION", label: "Cancellation", icon: XCircle, desc: "Cancel existing shares" },
  { value: "INHERITANCE", label: "Inheritance", icon: Users, desc: "Transfer shares via inheritance" },
  { value: "GIFT", label: "Gift", icon: Gift, desc: "Gift shares to another entity" },
  { value: "COURT_ORDER", label: "Court Order", icon: Gavel, desc: "Transfer by court order" },
  { value: "CAPITAL_INCREASE", label: "Capital Increase", icon: TrendingUp, desc: "Increase share capital" },
  { value: "CAPITAL_DECREASE", label: "Capital Decrease", icon: TrendingDown, desc: "Decrease share capital" },
];

interface Step1Props {
  data: any;
  onChange: (updates: any) => void;
  companies: any[];
}

export function Step1Details({ data, onChange, companies }: Step1Props) {
  const { workspaceId } = useAuth();
  const [shareClasses, setShareClasses] = useState<any[]>([]);
  const [duplicateRef, setDuplicateRef] = useState(false);
  const isFuture = data.movement_date && new Date(data.movement_date) > new Date();

  // Only live mode companies
  const liveCompanies = companies.filter(c => c.type === "company" && c.captable_status === "live");

  useEffect(() => {
    if (!data.company_entity_id || !workspaceId) { setShareClasses([]); return; }
    supabase.from("share_classes").select("*").eq("company_entity_id", data.company_entity_id).eq("workspace_id", workspaceId)
      .then(({ data: sc }) => setShareClasses(sc || []));
  }, [data.company_entity_id, workspaceId]);

  // Check duplicate reference number
  useEffect(() => {
    if (!data.reference_number || !data.company_entity_id || !workspaceId) { setDuplicateRef(false); return; }
    const timer = setTimeout(async () => {
      const { data: existing } = await supabase.from("movements").select("id")
        .eq("company_entity_id", data.company_entity_id).eq("reference_number", data.reference_number).eq("workspace_id", workspaceId).limit(1);
      setDuplicateRef((existing || []).length > 0);
    }, 300);
    return () => clearTimeout(timer);
  }, [data.reference_number, data.company_entity_id, workspaceId]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>Company *</Label>
        <Select value={data.company_entity_id || ""} onValueChange={v => onChange({ company_entity_id: v, share_class_id: "" })}>
          <SelectTrigger><SelectValue placeholder="Select a Live Mode company" /></SelectTrigger>
          <SelectContent>
            {liveCompanies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {liveCompanies.length === 0 && (
          <p className="text-xs text-muted-foreground">No companies in Live Mode. Activate Live Mode on a company first.</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Movement Type *</Label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {MOVEMENT_TYPES.map(mt => (
            <Card
              key={mt.value}
              className={`cursor-pointer transition-all hover:border-primary ${data.movement_type === mt.value ? "border-primary ring-2 ring-primary/20" : ""}`}
              onClick={() => onChange({ movement_type: mt.value })}
            >
              <CardContent className="p-3 flex flex-col items-center text-center gap-1">
                <mt.icon className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium">{mt.label}</span>
                <span className="text-xs text-muted-foreground">{mt.desc}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {data.company_entity_id && (
        <div className="space-y-2">
          <Label>Share Class *</Label>
          <Select value={data.share_class_id || ""} onValueChange={v => onChange({ share_class_id: v })}>
            <SelectTrigger><SelectValue placeholder="Select share class" /></SelectTrigger>
            <SelectContent>
              {shareClasses.map(sc => (
                <SelectItem key={sc.id} value={sc.id}>
                  {sc.class_name} ({sc.total_shares_issued.toLocaleString()} issued)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Movement Date *</Label>
          <Input type="date" value={data.movement_date || ""} onChange={e => onChange({ movement_date: e.target.value })} />
          {isFuture && (
            <Alert className="border-amber-300 bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 text-xs">
                Future-dated movement. Can only be saved as Draft.
              </AlertDescription>
            </Alert>
          )}
        </div>
        <div className="space-y-2">
          <Label>Reference Number</Label>
          <Input value={data.reference_number || ""} onChange={e => onChange({ reference_number: e.target.value })} placeholder="e.g. STD-2024-001" />
          {duplicateRef && (
            <Alert className="border-amber-300 bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 text-xs">
                This reference number already exists for this company.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Notes</Label>
        <Input value={data.notes || ""} onChange={e => onChange({ notes: e.target.value })} placeholder="Optional notes" />
      </div>
    </div>
  );
}
