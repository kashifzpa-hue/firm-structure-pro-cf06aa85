import { useState } from "react";
import { encryptedUpload } from "@/lib/encryption";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, AlertTriangle, X, Check, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface CircularOwnershipModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyName: string;
  toEntityName: string;
  onCancel: () => void;
  onConfirmWithException: (exceptionData: CircularExceptionData) => void;
  saving: boolean;
}

export interface CircularExceptionData {
  exception_type: string;
  jurisdiction: string;
  disposal_required: boolean;
  disposal_deadline: string | null;
  disposal_jurisdiction: string;
  doc_url: string | null;
  legal_notes: string;
}

const EXCEPTION_TYPES = [
  { value: "legal_representative", label: "Legal Representative" },
  { value: "trustee", label: "Trustee (no beneficial interest)" },
  { value: "pre_existing", label: "Pre-existing ownership" },
  { value: "other", label: "Other" },
];

export function CircularOwnershipModal({
  open, onOpenChange, companyName, toEntityName, onCancel, onConfirmWithException, saving
}: CircularOwnershipModalProps) {
  const { workspaceId } = useAuth();
  const [choice, setChoice] = useState<"none" | "error" | "exception">("none");
  const [exceptionType, setExceptionType] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [disposalRequired, setDisposalRequired] = useState(false);
  const [disposalDeadline, setDisposalDeadline] = useState<Date | undefined>();
  const [disposalJurisdiction, setDisposalJurisdiction] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [legalNotes, setLegalNotes] = useState("");

  const canConfirm = exceptionType && jurisdiction.trim();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") { toast.error("Only PDF files are accepted"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("File must be under 10MB"); return; }
    setDocFile(file);
  };

  const handleConfirm = async () => {
    let docUrl: string | null = null;
    if (docFile && workspaceId) {
      setUploading(true);
      const path = `${workspaceId}/circular-exceptions/${Date.now()}_${docFile.name}`;
      const { error } = await supabase.storage.from("documents").upload(path, docFile);
      if (error) { toast.error("Failed to upload document"); setUploading(false); return; }
      docUrl = path;
      setUploading(false);
    }

    onConfirmWithException({
      exception_type: exceptionType,
      jurisdiction: jurisdiction.trim(),
      disposal_required: disposalRequired,
      disposal_deadline: disposalDeadline ? format(disposalDeadline, "yyyy-MM-dd") : null,
      disposal_jurisdiction: disposalJurisdiction.trim() || jurisdiction.trim(),
      doc_url: docUrl,
      legal_notes: legalNotes.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            Circular Ownership Detected
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          <strong>{toEntityName}</strong> is about to own shares in <strong>{companyName}</strong>,
          which already appears in {toEntityName}'s ownership chain.
        </p>
        <p className="text-sm text-muted-foreground">
          In most jurisdictions, a subsidiary holding shares in its parent company is prohibited.
          Please confirm whether a legal exception applies.
        </p>

        <div className="space-y-3 mt-2">
          {/* Card 1 — Error */}
          <button
            onClick={() => setChoice("error")}
            className={cn(
              "w-full rounded-lg border-2 p-4 text-left transition-colors",
              choice === "error" ? "border-destructive bg-destructive/5" : "border-muted hover:border-destructive/50"
            )}
          >
            <div className="flex items-start gap-3">
              <X className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-sm">No — this is a data entry error</p>
                <p className="text-xs text-muted-foreground mt-1">Cancel this movement and review the ownership structure.</p>
              </div>
            </div>
          </button>

          {/* Card 2 — Exception */}
          <button
            onClick={() => setChoice("exception")}
            className={cn(
              "w-full rounded-lg border-2 p-4 text-left transition-colors",
              choice === "exception" ? "border-amber-500 bg-amber-50" : "border-muted hover:border-amber-400"
            )}
          >
            <div className="flex items-start gap-3">
              <Check className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-sm">Yes — a legal exception applies</p>
                <p className="text-xs text-muted-foreground mt-1">This arrangement is permitted under a recognised legal exception.</p>
              </div>
            </div>
          </button>
        </div>

        {choice === "error" && (
          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={onCancel}>Close</Button>
          </div>
        )}

        {choice === "exception" && (
          <div className="space-y-4 pt-2 border-t">
            <div className="space-y-2">
              <Label>Exception Type *</Label>
              <Select value={exceptionType} onValueChange={setExceptionType}>
                <SelectTrigger><SelectValue placeholder="Select exception type" /></SelectTrigger>
                <SelectContent>
                  {EXCEPTION_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Jurisdiction *</Label>
              <Input
                value={jurisdiction}
                onChange={e => { setJurisdiction(e.target.value); if (!disposalJurisdiction) setDisposalJurisdiction(e.target.value); }}
                placeholder="e.g. UAE, Saudi Arabia, UK"
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch checked={disposalRequired} onCheckedChange={setDisposalRequired} />
              <Label>Is disposal of these shares required by law?</Label>
            </div>

            {disposalRequired && (
              <div className="grid grid-cols-2 gap-4 pl-4 border-l-2 border-amber-300">
                <div className="space-y-2">
                  <Label>Disposal Deadline *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !disposalDeadline && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {disposalDeadline ? format(disposalDeadline, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={disposalDeadline} onSelect={setDisposalDeadline} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>Disposal Jurisdiction</Label>
                  <Input value={disposalJurisdiction} onChange={e => setDisposalJurisdiction(e.target.value)} />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Supporting Document (PDF, max 10MB)</Label>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 px-3 py-2 border rounded-md cursor-pointer hover:bg-muted text-sm">
                  <Upload className="h-4 w-4" />
                  {docFile ? docFile.name : "Choose file"}
                  <input type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
                </label>
                {docFile && <Button variant="ghost" size="sm" onClick={() => setDocFile(null)}>Remove</Button>}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Legal Notes</Label>
              <Textarea
                value={legalNotes}
                onChange={e => setLegalNotes(e.target.value)}
                placeholder="Reference to applicable law, court order, or legal advice supporting this exception."
                rows={3}
              />
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={onCancel}>Cancel Movement</Button>
              <Button
                onClick={handleConfirm}
                disabled={!canConfirm || saving || uploading}
                className="bg-amber-600 hover:bg-amber-700"
              >
                {uploading ? "Uploading..." : saving ? "Confirming..." : "Confirm with Exception"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
