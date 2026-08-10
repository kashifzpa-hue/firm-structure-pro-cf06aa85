import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { CREDIT_LIMIT_STATUSES, CREDIT_LIMIT_TYPES } from "@/lib/facility-utils";
import { logBankingActivity } from "@/lib/banking-utils";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  cifId: string;
  entities: { id: string; name: string }[];
  parentLimits: { id: string; label: string }[];
  editData?: any;
}

export function CreditLimitForm({ open, onClose, onSaved, cifId, entities, parentLimits, editData }: Props) {
  const { workspaceId } = useAuth();
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState<any>({
    limit_type: editData?.limit_type || "overdraft",
    status: editData?.status || "active",
    is_funded: editData?.is_funded ?? true,
    umbrella_ref: editData?.umbrella_ref || "",
    parent_limit_id: editData?.parent_limit_id || "",
    sanctioned_amount: editData?.sanctioned_amount ?? "",
    currency: editData?.currency || "AED",
    utilised_amount: editData?.utilised_amount ?? "",
    utilised_as_of: editData?.utilised_as_of || "",
    pricing_basis: editData?.pricing_basis || "",
    fee_notes: editData?.fee_notes || "",
    tenor: editData?.tenor || "",
    security_summary: editData?.security_summary || "",
    guarantor_entity_id: editData?.guarantor_entity_id || "",
    covenant_notes: editData?.covenant_notes || "",
    sanction_date: editData?.sanction_date || "",
    availability_start_date: editData?.availability_start_date || "",
    next_review_date: editData?.next_review_date || "",
    expiry_date: editData?.expiry_date || "",
    last_renewed_on: editData?.last_renewed_on || "",
    offer_letter_ref: editData?.offer_letter_ref || "",
    notes: editData?.notes || "",
  });

  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const num = (v: any) => (v === "" || v === null ? null : Number(v));

  const handleSave = async () => {
    if (!workspaceId) return;
    setSaving(true);
    const payload: any = {
      workspace_id: workspaceId,
      cif_id: cifId,
      bank_account_id: null,
      limit_type: f.limit_type,
      status: f.status,
      is_funded: f.is_funded,
      umbrella_ref: f.umbrella_ref || null,
      parent_limit_id: f.parent_limit_id || null,
      sanctioned_amount: num(f.sanctioned_amount) ?? 0,
      currency: f.currency || "AED",
      utilised_amount: num(f.utilised_amount),
      utilised_as_of: f.utilised_as_of || null,
      pricing_basis: f.pricing_basis || null,
      fee_notes: f.fee_notes || null,
      tenor: f.tenor || null,
      security_summary: f.security_summary || null,
      guarantor_entity_id: f.guarantor_entity_id || null,
      covenant_notes: f.covenant_notes || null,
      sanction_date: f.sanction_date || null,
      availability_start_date: f.availability_start_date || null,
      next_review_date: f.next_review_date || null,
      expiry_date: f.expiry_date || null,
      last_renewed_on: f.last_renewed_on || null,
      offer_letter_ref: f.offer_letter_ref || null,
      notes: f.notes || null,
    };

    const { data: profile } = await supabase
      .from("profiles").select("id")
      .eq("user_id", (await supabase.auth.getUser()).data.user?.id || "").maybeSingle();
    const typeLabel = CREDIT_LIMIT_TYPES.find(t => t.value === f.limit_type)?.label || f.limit_type;

    if (editData) {
      const { error } = await supabase.from("bank_credit_limits" as any).update(payload).eq("id", editData.id);
      if (error) { toast.error(error.message); setSaving(false); return; }
      await logBankingActivity(null, "limit_updated", `Borrowing limit "${typeLabel}" updated`, profile?.id || "", workspaceId, cifId);
      toast.success("Limit updated");
    } else {
      const { error } = await supabase.from("bank_credit_limits" as any).insert(payload);
      if (error) { toast.error(error.message); setSaving(false); return; }
      await logBankingActivity(null, "limit_created", `Borrowing limit "${typeLabel}" added`, profile?.id || "", workspaceId, cifId);
      toast.success("Limit added");
    }
    setSaving(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editData ? "Edit Borrowing Limit" : "Add Borrowing Limit"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Limit Type *</Label>
              <Select value={f.limit_type} onValueChange={v => set("limit_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CREDIT_LIMIT_TYPES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Status</Label>
              <Select value={f.status} onValueChange={v => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CREDIT_LIMIT_STATUSES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label>Funded facility</Label>
              <p className="text-xs text-muted-foreground">Off for non-funded lines (LCs, guarantees)</p>
            </div>
            <Switch checked={f.is_funded} onCheckedChange={v => set("is_funded", v)} />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div><Label>Sanctioned Amount</Label><Input type="number" value={f.sanctioned_amount} onChange={e => set("sanctioned_amount", e.target.value)} /></div>
            <div><Label>Currency</Label><Input value={f.currency} onChange={e => set("currency", e.target.value)} /></div>
            <div><Label>Utilised Amount</Label><Input type="number" value={f.utilised_amount} onChange={e => set("utilised_amount", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Utilised As Of</Label><Input type="date" value={f.utilised_as_of} onChange={e => set("utilised_as_of", e.target.value)} /></div>
            <div><Label>Sub-limit Of</Label>
              <Select value={f.parent_limit_id || "none"} onValueChange={v => set("parent_limit_id", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {parentLimits.filter(p => p.id !== editData?.id).map(p => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div><Label>Pricing Basis</Label><Input placeholder="EIBOR + 2.5%" value={f.pricing_basis} onChange={e => set("pricing_basis", e.target.value)} /></div>
            <div><Label>Tenor</Label><Input placeholder="12 months" value={f.tenor} onChange={e => set("tenor", e.target.value)} /></div>
          </div>
          <div><Label>Commission / Fee Notes</Label><Input value={f.fee_notes} onChange={e => set("fee_notes", e.target.value)} /></div>

          <div className="grid grid-cols-2 gap-4">
            <div><Label>Guarantor</Label>
              <Select value={f.guarantor_entity_id || "none"} onValueChange={v => set("guarantor_entity_id", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {entities.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Umbrella Reference</Label><Input value={f.umbrella_ref} onChange={e => set("umbrella_ref", e.target.value)} /></div>
          </div>
          <div><Label>Security / Collateral</Label><Textarea value={f.security_summary} onChange={e => set("security_summary", e.target.value)} /></div>
          <div><Label>Covenant Notes</Label><Textarea value={f.covenant_notes} onChange={e => set("covenant_notes", e.target.value)} /></div>

          <div className="border-t pt-4"><Label className="text-sm font-semibold">Key Dates</Label></div>
          <div className="grid grid-cols-3 gap-4">
            <div><Label>Sanction Date</Label><Input type="date" value={f.sanction_date} onChange={e => set("sanction_date", e.target.value)} /></div>
            <div><Label>Availability Start</Label><Input type="date" value={f.availability_start_date} onChange={e => set("availability_start_date", e.target.value)} /></div>
            <div><Label>Last Renewed On</Label><Input type="date" value={f.last_renewed_on} onChange={e => set("last_renewed_on", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Next Review / Renewal Date</Label><Input type="date" value={f.next_review_date} onChange={e => set("next_review_date", e.target.value)} /></div>
            <div><Label>Expiry Date</Label><Input type="date" value={f.expiry_date} onChange={e => set("expiry_date", e.target.value)} /></div>
          </div>

          <div><Label>Offer / Sanction Letter Reference</Label><Input value={f.offer_letter_ref} onChange={e => set("offer_letter_ref", e.target.value)} /></div>
          <div><Label>Notes</Label><Textarea value={f.notes} onChange={e => set("notes", e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : editData ? "Update" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
