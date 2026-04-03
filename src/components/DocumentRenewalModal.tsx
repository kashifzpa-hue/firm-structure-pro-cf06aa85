import { useState, useEffect } from "react";
import { encryptedUpload } from "@/lib/encryption";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { calculateNextExpiry, getFrequencyLabel } from "@/lib/renewal-utils";
import { toast } from "sonner";
import { format, parseISO, addMonths } from "date-fns";
import { RefreshCw } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: any;
  onRenewed: () => void;
}

export function DocumentRenewalModal({ open, onOpenChange, document: doc, onRenewed }: Props) {
  const { workspaceId } = useAuth();
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [autoCalculated, setAutoCalculated] = useState(false);

  useEffect(() => {
    if (!open || !doc) return;
    setIssueDate("");
    setExpiryDate("");
    setFile(null);
    setNotes("");
    setAutoCalculated(false);
  }, [open, doc?.id]);

  // Auto-suggest expiry when issue date changes
  useEffect(() => {
    if (!issueDate || !doc?.auto_suggest_expiry || !doc?.renewal_frequency || doc.renewal_frequency === 'none') return;
    const months = doc.renewal_frequency === 'custom' ? doc.renewal_months : 
      { annual: 12, biennial: 24, triennial: 36, quinquennial: 60, decennial: 120 }[doc.renewal_frequency as string];
    if (!months) return;
    try {
      const suggested = format(addMonths(parseISO(issueDate), months as number), 'yyyy-MM-dd');
      setExpiryDate(suggested);
      setAutoCalculated(true);
    } catch {}
  }, [issueDate, doc?.renewal_frequency, doc?.renewal_months, doc?.auto_suggest_expiry]);

  const handleSave = async () => {
    if (!workspaceId || !doc || !file) {
      toast.error("Please upload the new document file");
      return;
    }
    if (!issueDate) {
      toast.error("Please enter the new issue date");
      return;
    }
    setSaving(true);

    try {
      // Upload file
      const filePath = `${workspaceId}/${doc.entity_id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("documents").upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("documents").getPublicUrl(filePath);
      const fileUrl = urlData.publicUrl;

      // Get current max version
      const { data: versions } = await supabase
        .from("document_versions")
        .select("version_number")
        .eq("document_id", doc.id)
        .order("version_number", { ascending: false })
        .limit(1);
      const nextVersion = (versions?.[0]?.version_number || 0) + 1;

      // Get profile
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from("profiles").select("id").eq("user_id", user?.id || "").single();

      // Create new version
      await supabase.from("document_versions").insert({
        document_id: doc.id,
        workspace_id: workspaceId,
        version_number: nextVersion,
        issue_date: issueDate || null,
        expiry_date: expiryDate || null,
        file_url: fileUrl,
        uploaded_by: profile?.id || null,
        notes: notes || null,
      });

      // Update parent document
      await supabase.from("documents").update({
        issue_date: issueDate || null,
        expiry_date: expiryDate || null,
        file_url: fileUrl,
      }).eq("id", doc.id);

      toast.success(`Document renewed — Version ${nextVersion}`);
      onOpenChange(false);
      onRenewed();
    } catch (err: any) {
      toast.error(err.message || "Renewal failed");
    } finally {
      setSaving(false);
    }
  };

  if (!doc) return null;

  const frequencyLabel = getFrequencyLabel(doc.renewal_frequency, doc.renewal_months);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" /> Renew {doc.document_type}
          </DialogTitle>
          <DialogDescription>
            Upload the new version and enter the updated dates
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>New Issue Date</Label>
              <Input type="date" value={issueDate} onChange={(e) => { setIssueDate(e.target.value); setAutoCalculated(false); }} />
            </div>
            <div className="space-y-2">
              <Label>New Expiry Date</Label>
              <Input type="date" value={expiryDate} onChange={(e) => { setExpiryDate(e.target.value); setAutoCalculated(false); }} />
              {autoCalculated && (
                <p className="text-xs text-muted-foreground">
                  Auto-calculated from {frequencyLabel} renewal cycle
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Upload New Document <span className="text-destructive">*</span></Label>
            <Input type="file" accept=".pdf,.jpg,.jpeg,.png,.gif" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Renewed with DED, reference TL-2026-XXXXX"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !file}>
            {saving ? "Saving..." : "Save Renewal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
