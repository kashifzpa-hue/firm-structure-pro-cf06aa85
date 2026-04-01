import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingLink: any;
  entities: any[];
  workspaceId: string;
  onSaved: () => void;
}

export function OwnershipFormModal({ open, onOpenChange, editingLink, entities, workspaceId, onSaved }: Props) {
  const [ownerId, setOwnerId] = useState("");
  const [ownedId, setOwnedId] = useState("");
  const [percentage, setPercentage] = useState("");
  const [shareCount, setShareCount] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [currentTotal, setCurrentTotal] = useState(0);
  const [ownerSearch, setOwnerSearch] = useState("");
  const [ownedSearch, setOwnedSearch] = useState("");

  useEffect(() => {
    if (editingLink) {
      setOwnerId(editingLink.owner_entity_id);
      setOwnedId(editingLink.owned_entity_id);
      setPercentage(String(editingLink.percentage));
      setShareCount(editingLink.share_count ? String(editingLink.share_count) : "");
      setEffectiveDate(editingLink.effective_date);
      setNotes(editingLink.notes || "");
    } else {
      setOwnerId("");
      setOwnedId("");
      setPercentage("");
      setShareCount("");
      setEffectiveDate(format(new Date(), "yyyy-MM-dd"));
      setNotes("");
    }
    setCurrentTotal(0);
  }, [editingLink, open]);

  // Fetch current total ownership for owned entity
  useEffect(() => {
    if (!ownedId || !workspaceId) { setCurrentTotal(0); return; }
    const fetchTotal = async () => {
      const { data } = await supabase
        .from("equity_links")
        .select("percentage, id")
        .eq("owned_entity_id", ownedId)
        .eq("workspace_id", workspaceId)
        .is("end_date", null);
      const total = (data || [])
        .filter((l) => l.id !== editingLink?.id)
        .reduce((sum, l) => sum + Number(l.percentage), 0);
      setCurrentTotal(total);
    };
    fetchTotal();
  }, [ownedId, workspaceId, editingLink]);

  const afterTotal = currentTotal + (Number(percentage) || 0);
  const ownedEntityName = entities.find((e) => e.id === ownedId)?.name || "selected entity";

  const handleSave = async () => {
    if (!ownerId || !ownedId || !percentage || !effectiveDate) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (ownerId === ownedId) {
      toast.error("An entity cannot own itself");
      return;
    }
    const pct = Number(percentage);
    if (pct <= 0 || pct > 100) {
      toast.error("Percentage must be between 0.01 and 100");
      return;
    }
    if (afterTotal > 100) {
      toast.error("Total ownership cannot exceed 100%");
      return;
    }

    setSaving(true);
    const payload = {
      workspace_id: workspaceId,
      owner_entity_id: ownerId,
      owned_entity_id: ownedId,
      percentage: pct,
      share_count: shareCount ? Number(shareCount) : null,
      effective_date: effectiveDate,
      notes: notes || null,
    };

    let error;
    if (editingLink) {
      ({ error } = await supabase.from("equity_links").update(payload).eq("id", editingLink.id));
    } else {
      ({ error } = await supabase.from("equity_links").insert(payload));
    }

    setSaving(false);
    if (error) {
      toast.error(error.message || "Failed to save");
      return;
    }
    toast.success(editingLink ? "Ownership link updated" : "Ownership link created");
    onOpenChange(false);
    onSaved();
  };

  const filteredOwnerEntities = entities.filter((e) =>
    e.name.toLowerCase().includes(ownerSearch.toLowerCase())
  );
  const filteredOwnedEntities = entities.filter((e) =>
    e.id !== ownerId && e.name.toLowerCase().includes(ownedSearch.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingLink ? "Edit Ownership Link" : "Add Ownership Link"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Owner Entity *</Label>
            <Select value={ownerId} onValueChange={setOwnerId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select owner entity..." />
              </SelectTrigger>
              <SelectContent>
                <div className="px-2 pb-2">
                  <Input placeholder="Search..." value={ownerSearch} onChange={(e) => setOwnerSearch(e.target.value)} className="h-8" />
                </div>
                {filteredOwnerEntities.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.name} ({e.type})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Owned Entity *</Label>
            <Select value={ownedId} onValueChange={setOwnedId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select owned entity..." />
              </SelectTrigger>
              <SelectContent>
                <div className="px-2 pb-2">
                  <Input placeholder="Search..." value={ownedSearch} onChange={(e) => setOwnedSearch(e.target.value)} className="h-8" />
                </div>
                {filteredOwnedEntities.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.name} ({e.type})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Ownership Percentage * (0.01 – 100)</Label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              max="100"
              value={percentage}
              onChange={(e) => setPercentage(e.target.value)}
              className="mt-1"
            />
            {ownedId && (
              <p className="text-sm text-muted-foreground mt-1">
                Current total ownership of {ownedEntityName}: {currentTotal.toFixed(2)}%.
                After this link: {afterTotal.toFixed(2)}%.
              </p>
            )}
            {afterTotal > 100 && (
              <Alert className="mt-2 border-destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>Total ownership exceeds 100%. This is not allowed.</AlertDescription>
              </Alert>
            )}
            {afterTotal === 100 && (
              <Alert className="mt-2 border-warning bg-warning/10">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <AlertDescription className="text-warning">Total ownership will reach exactly 100%.</AlertDescription>
              </Alert>
            )}
          </div>

          <div>
            <Label>Number of Shares (optional)</Label>
            <Input type="number" value={shareCount} onChange={(e) => setShareCount(e.target.value)} className="mt-1" />
          </div>

          <div>
            <Label>Effective Date *</Label>
            <Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} className="mt-1" />
          </div>

          <div>
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" rows={3} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
