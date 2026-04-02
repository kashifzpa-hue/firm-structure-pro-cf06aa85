import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AUTHORITY_OPTIONS, logBankingActivity } from "@/lib/banking-utils";
import { toast } from "sonner";
import { AlertTriangle, Upload, Loader2, ShieldAlert } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  bankAccountId: string;
  groups: any[];
  persons: any[];
  editData?: any;
}

export function SignatoryForm({ open, onClose, onSaved, bankAccountId, groups, persons, editData }: Props) {
  const { workspaceId } = useAuth();
  const [saving, setSaving] = useState(false);
  const [personId, setPersonId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [designation, setDesignation] = useState("");
  const [authorisedFor, setAuthorisedFor] = useState<string[]>([]);
  const [individualLimit, setIndividualLimit] = useState("");
  const [limitCurrency, setLimitCurrency] = useState("AED");
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split("T")[0]);
  const [expiryDate, setExpiryDate] = useState("");
  const [boardResRef, setBoardResRef] = useState("");
  const [bankAckDate, setBankAckDate] = useState("");
  const [notes, setNotes] = useState("");

  // Signature upload state
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [processedUrl, setProcessedUrl] = useState("");
  const [sigConfirmed, setSigConfirmed] = useState(false);

  // Reset form when dialog opens or editData changes
  useEffect(() => {
    if (open) {
      setPersonId(editData?.person_entity_id || "");
      setGroupId(editData?.signatory_group_id || "");
      setDesignation(editData?.designation || "");
      setAuthorisedFor(editData?.authorised_for || []);
      setIndividualLimit(editData?.individual_limit?.toString() || "");
      setLimitCurrency(editData?.individual_limit_currency || "AED");
      setEffectiveDate(editData?.effective_date || new Date().toISOString().split("T")[0]);
      setExpiryDate(editData?.expiry_date || "");
      setBoardResRef(editData?.board_resolution_ref || "");
      setBankAckDate(editData?.bank_acknowledged_date || "");
      setNotes(editData?.notes || "");
      setSignatureFile(null);
      setProcessedUrl(editData?.signature_image_url || "");
      setSigConfirmed(false);
      setSaving(false);
      setUploading(false);
    }
  }, [open, editData]);

  const selectedPerson = persons.find(p => p.id === personId);
  const isInactive = selectedPerson?.entity_status === "inactive";

  const toggleAuth = (value: string) => {
    if (value === "all") {
      setAuthorisedFor(authorisedFor.includes("all") ? [] : ["all"]);
    } else {
      const without = authorisedFor.filter(v => v !== "all" && v !== value);
      if (authorisedFor.includes(value)) setAuthorisedFor(without);
      else setAuthorisedFor([...without, value]);
    }
  };

  const handleSignatureUpload = async (file: File, sigId: string) => {
    if (!workspaceId) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("signatory_id", sigId);
      formData.append("workspace_id", workspaceId);

      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/apply-signature-overlay`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || "Signature upload failed");
      } else {
        setProcessedUrl(result.processed_url);
        toast.success("Signature processed successfully");
      }
    } catch (err: any) {
      toast.error("Signature upload failed: " + (err.message || "Unknown error"));
    }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!workspaceId || !personId || !designation) {
      toast.error("Person and designation are required");
      return;
    }
    if (isInactive) {
      toast.error("This person is marked as inactive and cannot be assigned signatory authority.");
      return;
    }
    setSaving(true);

    const payload: any = {
      workspace_id: workspaceId,
      bank_account_id: bankAccountId,
      person_entity_id: personId,
      signatory_group_id: groupId || null,
      designation,
      authorised_for: authorisedFor,
      individual_limit: individualLimit ? parseFloat(individualLimit) : null,
      individual_limit_currency: individualLimit ? limitCurrency : null,
      effective_date: effectiveDate,
      expiry_date: expiryDate || null,
      board_resolution_ref: boardResRef || null,
      bank_acknowledged_date: bankAckDate || null,
      notes: notes || null,
    };

    const { data: profile } = await supabase.from("profiles").select("id").eq("user_id", (await supabase.auth.getUser()).data.user?.id || "").single();

    if (editData) {
      const { error } = await supabase.from("signatories").update(payload).eq("id", editData.id);
      if (error) { toast.error(error.message); setSaving(false); return; }

      // Upload signature if new file selected
      if (signatureFile) {
        await handleSignatureUpload(signatureFile, editData.id);
      }

      await logBankingActivity(bankAccountId, "signatory_updated", `Signatory ${selectedPerson?.name} updated`, profile?.id || "", workspaceId);
      toast.success("Signatory updated");
    } else {
      const { data: inserted, error } = await supabase.from("signatories").insert(payload).select("id").single();
      if (error) { toast.error(error.message); setSaving(false); return; }

      // Upload signature if file selected
      if (signatureFile && inserted) {
        await handleSignatureUpload(signatureFile, inserted.id);
      }

      await logBankingActivity(bankAccountId, "signatory_added", `Signatory ${selectedPerson?.name} added`, profile?.id || "", workspaceId);
      toast.success("Signatory added");
    }
    setSaving(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editData ? "Edit Signatory" : "Add Signatory"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Person *</Label>
            <Select value={personId} onValueChange={setPersonId}>
              <SelectTrigger><SelectValue placeholder="Select person" /></SelectTrigger>
              <SelectContent>{persons.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {isInactive && (
            <Alert className="border-destructive/50 bg-destructive/5">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <AlertDescription className="text-destructive">This person is marked as inactive and cannot be assigned signatory authority.</AlertDescription>
            </Alert>
          )}

          <div><Label>Signatory Group</Label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger><SelectValue placeholder="Select group" /></SelectTrigger>
              <SelectContent>{groups.map(g => <SelectItem key={g.id} value={g.id}>{g.group_label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div><Label>Designation *</Label><Input value={designation} onChange={e => setDesignation(e.target.value)} placeholder="e.g. Chief Financial Officer" /></div>

          <div>
            <Label>Authorised For</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {AUTHORITY_OPTIONS.map(opt => (
                <div key={opt.value} className="flex items-center gap-2">
                  <Checkbox checked={authorisedFor.includes(opt.value) || authorisedFor.includes("all")} onCheckedChange={() => toggleAuth(opt.value)} />
                  <span className="text-sm">{opt.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div><Label>Individual Limit</Label><Input type="number" value={individualLimit} onChange={e => setIndividualLimit(e.target.value)} placeholder="Leave blank if N/A" /></div>
            <div><Label>Currency</Label><Input value={limitCurrency} onChange={e => setLimitCurrency(e.target.value)} /></div>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">Leave blank if this person cannot authorize transactions alone</p>

          <div className="grid grid-cols-2 gap-4">
            <div><Label>Effective Date *</Label><Input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} /></div>
            <div><Label>Expiry Date</Label><Input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} /></div>
          </div>
          {expiryDate && <p className="text-xs text-amber-600 -mt-2">An alert will be triggered 30 days before expiry</p>}

          <div><Label>Board Resolution Reference</Label><Input value={boardResRef} onChange={e => setBoardResRef(e.target.value)} /></div>
          <div><Label>Bank Acknowledged Date</Label><Input type="date" value={bankAckDate} onChange={e => setBankAckDate(e.target.value)} /><p className="text-xs text-muted-foreground mt-1">The date the bank confirmed this authority in writing</p></div>
          <div><Label>Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} /></div>

          {/* Signature Upload Section */}
          <div className="space-y-3">
            <Label>Signature Upload</Label>
            <Alert className="border-amber-300/50 bg-amber-50">
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 text-xs">
                <strong>Signature Protection Notice:</strong> Uploaded signatures are automatically overlaid with a security mesh and watermark. The original image cannot be retrieved. This record is for identification purposes only.
              </AlertDescription>
            </Alert>

            {processedUrl && (
              <div className="border rounded-lg p-3 bg-muted/30">
                <img src={processedUrl} alt="Processed signature" className="w-full max-h-24 object-contain" />
                <p className="text-[10px] text-muted-foreground mt-1 italic">Reference record only — not for use as digital signature</p>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept=".png,.jpg,.jpeg"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) {
                    if (f.size > 5 * 1024 * 1024) {
                      toast.error("File too large. Maximum 5MB.");
                      return;
                    }
                    setSignatureFile(f);
                    setSigConfirmed(false);
                  }
                }}
                className="text-sm"
              />
              {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
            </div>

            {signatureFile && !processedUrl && (
              <p className="text-xs text-muted-foreground">
                Signature will be uploaded and processed when you save.
              </p>
            )}

            <p className="text-xs text-muted-foreground">Accepts PNG and JPG only. Max 5MB. <button type="button" onClick={() => { setSignatureFile(null); setProcessedUrl(""); }} className="text-primary hover:underline ml-1">Skip for now</button></p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || isInactive}>{saving ? "Saving..." : editData ? "Update" : "Add Signatory"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
