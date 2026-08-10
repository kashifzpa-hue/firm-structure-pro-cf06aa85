import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Edit, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatLimit } from "@/lib/banking-utils";
import {
  ACCESS_LEVELS,
  CREDIT_LIMIT_STATUSES,
  CREDIT_LIMIT_TYPES,
  FACILITY_STATUSES,
  FACILITY_TYPES,
  dateStatus,
  dualControlIssues,
  labelFor,
  limitTotalsByCurrency,
} from "@/lib/facility-utils";
import { FacilityForm } from "@/components/banking/FacilityForm";
import { CreditLimitForm } from "@/components/banking/CreditLimitForm";
import { ServiceRequestForm } from "@/components/banking/ServiceRequestForm";

interface Props {
  cifId: string;
  persons: { id: string; name: string; entity_status?: string }[];
  entities: { id: string; name: string }[];
  accounts: { id: string; label: string }[];
  isAdmin: boolean;
}

function StatusPill({ status }: { status: "valid" | "expiring" | "expired" | "none" }) {
  if (status === "none") return <span className="text-muted-foreground">—</span>;
  const map = {
    valid: "bg-green-100 text-green-800",
    expiring: "bg-amber-100 text-amber-800",
    expired: "bg-red-100 text-red-800",
  } as const;
  const label = { valid: "Valid", expiring: "Due Soon", expired: "Overdue" } as const;
  return <Badge className={`${map[status]} hover:${map[status]}`}>{label[status]}</Badge>;
}

