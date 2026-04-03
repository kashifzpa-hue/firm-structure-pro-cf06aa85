import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Step1Details } from "@/components/movement/Step1Details";
import { Step2Parties } from "@/components/movement/Step2Parties";
import { Step3Consideration } from "@/components/movement/Step3Consideration";
import { Step4Confirm } from "@/components/movement/Step4Confirm";
import { CircularOwnershipModal, CircularExceptionData } from "@/components/movement/CircularOwnershipModal";
import { toast } from "sonner";

interface MovementWizardProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
  editingMovement?: any;
}

const STEPS = ["Details", "Parties & Shares", "Consideration", "Confirm"];

export function MovementWizard({ open, onOpenChange, onSaved, editingMovement }: MovementWizardProps) {
  const { workspaceId } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [outOfOrderAck, setOutOfOrderAck] = useState(false);
  const [companies, setCompanies] = useState<any[]>([]);
  const [entities, setEntities] = useState<any[]>([]);
  const [circularDetected, setCircularDetected] = useState(false);
  const [circularModalOpen, setCircularModalOpen] = useState(false);

  const [data, setData] = useState<any>({
    company_entity_id: "", movement_type: "", share_class_id: "",
    movement_date: new Date().toISOString().split("T")[0],
    reference_number: "", notes: "", from_entity_id: "", to_entity_id: "",
    shares_transferred: 0, price_per_share: null, currency: "AED", total_consideration: null,
  });

  useEffect(() => {
    if (!workspaceId || !open) return;
    Promise.all([
      supabase.from("entities").select("id, name, type, captable_status").eq("workspace_id", workspaceId).order("name"),
      supabase.from("entities").select("id, name, type").eq("workspace_id", workspaceId).order("name"),
    ]).then(([cRes, eRes]) => {
      setCompanies(cRes.data || []);
      setEntities(eRes.data || []);
    });
  }, [workspaceId, open]);

  useEffect(() => {
    if (editingMovement) {
      setData({
        company_entity_id: editingMovement.company_entity_id || "",
        movement_type: editingMovement.movement_type || "",
        share_class_id: editingMovement.share_class_id || "",
        movement_date: editingMovement.movement_date || "",
        reference_number: editingMovement.reference_number || "",
        notes: editingMovement.notes || "",
        from_entity_id: editingMovement.from_entity_id || "",
        to_entity_id: editingMovement.to_entity_id || "",
        shares_transferred: editingMovement.shares_transferred || 0,
        price_per_share: editingMovement.price_per_share,
        currency: editingMovement.currency || "AED",
        total_consideration: editingMovement.total_consideration,
      });
    } else {
      setData({
        company_entity_id: "", movement_type: "", share_class_id: "",
        movement_date: new Date().toISOString().split("T")[0],
        reference_number: "", notes: "", from_entity_id: "", to_entity_id: "",
        shares_transferred: 0, price_per_share: null, currency: "AED", total_consideration: null,
      });
    }
    setStep(0);
    setOutOfOrderAck(false);
    setCircularDetected(false);
    setCircularModalOpen(false);
  }, [editingMovement, open]);

  const onChange = (updates: any) => setData((prev: any) => ({ ...prev, ...updates }));
  const isFuture = data.movement_date && new Date(data.movement_date) > new Date();

  const canGoNext = () => {
    if (step === 0) return data.company_entity_id && data.movement_type && data.share_class_id && data.movement_date;
    if (step === 1) return data.shares_transferred > 0;
    return true;
  };

  const getProfileId = async () => {
    const { data: profile } = await supabase.from("profiles").select("id").eq("user_id", (await supabase.auth.getUser()).data.user?.id || "").single();
    return profile?.id;
  };

  const buildPayload = (profileId: string) => ({
    workspace_id: workspaceId,
    company_entity_id: data.company_entity_id,
    share_class_id: data.share_class_id,
    movement_type: data.movement_type,
    from_entity_id: data.from_entity_id || null,
    to_entity_id: data.to_entity_id || null,
    shares_transferred: data.shares_transferred,
    price_per_share: data.price_per_share || null,
    currency: data.price_per_share ? data.currency : null,
    total_consideration: data.total_consideration || null,
    movement_date: data.movement_date,
    reference_number: data.reference_number || null,
    notes: data.notes || null,
    created_by: profileId,
  });

  const handleSave = async (confirm: boolean) => {
    if (!workspaceId) return;
    // If confirming and circular detected, open the modal instead
    if (confirm && circularDetected) {
      setCircularModalOpen(true);
      return;
    }
    setSaving(true);
    try {
      const profileId = await getProfileId();
      if (!profileId) { toast.error("Profile not found"); setSaving(false); return; }
      const payload = buildPayload(profileId);

      if (editingMovement) {
        const { error } = await supabase.from("movements").update(payload).eq("id", editingMovement.id);
        if (error) throw error;
        if (confirm && !isFuture) {
          const { error: cErr } = await supabase.rpc("confirm_movement", { p_movement_id: editingMovement.id });
          if (cErr) throw cErr;
          toast.success("Movement confirmed");
        } else {
          toast.success("Draft updated");
        }
      } else {
        const { data: inserted, error } = await supabase.from("movements").insert(payload).select("id").single();
        if (error) throw error;
        if (confirm && !isFuture) {
          const { error: cErr } = await supabase.rpc("confirm_movement", { p_movement_id: inserted.id });
          if (cErr) throw cErr;
          toast.success("Movement confirmed");
        } else {
          toast.success("Draft saved");
        }
      }
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save movement");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmWithException = async (exceptionData: CircularExceptionData) => {
    if (!workspaceId) return;
    setSaving(true);
    try {
      const profileId = await getProfileId();
      if (!profileId) { toast.error("Profile not found"); setSaving(false); return; }
      const payload = buildPayload(profileId);

      let movementId: string;
      if (editingMovement) {
        const { error } = await supabase.from("movements").update(payload).eq("id", editingMovement.id);
        if (error) throw error;
        movementId = editingMovement.id;
      } else {
        const { data: inserted, error } = await supabase.from("movements").insert(payload).select("id").single();
        if (error) throw error;
        movementId = inserted.id;
      }

      if (!isFuture) {
        const { error: cErr } = await supabase.rpc("confirm_movement", { p_movement_id: movementId });
        if (cErr) throw cErr;
      }

      // Update the resulting equity_link with circular ownership exception data
      if (data.to_entity_id && data.company_entity_id && data.share_class_id) {
        await supabase.from("equity_links")
          .update({
            circular_ownership_type: exceptionData.exception_type as any,
            circular_ownership_notes: exceptionData.legal_notes || null,
            circular_ownership_doc_url: exceptionData.doc_url || null,
            disposal_required: exceptionData.disposal_required,
            disposal_deadline: exceptionData.disposal_deadline || null,
            disposal_jurisdiction: exceptionData.disposal_jurisdiction || null,
          })
          .eq("owner_entity_id", data.to_entity_id)
          .eq("owned_entity_id", data.company_entity_id)
          .eq("share_class_id", data.share_class_id)
          .is("end_date", null)
          .eq("workspace_id", workspaceId);
      }

      toast.success("Movement confirmed. Circular ownership exception recorded.");
      setCircularModalOpen(false);
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save movement");
    } finally {
      setSaving(false);
    }
  };

  const companyName = companies.find(c => c.id === data.company_entity_id)?.name || "—";
  const toEntityName = entities.find(e => e.id === data.to_entity_id)?.name || "—";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingMovement ? "Edit Movement" : "Record Movement"}</DialogTitle>
          </DialogHeader>

          <div className="flex gap-2 mb-4">
            {STEPS.map((s, i) => (
              <div key={s} className={`flex-1 text-center text-xs py-1 rounded ${i === step ? "bg-primary text-primary-foreground" : i < step ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                {s}
              </div>
            ))}
          </div>

          {step === 0 && <Step1Details data={data} onChange={onChange} companies={companies} />}
          {step === 1 && <Step2Parties data={data} onChange={onChange} entities={entities} />}
          {step === 2 && <Step3Consideration data={data} onChange={onChange} />}
          {step === 3 && (
            <Step4Confirm
              data={data}
              entities={entities}
              companies={companies}
              outOfOrderAcknowledged={outOfOrderAck}
              onOutOfOrderChange={setOutOfOrderAck}
              onCircularDetected={setCircularDetected}
            />
          )}

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => step > 0 ? setStep(step - 1) : onOpenChange(false)}>
              {step === 0 ? "Cancel" : "Back"}
            </Button>
            <div className="flex gap-2">
              {step < 3 ? (
                <Button onClick={() => setStep(step + 1)} disabled={!canGoNext()}>Next</Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>
                    {saving ? "Saving..." : "Save as Draft"}
                  </Button>
                  {!isFuture && !circularDetected && (
                    <Button onClick={() => handleSave(true)} disabled={saving}>
                      {saving ? "Confirming..." : "Confirm Movement"}
                    </Button>
                  )}
                  {!isFuture && circularDetected && (
                    <Button onClick={() => setCircularModalOpen(true)} disabled={saving} className="bg-amber-600 hover:bg-amber-700">
                      Confirm with Exception
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CircularOwnershipModal
        open={circularModalOpen}
        onOpenChange={setCircularModalOpen}
        companyName={companyName}
        toEntityName={toEntityName}
        onCancel={() => setCircularModalOpen(false)}
        onConfirmWithException={handleConfirmWithException}
        saving={saving}
      />
    </>
  );
}
