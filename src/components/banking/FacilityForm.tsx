import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ACCESS_LEVELS,
  FACILITY_STATUSES,
  FACILITY_TYPES,
  STATEMENT_FREQUENCIES,
  STATEMENT_METHODS,
  TOKEN_STATUSES,
} from "@/lib/facility-utils";
import { logBankingActivity } from "@/lib/banking-utils";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  bankAccountId: string;
  persons: { id: string; name: string }[];
  editData?: any;
}

export function FacilityForm({ open, onClose, onSaved, bankAccountId, persons, editData }: Props) {
  const { workspaceId } = useAuth();
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState<any>({
    facility_type: editData?.facility_type || "internet_banking",
    status: editData?.status || "active",
    person_entity_id: editData?.person_entity_id || "",
    access_level: editData?.access_level || "",
    token_serial: editData?.token_serial || "",
    token_status: editData?.token_status || "none",
    token_issue_date: editData?.token_issue_date || "",
    transaction_limit: editData?.transaction_limit ?? "",
    daily_limit: editData?.daily_limit ?? "",
    limit_currency: editData?.limit_currency || "AED",
    sweep_target_account: editData?.sweep_target_account || "",
    sweep_type: editData?.sweep_type || "",
    sweep_threshold: editData?.sweep_threshold ?? "",
    sweep_frequency: editData?.sweep_frequency || "",
    statement_method: editData?.statement_method || "",
    statement_frequency: editData?.statement_frequency || "",
    statement_recipients: (editData?.statement_recipients || []).join(", "),
    cheque_book_number: editData?.cheque_book_number || "",
    leaf_range_start: editData?.leaf_range_start || "",
    leaf_range_end: editData?.leaf_range_end || "",
    leaves_issued_date: editData?.leaves_issued_date || "",
    annual_fee: editData?.annual_fee ?? "",
    fee_currency: editData?.fee_currency || "AED",
    fee_notes: editData?.fee_notes || "",
    umbrella_ref: editData?.umbrella_ref || "",
    effective_date: editData?.effective_date || "",
    end_date: editData?.end_date || "",
    bank_reference: editData?.bank_reference || "",
    notes: editData?.notes || "",
  });

  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const num = (v: any) => (v === "" || v === null ? null : Number(v));

  const handleSave = async () => {
    if (!workspaceId) return;
    setSaving(true);
    const payload: any = {
      workspace_id: workspaceId,
      bank_account_id: bankAccountId,
      facility_type: f.facility_type,
      status: f.status,
      person_entity_id: f.person_entity_id || null,
      access_level: f.facility_type === "internet_banking" && f.access_level ? f.access_level : null,
      token_serial: f.token_serial || null,
      token_status: f.token_status,
      token_issue_date: f.token_issue_date || null,
      transaction_limit: num(f.transaction_limit),
      daily_limit: num(f.daily_limit),
      limit_currency: f.limit_currency || "AED",
      sweep_target_account: f.sweep_target_account || null,
      sweep_type: f.sweep_type || null,
      sweep_threshold: num(f.sweep_threshold),
      sweep_frequency: f.sweep_frequency || null,
      statement_method: f.statement_method || null,
      statement_frequency: f.statement_frequency || null,
      statement_recipients: f.statement_recipients
        ? f.statement_recipients.split(",").map((s: string) => s.trim()).filter(Boolean)
        : [],
      cheque_book_number: f.cheque_book_number || null,
      leaf_range_start: f.leaf_range_start || null,
      leaf_range_end: f.leaf_range_end || null,
      leaves_issued_date: f.leaves_issued_date || null,
      annual_fee: num(f.annual_fee),
      fee_currency: f.fee_currency || null,
      fee_notes: f.fee_notes || null,
      umbrella_ref: f.umbrella_ref || null,
      effective_date: f.effective_date || null,
      end_date: f.end_date || null,
      bank_reference: f.bank_reference || null,
      notes: f.notes || null,
    };

    const { data: profile } = await supabase
      .from("profiles").select("id")
      .eq("user_id", (await supabase.auth.getUser()).data.user?.id || "").maybeSingle();

    const typeLabel = FACILITY_TYPES.find(t => t.value === f.facility_type)?.label || f.facility_type;

    if (editData) {
      const { error } = await supabase.from("bank_facilities" as any).update(payload).eq("id", editData.id);
      if (error) { toast.error(error.message); setSaving(false); return; }
      await logBankingActivity(bankAccountId, "facility_updated", `Facility "${typeLabel}" updated`, profile?.id || "", workspaceId);
      toast.success("Facility updated");
    } else {
      const { error } = await supabase.from("bank_facilities" as any).insert(payload);
      if (error) { toast.error(error.message); setSaving(false); return; }
      await logBankingActivity(bankAccountId, "facility_created", `Facility "${typeLabel}" added`, profile?.id || "", workspaceId);
      toast.success("Facility added");
    }
    setSaving(false);
    onSaved();
  };

  const t = f.facility_type;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editData ? "Edit Facility" : "Add Facility"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Facility Type *</Label>
              <Select value={f.facility_type} onValueChange={v => set("facility_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FACILITY_TYPES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Status</Label>
              <Select value={f.status} onValueChange={v => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FACILITY_STATUSES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div><Label>Linked Person</Label>
              <Select value={f.person_entity_id || "none"} onValueChange={v => set("person_entity_id", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {persons.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {t === "internet_banking" && (
              <div><Label>Access Level</Label>
                <Select value={f.access_level || "none"} onValueChange={v => set("access_level", v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {ACCESS_LEVELS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {(t === "internet_banking" || t === "card") && (
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Token / Device Serial</Label><Input value={f.token_serial} onChange={e => set("token_serial", e.target.value)} /></div>
              <div><Label>Token Status</Label>
                <Select value={f.token_status} onValueChange={v => set("token_status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TOKEN_STATUSES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Token Issue Date</Label><Input type="date" value={f.token_issue_date} onChange={e => set("token_issue_date", e.target.value)} /></div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div><Label>Transaction Limit</Label><Input type="number" value={f.transaction_limit} onChange={e => set("transaction_limit", e.target.value)} /></div>
            <div><Label>Daily Limit</Label><Input type="number" value={f.daily_limit} onChange={e => set("daily_limit", e.target.value)} /></div>
            <div><Label>Currency</Label><Input value={f.limit_currency} onChange={e => set("limit_currency", e.target.value)} /></div>
          </div>

          {t === "sweep" && (
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Target / Linked Account</Label><Input value={f.sweep_target_account} onChange={e => set("sweep_target_account", e.target.value)} /></div>
              <div><Label>Sweep Type</Label><Input placeholder="Auto sweep in / out, target balance" value={f.sweep_type} onChange={e => set("sweep_type", e.target.value)} /></div>
              <div><Label>Threshold Amount</Label><Input type="number" value={f.sweep_threshold} onChange={e => set("sweep_threshold", e.target.value)} /></div>
              <div><Label>Frequency</Label><Input value={f.sweep_frequency} onChange={e => set("sweep_frequency", e.target.value)} /></div>
            </div>
          )}

          {t === "statement_delivery" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Delivery Method</Label>
                  <Select value={f.statement_method || "none"} onValueChange={v => set("statement_method", v === "none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {STATEMENT_METHODS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Frequency</Label>
                  <Select value={f.statement_frequency || "none"} onValueChange={v => set("statement_frequency", v === "none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {STATEMENT_FREQUENCIES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Recipient Emails (comma separated)</Label><Input value={f.statement_recipients} onChange={e => set("statement_recipients", e.target.value)} /></div>
            </div>
          )}

          {t === "cheque_book" && (
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Cheque Book Number</Label><Input value={f.cheque_book_number} onChange={e => set("cheque_book_number", e.target.value)} /></div>
              <div><Label>Issued Date</Label><Input type="date" value={f.leaves_issued_date} onChange={e => set("leaves_issued_date", e.target.value)} /></div>
              <div><Label>Leaf Range Start</Label><Input value={f.leaf_range_start} onChange={e => set("leaf_range_start", e.target.value)} /></div>
              <div><Label>Leaf Range End</Label><Input value={f.leaf_range_end} onChange={e => set("leaf_range_end", e.target.value)} /></div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div><Label>Annual / Recurring Fee</Label><Input type="number" value={f.annual_fee} onChange={e => set("annual_fee", e.target.value)} /></div>
            <div><Label>Fee Currency</Label><Input value={f.fee_currency} onChange={e => set("fee_currency", e.target.value)} /></div>
            <div><Label>Umbrella Reference</Label><Input value={f.umbrella_ref} onChange={e => set("umbrella_ref", e.target.value)} /></div>
          </div>
          <div><Label>Fee Notes</Label><Input value={f.fee_notes} onChange={e => set("fee_notes", e.target.value)} /></div>

          <div className="grid grid-cols-3 gap-4">
            <div><Label>Effective Date</Label><Input type="date" value={f.effective_date} onChange={e => set("effective_date", e.target.value)} /></div>
            <div><Label>End Date</Label><Input type="date" value={f.end_date} onChange={e => set("end_date", e.target.value)} /></div>
            <div><Label>Bank Reference</Label><Input value={f.bank_reference} onChange={e => set("bank_reference", e.target.value)} /></div>
          </div>
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
