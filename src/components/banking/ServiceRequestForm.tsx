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
import { REQUEST_STATUSES, REQUEST_TYPES } from "@/lib/facility-utils";
import { logBankingActivity } from "@/lib/banking-utils";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  bankAccountId: string;
  facilities: { id: string; label: string }[];
  limits: { id: string; label: string }[];
  signatories: { id: string; label: string }[];
  editData?: any;
  defaults?: Partial<Record<string, any>>;
}

export function ServiceRequestForm({
  open, onClose, onSaved, bankAccountId, facilities, limits, signatories, editData, defaults,
}: Props) {
  const { workspaceId } = useAuth();
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState<any>({
    request_type: editData?.request_type || defaults?.request_type || "new_facility",
    status: editData?.status || "draft",
    subject: editData?.subject || defaults?.subject || "",
    description: editData?.description || "",
    facility_id: editData?.facility_id || defaults?.facility_id || "",
    credit_limit_id: editData?.credit_limit_id || defaults?.credit_limit_id || "",
    signatory_id: editData?.signatory_id || "",
    date_requested: editData?.date_requested || new Date().toISOString().split("T")[0],
    date_submitted: editData?.date_submitted || "",
    bank_ack_date: editData?.bank_ack_date || "",
    expected_completion: editData?.expected_completion || "",
    actual_completion: editData?.actual_completion || "",
    bank_contact: editData?.bank_contact || "",
    bank_reference: editData?.bank_reference || "",
    outcome_notes: editData?.outcome_notes || "",
  });

  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!workspaceId) return;
    if (!f.subject.trim()) { toast.error("Subject is required"); return; }
    setSaving(true);

    const { data: profile } = await supabase
      .from("profiles").select("id")
      .eq("user_id", (await supabase.auth.getUser()).data.user?.id || "").maybeSingle();

    const payload: any = {
      workspace_id: workspaceId,
      bank_account_id: bankAccountId,
      request_type: f.request_type,
      status: f.status,
      subject: f.subject,
      description: f.description || null,
      facility_id: f.facility_id || null,
      credit_limit_id: f.credit_limit_id || null,
      signatory_id: f.signatory_id || null,
      date_requested: f.date_requested || new Date().toISOString().split("T")[0],
      date_submitted: f.date_submitted || null,
      bank_ack_date: f.bank_ack_date || null,
      expected_completion: f.expected_completion || null,
      actual_completion: f.actual_completion || null,
      bank_contact: f.bank_contact || null,
      bank_reference: f.bank_reference || null,
      outcome_notes: f.outcome_notes || null,
      requested_by: editData?.requested_by || profile?.id || null,
    };

    const typeLabel = REQUEST_TYPES.find(t => t.value === f.request_type)?.label || f.request_type;

    if (editData) {
      const { error } = await supabase.from("bank_service_requests" as any).update(payload).eq("id", editData.id);
      if (error) { toast.error(error.message); setSaving(false); return; }
      const statusChanged = editData.status !== f.status;
      await logBankingActivity(
        bankAccountId,
        statusChanged ? "request_status_changed" : "request_updated",
        statusChanged
          ? `Request "${f.subject}" moved from ${editData.status} to ${f.status}`
          : `Request "${f.subject}" updated`,
        profile?.id || "", workspaceId,
      );
      if (statusChanged && f.status === "completed" && f.signatory_id) {
        toast.info("Remember to update the linked signatory record with the bank's confirmation.");
      }
      toast.success("Request updated");
    } else {
      const { error } = await supabase.from("bank_service_requests" as any).insert(payload);
      if (error) { toast.error(error.message); setSaving(false); return; }
      await logBankingActivity(bankAccountId, "request_created", `${typeLabel} request logged: "${f.subject}"`, profile?.id || "", workspaceId);
      toast.success("Request logged");
    }
    setSaving(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editData ? "Edit Service Request" : "Log Service Request"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Request Type *</Label>
              <Select value={f.request_type} onValueChange={v => set("request_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{REQUEST_TYPES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Status</Label>
              <Select value={f.status} onValueChange={v => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{REQUEST_STATUSES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div><Label>Subject *</Label><Input value={f.subject} onChange={e => set("subject", e.target.value)} /></div>
          <div><Label>Description</Label><Textarea value={f.description} onChange={e => set("description", e.target.value)} /></div>

          <div className="grid grid-cols-3 gap-4">
            <div><Label>Related Facility</Label>
              <Select value={f.facility_id || "none"} onValueChange={v => set("facility_id", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {facilities.map(o => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Related Limit</Label>
              <Select value={f.credit_limit_id || "none"} onValueChange={v => set("credit_limit_id", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {limits.map(o => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Related Signatory</Label>
              <Select value={f.signatory_id || "none"} onValueChange={v => set("signatory_id", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {signatories.map(o => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div><Label>Date Requested</Label><Input type="date" value={f.date_requested} onChange={e => set("date_requested", e.target.value)} /></div>
            <div><Label>Submitted to Bank</Label><Input type="date" value={f.date_submitted} onChange={e => set("date_submitted", e.target.value)} /></div>
            <div><Label>Bank Acknowledged</Label><Input type="date" value={f.bank_ack_date} onChange={e => set("bank_ack_date", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Expected Completion</Label><Input type="date" value={f.expected_completion} onChange={e => set("expected_completion", e.target.value)} /></div>
            <div><Label>Actual Completion</Label><Input type="date" value={f.actual_completion} onChange={e => set("actual_completion", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Bank Contact / RM</Label><Input value={f.bank_contact} onChange={e => set("bank_contact", e.target.value)} /></div>
            <div><Label>Bank Reference</Label><Input value={f.bank_reference} onChange={e => set("bank_reference", e.target.value)} /></div>
          </div>
          <div><Label>Outcome / Rejection Notes</Label><Textarea value={f.outcome_notes} onChange={e => set("outcome_notes", e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : editData ? "Update" : "Log Request"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
