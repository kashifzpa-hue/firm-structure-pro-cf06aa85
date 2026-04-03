import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, CheckCircle, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { CircularOwnershipModal, type CircularExceptionData } from "@/components/movement/CircularOwnershipModal";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingLink: any;
  entities: any[];
  workspaceId: string;
  onSaved: () => void;
}

export function OwnershipFormModal({ open, onOpenChange, editingLink, entities, workspaceId, onSaved }: Props) {
  const navigate = useNavigate();
  const [ownedId, setOwnedId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [shareClassId, setShareClassId] = useState("");
  const [sharesOwned, setSharesOwned] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const [shareClasses, setShareClasses] = useState<any[]>([]);
  const [classAllocations, setClassAllocations] = useState<Record<string, number>>({});

  const [ownerSearch, setOwnerSearch] = useState("");
  const [ownedSearch, setOwnedSearch] = useState("");

  // Circular ownership state
  const [circularModalOpen, setCircularModalOpen] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<any>(null);

  useEffect(() => {
    if (editingLink) {
      setOwnedId(editingLink.owned_entity_id);
      setOwnerId(editingLink.owner_entity_id);
      setShareClassId(editingLink.share_class_id || "");
      setSharesOwned(editingLink.shares_owned ? String(editingLink.shares_owned) : "");
      setEffectiveDate(editingLink.effective_date);
      setNotes(editingLink.notes || "");
    } else {
      setOwnedId("");
      setOwnerId("");
      setShareClassId("");
      setSharesOwned("");
      setEffectiveDate(format(new Date(), "yyyy-MM-dd"));
      setNotes("");
    }
    setShareClasses([]);
    setClassAllocations({});
  }, [editingLink, open]);

  // Fetch share classes when owned entity changes
  useEffect(() => {
    if (!ownedId || !workspaceId) { setShareClasses([]); setClassAllocations({}); return; }
    const fetch = async () => {
      const [scRes, linksRes] = await Promise.all([
        supabase.from("share_classes").select("*").eq("company_entity_id", ownedId).eq("workspace_id", workspaceId).order("created_at"),
        supabase.from("equity_links").select("share_class_id, shares_owned, id").eq("owned_entity_id", ownedId).eq("workspace_id", workspaceId).is("end_date", null),
      ]);
      setShareClasses(scRes.data || []);
      const alloc: Record<string, number> = {};
      (linksRes.data || []).forEach((l: any) => {
        if (l.share_class_id && l.id !== editingLink?.id) {
          alloc[l.share_class_id] = (alloc[l.share_class_id] || 0) + (l.shares_owned || 0);
        }
      });
      setClassAllocations(alloc);
    };
    fetch();
  }, [ownedId, workspaceId, editingLink]);

  const companyEntities = entities.filter(e => e.type === "company");
  const selectedClass = shareClasses.find(sc => sc.id === shareClassId);
  const allocated = classAllocations[shareClassId] || 0;
  const available = selectedClass ? selectedClass.total_shares_issued - allocated : 0;
  const sharesNum = Number(sharesOwned) || 0;
  const percentage = selectedClass && selectedClass.total_shares_issued > 0 ? (sharesNum / selectedClass.total_shares_issued) * 100 : 0;
  const exceeds = sharesNum > available;

  const ownedEntity = entities.find(e => e.id === ownedId);
  const incorporationDate = ownedEntity?.date_of_birth_or_incorporation || null;
  const effectiveDateBeforeIncorporation = incorporationDate && effectiveDate ? effectiveDate < incorporationDate : false;

  const hasShareClasses = shareClasses.length > 0;
  const ownedEntityName = entities.find(e => e.id === ownedId)?.name || "";
  const ownerEntityName = entities.find(e => e.id === ownerId)?.name || "";

  const filteredOwnerEntities = entities.filter(e =>
    e.id !== ownedId && e.name.toLowerCase().includes(ownerSearch.toLowerCase())
  );
  const filteredOwnedEntities = companyEntities.filter(e =>
    e.name.toLowerCase().includes(ownedSearch.toLowerCase())
  );

  const buildPayload = () => {
    const pct = hasShareClasses && selectedClass
      ? (sharesNum / selectedClass.total_shares_issued) * 100
      : Number(sharesOwned) || 0;

    return {
      workspace_id: workspaceId,
      owner_entity_id: ownerId,
      owned_entity_id: ownedId,
      percentage: pct,
      share_class_id: hasShareClasses ? shareClassId : null,
      shares_owned: hasShareClasses ? sharesNum : null,
      share_count: hasShareClasses ? sharesNum : null,
      effective_date: effectiveDate,
      notes: notes || null,
    };
  };

  const doSave = async (payload: any, circularData?: CircularExceptionData) => {
    setSaving(true);

    const finalPayload = circularData ? {
      ...payload,
      circular_ownership_type: circularData.exception_type as any,
      circular_ownership_notes: circularData.legal_notes || null,
      circular_ownership_doc_url: circularData.doc_url || null,
      disposal_required: circularData.disposal_required,
      disposal_deadline: circularData.disposal_deadline || null,
      disposal_jurisdiction: circularData.disposal_jurisdiction || null,
    } : payload;

    let error;
    if (editingLink) {
      ({ error } = await supabase.from("equity_links").update(finalPayload).eq("id", editingLink.id));
    } else {
      ({ error } = await supabase.from("equity_links").insert(finalPayload));
    }
    setSaving(false);
    if (error) { toast.error(error.message); return; }

    // Check allocation status
    if (hasShareClasses && selectedClass) {
      const newTotal = allocated + sharesNum;
      if (newTotal === selectedClass.total_shares_issued) {
        toast.success(`✓ 100% of ${selectedClass.class_name} shares are fully allocated.`);
      } else if (newTotal < selectedClass.total_shares_issued) {
        const remaining = selectedClass.total_shares_issued - newTotal;
        const remainPct = ((remaining / selectedClass.total_shares_issued) * 100).toFixed(1);
        toast.info(`${remaining} shares (${remainPct}%) remain unallocated in ${selectedClass.class_name}.`);
      }
    }

    if (circularData) {
      toast.success("Ownership link saved with circular exception recorded.");
    } else {
      toast.success(editingLink ? "Ownership link updated" : "Ownership link created");
    }
    onOpenChange(false);
    onSaved();
  };

  const handleSave = async () => {
    if (!ownedId || !ownerId || !effectiveDate) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (ownerId === ownedId) {
      toast.error("An entity cannot own itself");
      return;
    }
    if (effectiveDateBeforeIncorporation) {
      toast.error("Effective date cannot be before the company's date of incorporation");
      return;
    }
    if (hasShareClasses) {
      if (!shareClassId) { toast.error("Please select a share class"); return; }
      if (sharesNum <= 0) { toast.error("Please enter number of shares"); return; }
      if (exceeds) { toast.error(`Only ${available} shares available in this class.`); return; }
    }

    const payload = buildPayload();

    // Check for circular ownership (only for new links or if owner changed)
    const ownerIsCompany = entities.find(e => e.id === ownerId)?.type === "company";
    const shouldCheck = ownerIsCompany && (!editingLink || editingLink.owner_entity_id !== ownerId || editingLink.owned_entity_id !== ownedId);

    if (shouldCheck) {
      setSaving(true);
      console.log("Circular check: running for owner=", ownerId, "owned=", ownedId);
      const { data: isCircular, error: checkError } = await supabase.rpc("check_circular_ownership", {
        p_company_entity_id: ownerId,
        p_potential_owner_id: ownedId,
      });
      console.log("Circular check result:", { isCircular, checkError });
      setSaving(false);

      if (checkError) {
        console.error("Circular check failed:", checkError);
        toast.warning("Could not verify ownership chain. Proceed with caution.");
      } else if (isCircular) {
        setPendingPayload(payload);
        setCircularModalOpen(true);
        return;
      }
    } else {
      console.log("Circular check skipped:", { ownerIsCompany, editingLink: !!editingLink, ownerId, ownedId });
    }

    await doSave(payload);
  };

  const handleCircularException = async (exceptionData: CircularExceptionData) => {
    if (!pendingPayload) return;
    setCircularModalOpen(false);
    await doSave(pendingPayload, exceptionData);
    setPendingPayload(null);
  };

  const handleCircularCancel = () => {
    setCircularModalOpen(false);
    setPendingPayload(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingLink ? "Edit Ownership Link" : "Add Ownership Link"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Step 1: Select owned company */}
            <div>
              <Label>Company Being Owned *</Label>
              <Select value={ownedId} onValueChange={(v) => { setOwnedId(v); setShareClassId(""); setSharesOwned(""); }}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select company..." /></SelectTrigger>
                <SelectContent>
                  <div className="px-2 pb-2">
                    <Input placeholder="Search..." value={ownedSearch} onChange={e => setOwnedSearch(e.target.value)} className="h-8" />
                  </div>
                  {filteredOwnedEntities.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Share classes panel */}
            {ownedId && (
              <Card className="bg-muted/30">
                <CardContent className="pt-4 pb-3">
                  <p className="text-sm font-medium mb-2">Share Classes in {ownedEntityName}</p>
                  {!hasShareClasses ? (
                    <Alert className="border-warning bg-warning/10">
                      <AlertTriangle className="h-4 w-4 text-warning" />
                      <AlertDescription className="text-warning">
                        This company has no share classes set up yet.{" "}
                        <button
                          type="button"
                          className="underline font-medium"
                          onClick={() => { onOpenChange(false); navigate(`/entities/${ownedId}`); }}
                        >
                          Set up share capital →
                        </button>
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <div className="space-y-1">
                      {shareClasses.map(sc => {
                        const alloc = classAllocations[sc.id] || 0;
                        const avail = sc.total_shares_issued - alloc;
                        return (
                          <div key={sc.id} className="flex items-center justify-between text-sm py-1">
                            <span>{sc.class_name} {!sc.voting_rights && <Badge variant="secondary" className="text-xs ml-1">Non-voting</Badge>}</span>
                            <span className="text-muted-foreground">
                              {sc.total_shares_issued.toLocaleString()} total · {alloc.toLocaleString()} allocated · <span className={avail > 0 ? "text-warning font-medium" : "text-success font-medium"}>{avail.toLocaleString()} available</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Step 2: Select owner */}
            <div>
              <Label>Owner (Shareholder) *</Label>
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select owner entity..." /></SelectTrigger>
                <SelectContent>
                  <div className="px-2 pb-2">
                    <Input placeholder="Search..." value={ownerSearch} onChange={e => setOwnerSearch(e.target.value)} className="h-8" />
                  </div>
                  {filteredOwnerEntities.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.name} ({e.type})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Step 3: Shareholding */}
            {hasShareClasses && (
              <>
                <div>
                  <Label>Share Class *</Label>
                  <Select value={shareClassId} onValueChange={v => { setShareClassId(v); setSharesOwned(""); }}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select share class..." /></SelectTrigger>
                    <SelectContent>
                      {shareClasses.map(sc => (
                        <SelectItem key={sc.id} value={sc.id}>
                          {sc.class_name} ({(sc.total_shares_issued - (classAllocations[sc.id] || 0)).toLocaleString()} available)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {shareClassId && (
                  <div>
                    <Label>Number of Shares *</Label>
                    <Input
                      type="number"
                      min="1"
                      max={available}
                      step="1"
                      value={sharesOwned}
                      onChange={e => setSharesOwned(e.target.value)}
                      className="mt-1"
                    />
                    {sharesNum > 0 && selectedClass && (
                      <p className={`text-sm mt-1 ${exceeds ? "text-destructive" : "text-success"}`}>
                        {exceeds
                          ? `Only ${available.toLocaleString()} shares available in this class.`
                          : `Entering ${sharesNum.toLocaleString()} shares out of ${available.toLocaleString()} available = ${percentage.toFixed(2)}% ownership`
                        }
                      </p>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Legacy fallback for companies without share classes */}
            {ownedId && !hasShareClasses && (
              <Alert className="border-muted">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  No share classes found. Set up share capital on the company profile to enable share-based ownership linking.
                </AlertDescription>
              </Alert>
            )}

            <div>
              <Label>Effective Date *</Label>
              <Input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} className={`mt-1 ${effectiveDateBeforeIncorporation ? "border-destructive" : ""}`} />
              {effectiveDateBeforeIncorporation && (
                <p className="text-sm text-destructive mt-1">
                  Effective date cannot be before the date of incorporation ({format(new Date(incorporationDate + "T00:00:00"), "MMM dd, yyyy")})
                </p>
              )}
            </div>

            <div>
              <Label>Notes (optional)</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} className="mt-1" rows={2} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving || effectiveDateBeforeIncorporation || (hasShareClasses && (!shareClassId || exceeds || sharesNum <= 0))}>
                {saving ? "Checking..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CircularOwnershipModal
        open={circularModalOpen}
        onOpenChange={setCircularModalOpen}
        companyName={ownedEntityName}
        toEntityName={ownerEntityName}
        onCancel={handleCircularCancel}
        onConfirmWithException={handleCircularException}
        saving={saving}
      />
    </>
  );
}