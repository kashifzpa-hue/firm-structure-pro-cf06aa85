import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ACCOUNT_TYPES, ACCOUNT_STATUSES, logBankingActivity } from "@/lib/banking-utils";
import { useBanks } from "@/hooks/use-banks";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  companies: any[];
  relationships?: any[];
  editData?: any;
}

export function BankAccountForm({ open, onClose, onSaved, companies, relationships = [], editData }: Props) {
  const { workspaceId } = useAuth();
  const { bankNames } = useBanks();
  const [saving, setSaving] = useState(false);
  const [companyId, setCompanyId] = useState(editData?.company_entity_id || "");
  const [bankName, setBankName] = useState(editData?.bank_name || "");
  const [bankNameCustom, setBankNameCustom] = useState(editData?.bank_name_custom || "");
  const [accountNumber, setAccountNumber] = useState(editData?.account_number || "");
  const [accountType, setAccountType] = useState(editData?.account_type || "current");
  const [currency, setCurrency] = useState(editData?.currency || "AED");
  const [branchName, setBranchName] = useState(editData?.branch_name || "");
  const [branchCode, setBranchCode] = useState(editData?.branch_code || "");
  const [iban, setIban] = useState(editData?.iban || "");
  const [swiftCode, setSwiftCode] = useState(editData?.swift_code || "");
  const [accountStatus, setAccountStatus] = useState(editData?.account_status || "active");
  const [openingDate, setOpeningDate] = useState(editData?.opening_date || "");
  const [closingDate, setClosingDate] = useState(editData?.closing_date || "");
  const [rm, setRm] = useState(editData?.relationship_manager || "");
  const [rmEmail, setRmEmail] = useState(editData?.rm_email || "");
  const [rmPhone, setRmPhone] = useState(editData?.rm_phone || "");
  const [notes, setNotes] = useState(editData?.notes || "");
  const [cifId, setCifId] = useState(editData?.cif_id || "");

  const handleSave = async () => {
    if (!workspaceId || !companyId || !bankName || !accountNumber) {
      toast.error("Company, bank name, and account number are required");
      return;
    }
    setSaving(true);

    const payload: any = {
      workspace_id: workspaceId,
      company_entity_id: companyId,
      bank_name: bankName,
      bank_name_custom: bankName === "Other" ? bankNameCustom : null,
      account_number: accountNumber,
      account_type: accountType,
      currency,
      branch_name: branchName || null,
      branch_code: branchCode || null,
      iban: iban || null,
      swift_code: swiftCode || null,
      account_status: accountStatus,
      opening_date: openingDate || null,
      closing_date: closingDate || null,
      relationship_manager: rm || null,
      rm_email: rmEmail || null,
      rm_phone: rmPhone || null,
      notes: notes || null,
      cif_id: cifId || null,
    };

    const { data: profile } = await supabase.from("profiles").select("id").eq("user_id", (await supabase.auth.getUser()).data.user?.id || "").single();

    if (editData) {
      const { error } = await supabase.from("bank_accounts").update(payload).eq("id", editData.id);
      if (error) { toast.error(error.message); setSaving(false); return; }
      await logBankingActivity(editData.id, "account_updated", "Account details updated", profile?.id || "", workspaceId);
      toast.success("Bank account updated");
    } else {
      const { data, error } = await supabase.from("bank_accounts").insert(payload).select("id").single();
      if (error) { toast.error(error.message); setSaving(false); return; }
      if (data) await logBankingActivity(data.id, "account_created", `Bank account created at ${bankName}`, profile?.id || "", workspaceId);
      toast.success("Bank account added");
    }
    setSaving(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editData ? "Edit Bank Account" : "Add Bank Account"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Company *</Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
              <SelectContent>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Bank Name *</Label>
            <Select value={bankName} onValueChange={setBankName}>
              <SelectTrigger><SelectValue placeholder="Select bank" /></SelectTrigger>
              <SelectContent>
                {bankNames.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                {editData?.bank_name && !bankNames.includes(editData.bank_name) && (
                  <SelectItem value={editData.bank_name}>{editData.bank_name}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          {bankName === "Other" && <div><Label>Bank Name (Custom)</Label><Input value={bankNameCustom} onChange={e => setBankNameCustom(e.target.value)} /></div>}
          <div><Label>Bank Relationship (CIF)</Label>
            <Select value={cifId || "none"} onValueChange={v => setCifId(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Not linked" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not linked</SelectItem>
                {relationships
                  .filter(r => !companyId || r.company_entity_id === companyId)
                  .map(r => (
                    <SelectItem key={r.id} value={r.id}>
                      {(r.bank_name === "Other" ? r.bank_name_custom || "Other" : r.bank_name)}{r.cif_number ? ` — CIF ${r.cif_number}` : ""}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">Facilities, limits and service requests are tracked on the CIF.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Account Number *</Label><Input value={accountNumber} onChange={e => setAccountNumber(e.target.value)} /></div>
            <div><Label>Account Type</Label>
              <Select value={accountType} onValueChange={setAccountType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ACCOUNT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Currency</Label><Input value={currency} onChange={e => setCurrency(e.target.value)} /></div>
            <div><Label>Status</Label>
              <Select value={accountStatus} onValueChange={setAccountStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ACCOUNT_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>IBAN</Label><Input value={iban} onChange={e => setIban(e.target.value)} /></div>
            <div><Label>SWIFT/BIC</Label><Input value={swiftCode} onChange={e => setSwiftCode(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Branch Name</Label><Input value={branchName} onChange={e => setBranchName(e.target.value)} /></div>
            <div><Label>Branch Code</Label><Input value={branchCode} onChange={e => setBranchCode(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Opening Date</Label><Input type="date" value={openingDate} onChange={e => setOpeningDate(e.target.value)} /></div>
            <div><Label>Closing Date</Label><Input type="date" value={closingDate} onChange={e => setClosingDate(e.target.value)} /></div>
          </div>
          <div className="border-t pt-4"><Label className="text-sm font-semibold">Relationship Manager</Label></div>
          <div className="grid grid-cols-3 gap-4">
            <div><Label>RM Name</Label><Input value={rm} onChange={e => setRm(e.target.value)} /></div>
            <div><Label>RM Email</Label><Input value={rmEmail} onChange={e => setRmEmail(e.target.value)} /></div>
            <div><Label>RM Phone</Label><Input value={rmPhone} onChange={e => setRmPhone(e.target.value)} /></div>
          </div>
          <div><Label>Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : editData ? "Update" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
