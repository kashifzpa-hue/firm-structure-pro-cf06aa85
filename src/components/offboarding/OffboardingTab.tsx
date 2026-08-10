import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, CheckCircle2, Landmark, Loader2, Send, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { fetchPersonExposure } from "@/lib/person-exposure";
import {
  buildOffboardingSteps,
  groupStepsByStage,
  offboardingProgress,
  stepNeedsBankRequest,
  STEP_STATUS_LABELS,
  type OffboardingStepStatus,
} from "@/lib/offboarding";

const STATUS_COLORS: Record<OffboardingStepStatus, string> = {
  pending: "bg-slate-100 text-slate-700",
  submitted: "bg-blue-100 text-blue-800",
  acknowledged: "bg-indigo-100 text-indigo-800",
  done: "bg-green-100 text-green-800",
  not_applicable: "bg-slate-100 text-slate-500",
};

const REASONS = [
  "Resignation",
  "Retirement",
  "Termination",
  "Deceased",
  "Role transferred to another person",
  "Other",
];

interface Props {
  personId: string;
  personName: string;
  isAdmin: boolean;
}

export function OffboardingTab({ personId, personName, isAdmin }: Props) {
  const { workspaceId } = useAuth();
  const qc = useQueryClient();
  const [startOpen, setStartOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonNotes, setReasonNotes] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [resolutionRef, setResolutionRef] = useState("");
  const [starting, setStarting] = useState(false);
  const [busyStep, setBusyStep] = useState<string | null>(null);

  const { data: exposure } = useQuery({
    queryKey: ["person-exposure", personId, workspaceId],
    enabled: !!personId && !!workspaceId,
    queryFn: () => fetchPersonExposure(personId, workspaceId!),
  });

  const { data: offboarding, isLoading } = useQuery({
    queryKey: ["person-offboarding", personId, workspaceId],
    enabled: !!personId && !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("person_offboardings")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .eq("person_entity_id", personId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: steps = [] } = useQuery({
    queryKey: ["person-offboarding-steps", offboarding?.id],
    enabled: !!offboarding?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("person_offboarding_steps")
        .select("*")
        .eq("offboarding_id", offboarding!.id)
        .order("stage")
        .order("display_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const progress = useMemo(
    () => offboardingProgress(steps.map((s: any) => ({ status: s.status, category: s.category }))),
    [steps],
  );
  const stages = useMemo(() => groupStepsByStage(steps as any[]), [steps]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["person-offboarding", personId, workspaceId] });
    qc.invalidateQueries({ queryKey: ["person-offboarding-steps", offboarding?.id] });
  };

  const handleStart = async () => {
    if (!workspaceId || !reason) return;
    setStarting(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id ?? "")
        .maybeSingle();

      const { data: created, error } = await supabase
        .from("person_offboardings")
        .insert({
          workspace_id: workspaceId,
          person_entity_id: personId,
          status: "in_progress",
          reason: reason === "Other" ? reasonNotes : reason,
          effective_date: effectiveDate || null,
          resolution_ref: resolutionRef || null,
          created_by: profile?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;

      const current = exposure ?? (await fetchPersonExposure(personId, workspaceId));
      const drafts = buildOffboardingSteps(current, personName);
      const { error: stepErr } = await supabase.from("person_offboarding_steps").insert(
        drafts.map((d) => ({
          workspace_id: workspaceId,
          offboarding_id: created.id,
          stage: d.stage,
          display_order: d.display_order,
          category: d.category,
          title: d.title,
          description: d.description,
          bank_account_id: d.bank_account_id ?? null,
          cif_id: d.cif_id ?? null,
          signatory_id: d.signatory_id ?? null,
          facility_id: d.facility_id ?? null,
          credit_limit_id: d.credit_limit_id ?? null,
          appointment_id: d.appointment_id ?? null,
        })),
      );
      if (stepErr) throw stepErr;

      toast.success(`Offboarding started — ${drafts.length} steps generated`);
      setStartOpen(false);
      setReason("");
      setReasonNotes("");
      setEffectiveDate("");
      setResolutionRef("");
      refresh();
    } catch (e: any) {
      toast.error(e.message || "Failed to start offboarding");
    } finally {
      setStarting(false);
    }
  };

  const updateStep = async (step: any, patch: Record<string, any>) => {
    setBusyStep(step.id);
    const { error } = await supabase.from("person_offboarding_steps").update(patch).eq("id", step.id);
    setBusyStep(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    refresh();
  };

  /** Raise the bank service request for a bank-facing step and mark it submitted. */
  const submitToBank = async (step: any) => {
    if (!workspaceId) return;
    setBusyStep(step.id);
    try {
      const today = format(new Date(), "yyyy-MM-dd");
      let requestId = step.service_request_id as string | null;

      if (!requestId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("workspace_id", workspaceId)
          .eq("user_id", (await supabase.auth.getUser()).data.user?.id ?? "")
          .maybeSingle();

        const requestType =
          step.category === "signatory" ? "signatory_update" : step.category === "facility" ? "modify" : "other";

        const { data: req, error: reqErr } = await supabase
          .from("bank_service_requests")
          .insert({
            workspace_id: workspaceId,
            request_type: requestType,
            status: "submitted",
            subject: `${personName} offboarding — ${step.title}`,
            description: step.description,
            date_requested: today,
            date_submitted: today,
            cif_id: step.cif_id,
            bank_account_id: step.bank_account_id,
            facility_id: step.facility_id,
            credit_limit_id: step.credit_limit_id,
            signatory_id: step.signatory_id,
            requested_by: profile?.id ?? null,
          })
          .select()
          .single();
        if (reqErr) throw reqErr;
        requestId = req.id;
      }

      const { error } = await supabase
        .from("person_offboarding_steps")
        .update({ status: "submitted", submitted_date: today, service_request_id: requestId })
        .eq("id", step.id);
      if (error) throw error;
      toast.success("Bank request raised and step marked submitted");
      refresh();
    } catch (e: any) {
      toast.error(e.message || "Failed to raise bank request");
    } finally {
      setBusyStep(null);
    }
  };

  const completeOffboarding = async () => {
    if (!offboarding) return;
    const { error } = await supabase
      .from("person_offboardings")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", offboarding.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Offboarding marked complete");
    refresh();
  };

  if (isLoading) return <div className="py-8 text-center text-muted-foreground">Loading...</div>;

  if (!offboarding) {
    const counts = exposure
      ? [
          { label: "signatory mandates", n: exposure.signatories.length },
          { label: "facilities / access", n: exposure.facilities.length },
          { label: "appointments", n: exposure.appointments.length },
          { label: "guarantees", n: exposure.guarantees.length },
          { label: "shareholdings", n: exposure.shareholdings.length },
        ].filter((c) => c.n > 0)
      : [];
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserMinus className="h-5 w-5" /> Offboarding
          </CardTitle>
          <CardDescription>
            Withdraw every authority this person holds, one step at a time. Each bank mandate is revoked separately and
            tracked to the bank's acknowledgement.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {counts.length > 0 ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {personName} currently holds{" "}
                {counts.map((c, i) => (
                  <span key={c.label}>
                    {i > 0 ? (i === counts.length - 1 ? " and " : ", ") : ""}
                    <strong>{c.n}</strong> {c.label}
                  </span>
                ))}
                .
              </AlertDescription>
            </Alert>
          ) : (
            <p className="text-sm text-muted-foreground">No active authorities found for this person.</p>
          )}
          {isAdmin && (
            <Button onClick={() => setStartOpen(true)}>
              <UserMinus className="mr-2 h-4 w-4" /> Start offboarding
            </Button>
          )}

          <Dialog open={startOpen} onOpenChange={setStartOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Start offboarding — {personName}</DialogTitle>
                <DialogDescription>
                  A checklist is generated from every mandate, facility, role, guarantee and shareholding currently held.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Reason *</label>
                  <Select value={reason} onValueChange={setReason}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select reason" />
                    </SelectTrigger>
                    <SelectContent>
                      {REASONS.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {reason === "Other" && (
                  <Textarea
                    value={reasonNotes}
                    onChange={(e) => setReasonNotes(e.target.value)}
                    placeholder="Specify reason..."
                  />
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Effective date</label>
                    <Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Resolution reference</label>
                    <Input
                      value={resolutionRef}
                      onChange={(e) => setResolutionRef(e.target.value)}
                      placeholder="BR-2026-014"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setStartOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleStart}
                  disabled={!reason || (reason === "Other" && !reasonNotes.trim()) || starting}
                >
                  {starting ? "Generating..." : "Generate checklist"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserMinus className="h-5 w-5" /> Offboarding — {personName}
              </CardTitle>
              <CardDescription>
                {offboarding.reason || "—"}
                {offboarding.effective_date && (
                  <> · effective {format(parseISO(offboarding.effective_date), "dd MMM yyyy")}</>
                )}
                {offboarding.resolution_ref && <> · resolution {offboarding.resolution_ref}</>}
              </CardDescription>
            </div>
            <Badge className={offboarding.status === "completed" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}>
              {offboarding.status === "completed" ? "Completed" : "In progress"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress value={progress.percent} />
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>
              <strong className="text-foreground">
                {progress.closed} of {progress.total}
              </strong>{" "}
              steps closed
            </span>
            <span>
              <strong className="text-foreground">{progress.openMandates}</strong> bank mandate(s) still to revoke
            </span>
          </div>
          {progress.complete && offboarding.status !== "completed" && isAdmin && (
            <Button onClick={completeOffboarding} className="bg-green-600 hover:bg-green-700">
              <CheckCircle2 className="mr-2 h-4 w-4" /> Mark offboarding complete
            </Button>
          )}
          {!progress.complete && (
            <Alert className="border-warning/50 bg-warning/5">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <AlertDescription className="text-sm">
                This person cannot be deactivated until every step below is done or marked not applicable.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {stages.map((stage) => (
        <Card key={stage.stage} className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Stage {stage.stage} — {stage.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stage.steps.map((step: any) => (
              <div key={step.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{step.title}</p>
                    {step.description && (
                      <p className="mt-1 text-xs text-muted-foreground">{step.description}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {step.submitted_date && <span>Submitted {step.submitted_date}</span>}
                      {step.acknowledged_date && <span>Acknowledged {step.acknowledged_date}</span>}
                      {step.completed_date && <span>Completed {step.completed_date}</span>}
                      {step.service_request_id && (
                        <span className="inline-flex items-center gap-1">
                          <Landmark className="h-3 w-3" /> Bank request raised
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge className={STATUS_COLORS[step.status as OffboardingStepStatus]}>
                    {STEP_STATUS_LABELS[step.status as OffboardingStepStatus]}
                  </Badge>
                </div>

                {isAdmin && offboarding.status !== "completed" && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {stepNeedsBankRequest(step) && step.status === "pending" && (
                      <Button size="sm" variant="outline" disabled={busyStep === step.id} onClick={() => submitToBank(step)}>
                        {busyStep === step.id ? (
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        ) : (
                          <Send className="mr-2 h-3 w-3" />
                        )}
                        Submit to bank
                      </Button>
                    )}
                    {step.status === "submitted" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyStep === step.id}
                        onClick={() =>
                          updateStep(step, {
                            status: "acknowledged",
                            acknowledged_date: format(new Date(), "yyyy-MM-dd"),
                          })
                        }
                      >
                        Bank acknowledged
                      </Button>
                    )}
                    {step.status !== "done" && (
                      <Button
                        size="sm"
                        disabled={busyStep === step.id}
                        onClick={() =>
                          updateStep(step, { status: "done", completed_date: format(new Date(), "yyyy-MM-dd") })
                        }
                      >
                        <CheckCircle2 className="mr-2 h-3 w-3" /> Mark done
                      </Button>
                    )}
                    {step.status !== "not_applicable" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busyStep === step.id}
                        onClick={() => updateStep(step, { status: "not_applicable" })}
                      >
                        Not applicable
                      </Button>
                    )}
                    <Input
                      className="h-8 w-44"
                      placeholder="Bank reference"
                      defaultValue={step.bank_reference ?? ""}
                      onBlur={(e) =>
                        e.target.value !== (step.bank_reference ?? "") &&
                        updateStep(step, { bank_reference: e.target.value || null })
                      }
                    />
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