export function FacilitiesTab({ cifId, persons, entities, accounts, isAdmin }: Props) {
  const { workspaceId } = useAuth();
  const qc = useQueryClient();
  const [facilityFormOpen, setFacilityFormOpen] = useState(false);
  const [editFacility, setEditFacility] = useState<any>(null);
  const [limitFormOpen, setLimitFormOpen] = useState(false);
  const [editLimit, setEditLimit] = useState<any>(null);
  const [renewLimit, setRenewLimit] = useState<any>(null);

  const { data: facilities = [] } = useQuery({
    queryKey: ["bank-facilities", cifId],
    enabled: !!cifId && !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_facilities" as any)
        .select("*, person:entities!bank_facilities_person_entity_id_fkey(id, name, entity_status)")
        .eq("cif_id", cifId)
        .order("facility_type");
      if (error) throw error;
      return (data || []).map((f: any) => ({
        ...f,
        person_name: f.person?.name,
        person_status: f.person?.entity_status,
      }));
    },
  });

  const { data: limits = [] } = useQuery({
    queryKey: ["bank-credit-limits", cifId],
    enabled: !!cifId && !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_credit_limits" as any)
        .select("*, guarantor:entities!bank_credit_limits_guarantor_entity_id_fkey(name)")
        .eq("cif_id", cifId)
        .order("next_review_date", { nullsFirst: false });
      if (error) throw error;
      return data || [];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["bank-facilities", cifId] });
    qc.invalidateQueries({ queryKey: ["bank-credit-limits", cifId] });
    qc.invalidateQueries({ queryKey: ["bank-service-requests", cifId] });
  };

  const issues = useMemo(() => dualControlIssues(facilities as any), [facilities]);
  const inactivePersonFacilities = useMemo(
    () => facilities.filter((f: any) => f.status === "active" && f.person_status && f.person_status !== "active"),
    [facilities],
  );
  const totals = useMemo(() => limitTotalsByCurrency(limits as any), [limits]);

  const roster = facilities.filter((f: any) => f.facility_type === "internet_banking");
  const others = facilities.filter((f: any) => f.facility_type !== "internet_banking");
  const sortedLimits = [...limits].sort((a: any, b: any) =>
    (a.next_review_date || "9999").localeCompare(b.next_review_date || "9999"));

  const deleteFacility = async (row: any) => {
    const { error } = await supabase.from("bank_facilities" as any).delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("Facility removed");
    refresh();
  };

  const deleteLimit = async (row: any) => {
    const { error } = await supabase.from("bank_credit_limits" as any).delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("Limit removed");
    refresh();
  };

  return (
    <div className="space-y-6">
      {(issues.length > 0 || inactivePersonFacilities.length > 0) && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Internal control warnings</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4 space-y-1">
              {issues.map((i, idx) => <li key={idx}>{i.message}</li>)}
              {inactivePersonFacilities.map((f: any) => (
                <li key={f.id}>
                  {f.person_name} is no longer active but still holds {labelFor(FACILITY_TYPES, f.facility_type)} access
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Internet banking roster */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Internet Banking Access ({roster.length})</CardTitle>
          {isAdmin && (
            <Button size="sm" variant="outline" onClick={() => { setEditFacility(null); setFacilityFormOpen(true); }}>
              <Plus className="h-3 w-3 mr-1" /> Add Facility
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {roster.length === 0 ? (
            <p className="text-sm text-muted-foreground">No internet banking users recorded.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Person</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Token</TableHead>
                  <TableHead>Daily Limit</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdmin && <TableHead className="w-20" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {roster.map((f: any) => (
                  <TableRow key={f.id}>
                    <TableCell>{f.person_name || "—"}</TableCell>
                    <TableCell>{labelFor(ACCESS_LEVELS, f.access_level)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {f.token_serial ? `${f.token_serial} (${f.token_status})` : "—"}
                    </TableCell>
                    <TableCell>{formatLimit(f.daily_limit, f.limit_currency)}</TableCell>
                    <TableCell><Badge variant="secondary">{labelFor(FACILITY_STATUSES, f.status)}</Badge></TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => { setEditFacility(f); setFacilityFormOpen(true); }}><Edit className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteFacility(f)}><Trash2 className="h-3 w-3" /></Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Other facilities */}
      <Card className="shadow-sm">
        <CardHeader><CardTitle className="text-base">Other Facilities ({others.length})</CardTitle></CardHeader>
        <CardContent>
          {others.length === 0 ? (
            <p className="text-sm text-muted-foreground">No other facilities recorded.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Person</TableHead>
                  <TableHead>Fee</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdmin && <TableHead className="w-20" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {others.map((f: any) => {
                  const detail =
                    f.facility_type === "sweep"
                      ? [f.sweep_type, f.sweep_target_account, f.sweep_frequency].filter(Boolean).join(" · ")
                      : f.facility_type === "statement_delivery"
                        ? [f.statement_method, f.statement_frequency, (f.statement_recipients || []).join(", ")].filter(Boolean).join(" · ")
                        : f.facility_type === "cheque_book"
                          ? [f.cheque_book_number, f.leaf_range_start && `${f.leaf_range_start}–${f.leaf_range_end || "?"}`].filter(Boolean).join(" · ")
                          : f.bank_reference || f.notes || "—";
                  return (
                    <TableRow key={f.id}>
                      <TableCell>
                        {labelFor(FACILITY_TYPES, f.facility_type)}
                        {f.umbrella_ref && <span className="ml-2 text-xs text-muted-foreground">({f.umbrella_ref})</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{detail || "—"}</TableCell>
                      <TableCell>{f.person_name || "—"}</TableCell>
                      <TableCell>{f.annual_fee != null ? formatLimit(f.annual_fee, f.fee_currency || "AED") : "—"}</TableCell>
                      <TableCell><Badge variant="secondary">{labelFor(FACILITY_STATUSES, f.status)}</Badge></TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => { setEditFacility(f); setFacilityFormOpen(true); }}><Edit className="h-3 w-3" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteFacility(f)}><Trash2 className="h-3 w-3" /></Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Borrowing limits */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Borrowing Limits ({limits.length})</CardTitle>
          {isAdmin && (
            <Button size="sm" variant="outline" onClick={() => { setEditLimit(null); setLimitFormOpen(true); }}>
              <Plus className="h-3 w-3 mr-1" /> Add Limit
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {totals.length > 0 && (
            <div className="flex flex-wrap gap-4">
              {totals.map(t => (
                <div key={t.currency} className="rounded-lg border px-4 py-2 text-sm">
                  <div className="font-medium">{t.currency}</div>
                  <div className="text-muted-foreground">
                    Sanctioned {t.sanctioned.toLocaleString()} · Utilised {t.utilised.toLocaleString()} · Headroom {t.headroom.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}

          {limits.length === 0 ? (
            <p className="text-sm text-muted-foreground">No borrowing limits recorded.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Sanctioned</TableHead>
                  <TableHead>Utilised</TableHead>
                  <TableHead>Headroom</TableHead>
                  <TableHead>Review</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdmin && <TableHead className="w-28" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedLimits.map((l: any) => {
                  const headroom = Number(l.sanctioned_amount || 0) - Number(l.utilised_amount || 0);
                  return (
                    <TableRow key={l.id}>
                      <TableCell>
                        {labelFor(CREDIT_LIMIT_TYPES, l.limit_type)}
                        <span className="ml-2 text-xs text-muted-foreground">{l.is_funded ? "Funded" : "Non-funded"}</span>
                      </TableCell>
                      <TableCell>{formatLimit(l.sanctioned_amount, l.currency)}</TableCell>
                      <TableCell>{l.utilised_amount != null ? formatLimit(l.utilised_amount, l.currency) : "—"}</TableCell>
                      <TableCell>{formatLimit(headroom, l.currency)}</TableCell>
                      <TableCell className="space-x-2">
                        <span>{l.next_review_date || "—"}</span>
                        <StatusPill status={dateStatus(l.next_review_date)} />
                      </TableCell>
                      <TableCell className="space-x-2">
                        <span>{l.expiry_date || "—"}</span>
                        <StatusPill status={dateStatus(l.expiry_date)} />
                      </TableCell>
                      <TableCell><Badge variant="secondary">{labelFor(CREDIT_LIMIT_STATUSES, l.status)}</Badge></TableCell>
                      {isAdmin && (
                        <TableCell className="text-right whitespace-nowrap">
                          <Button variant="ghost" size="sm" onClick={() => setRenewLimit(l)}>Renew</Button>
                          <Button variant="ghost" size="icon" onClick={() => { setEditLimit(l); setLimitFormOpen(true); }}><Edit className="h-3 w-3" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteLimit(l)}><Trash2 className="h-3 w-3" /></Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {facilityFormOpen && (
        <FacilityForm
          open={facilityFormOpen}
          onClose={() => { setFacilityFormOpen(false); setEditFacility(null); }}
          onSaved={() => { setFacilityFormOpen(false); setEditFacility(null); refresh(); }}
          cifId={cifId}
          persons={persons}
          accounts={accounts}
          editData={editFacility}
        />
      )}

      {limitFormOpen && (
        <CreditLimitForm
          open={limitFormOpen}
          onClose={() => { setLimitFormOpen(false); setEditLimit(null); }}
          onSaved={() => { setLimitFormOpen(false); setEditLimit(null); refresh(); }}
          cifId={cifId}
          entities={entities}
          parentLimits={limits.map((l: any) => ({
            id: l.id,
            label: `${labelFor(CREDIT_LIMIT_TYPES, l.limit_type)} — ${formatLimit(l.sanctioned_amount, l.currency)}`,
          }))}
          editData={editLimit}
        />
      )}

      {renewLimit && (
        <ServiceRequestForm
          open={!!renewLimit}
          onClose={() => setRenewLimit(null)}
          onSaved={() => { setRenewLimit(null); refresh(); }}
          cifId={cifId}
          accounts={accounts}
          facilities={facilities.map((f: any) => ({ id: f.id, label: labelFor(FACILITY_TYPES, f.facility_type) }))}
          limits={limits.map((l: any) => ({ id: l.id, label: labelFor(CREDIT_LIMIT_TYPES, l.limit_type) }))}
          signatories={[]}
          defaults={{
            request_type: "limit_renewal",
            credit_limit_id: renewLimit.id,
            subject: `Renewal of ${labelFor(CREDIT_LIMIT_TYPES, renewLimit.limit_type)} — ${formatLimit(renewLimit.sanctioned_amount, renewLimit.currency)}`,
          }}
        />
      )}
    </div>
  );
}
