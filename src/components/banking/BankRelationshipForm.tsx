import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useBanks } from "@/hooks/use-banks";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  companies: { id: string; name: string }[];
  editData?: any;
}

const STATUSES = [
  { value: "active", label: "Active" },
  { value: "dormant", label: "Dormant" },
  { value: "closed", label: "Closed" },
];

export function BankRelationshipForm({ open, onClose, onSaved, companies, editData }: Props) {
  const { workspaceId } = useAuth();
  const { bankNames } = useBanks();
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState<any>({
    company_entity_id: editData?.company_entity_id || "",
    bank_name: editData?.bank_name || "",
    bank_name_custom: editData?.bank_name_custom || "",
    cif_number: editData?.cif_number || "",
    status: editData?.status || "active",
    opening_date: editData?.opening_date || "",
    relationship_manager: editData?.relationship_manager || "",
    rm_email: editData?.rm_email || "",
    rm_phone: editData?.rm_phone || "",
    notes: editData?.notes || "",
  });
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!workspaceId || !f.company_entity_id || !f.bank_name) {
      toast.error("Company and bank are required");
      return;
    }
    setSaving(true);
    const payload = {
      workspace_id: workspaceId,
      company_entity_id: f.company_entity_id,
      bank_name: f.bank_name,
      bank_name_custom: f.bank_name === "Other" ? f.bank_name_custom || null : null,
      cif_number: f.cif_number || null,
      status: f.status,
      opening_date: f.opening_date || null,
      relationship_manager: f.relationship_manager || null,
      rm_email: f.rm_email || null,
      rm_phone: f.rm_phone || null,
      notes: f.notes || null,
    };

    const q = editData
      ? supabase.from("bank_relationships" as any).update(payload).eq("id", editData.id)
      : supabase.from("bank_relationships" as any).insert(payload);
    const { error } = await q;
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editData ? "Relationship updated" : "Relationship created");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editData ? "Edit Bank Relationship (CIF)" : "Add Bank Relationship (CIF)"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Company *</Label>
            <Select value={f.company_entity_id} onValueChange={v => set("company_entity_id", v)}>
              <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
              <SelectContent>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Bank *</Label>
            <Select value={f.bank_name} onValueChange={v => set("bank_name", v)}>
              <SelectTrigger><SelectValue placeholder="Select bank" /></SelectTrigger>
              <SelectContent>
                {bankNames.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                {editData?.bank_name && !bankNames.includes(editData.bank_name) && (
                  <SelectItem value={editData.bank_name}>{editData.bank_name}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          {f.bank_name === "Other" && (
            <div><Label>Bank Name (Custom)</Label><Input value={f.bank_name_custom} onChange={e => set("bank_name_custom", e.target.value)} /></div>
          )}
          <div className="grid grid-cols-3 gap-4">
            <div><Label>CIF Number</Label><Input value={f.cif_number} onChange={e => set("cif_number", e.target.value)} /></div>
            <div><Label>Status</Label>
              <Select value={f.status} onValueChange={v => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Opened</Label><Input type="date" value={f.opening_date} onChange={e => set("opening_date", e.target.value)} /></div>
          </div>
          <div className="border-t pt-4"><Label className="text-sm font-semibold">Relationship Manager</Label></div>
          <div className="grid grid-cols-3 gap-4">
            <div><Label>Name</Label><Input value={f.relationship_manager} onChange={e => set("relationship_manager", e.target.value)} /></div>
            <div><Label>Email</Label><Input value={f.rm_email} onChange={e => set("rm_email", e.target.value)} /></div>
            <div><Label>Phone</Label><Input value={f.rm_phone} onChange={e => set("rm_phone", e.target.value)} /></div>
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
