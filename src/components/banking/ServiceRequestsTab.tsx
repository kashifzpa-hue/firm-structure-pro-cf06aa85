import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  OPEN_REQUEST_STATUSES,
  REQUEST_STATUSES,
  REQUEST_TYPES,
  isRequestOverdue,
  labelFor,
} from "@/lib/facility-utils";
import { ServiceRequestForm } from "@/components/banking/ServiceRequestForm";

interface Props {
  bankAccountId: string;
  isAdmin: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-800",
  submitted: "bg-blue-100 text-blue-800",
  acknowledged: "bg-indigo-100 text-indigo-800",
  in_progress: "bg-amber-100 text-amber-800",
  completed: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  cancelled: "bg-slate-100 text-slate-500",
};

export function ServiceRequestsTab({ bankAccountId, isAdmin }: Props) {
  const { workspaceId } = useAuth();
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("open");
  const [typeFilter, setTypeFilter] = useState("all");

  const { data: requests = [] } = useQuery({
    queryKey: ["bank-service-requests", bankAccountId],
    enabled: !!bankAccountId && !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_service_requests" as any)
        .select("*")
        .eq("bank_account_id", bankAccountId)
        .order("date_requested", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: facilities = [] } = useQuery({
    queryKey: ["bank-facilities", bankAccountId],
    enabled: !!bankAccountId && !!workspaceId,
    queryFn: async () => {
      const { data } = await supabase.from("bank_facilities" as any).select("id, facility_type").eq("bank_account_id", bankAccountId);
      return data || [];
    },
  });

  const { data: limits = [] } = useQuery({
    queryKey: ["bank-credit-limits", bankAccountId],
    enabled: !!bankAccountId && !!workspaceId,
    queryFn: async () => {
      const { data } = await supabase.from("bank_credit_limits" as any).select("id, limit_type").eq("bank_account_id", bankAccountId);
      return data || [];
    },
  });

  const { data: signatories = [] } = useQuery({
    queryKey: ["bank-signatories-simple", bankAccountId],
    enabled: !!bankAccountId && !!workspaceId,
    queryFn: async () => {
      const { data } = await supabase
        .from("signatories")
        .select("id, person:entities!signatories_person_entity_id_fkey(name)")
        .eq("bank_account_id", bankAccountId);
      return (data || []).map((s: any) => ({ id: s.id, label: s.person?.name || "Signatory" }));
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["bank-service-requests", bankAccountId] });

  const filtered = useMemo(() => requests.filter((r: any) => {
    if (statusFilter === "open" && !OPEN_REQUEST_STATUSES.includes(r.status)) return false;
    if (statusFilter !== "open" && statusFilter !== "all" && r.status !== statusFilter) return false;
    if (typeFilter !== "all" && r.request_type !== typeFilter) return false;
    if (search && !`${r.subject} ${r.bank_reference || ""} ${r.bank_contact || ""}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [requests, statusFilter, typeFilter, search]);

  const openCount = requests.filter((r: any) => OPEN_REQUEST_STATUSES.includes(r.status)).length;
  const overdueCount = requests.filter((r: any) => isRequestOverdue(r)).length;

  const remove = async (row: any) => {
    const { error } = await supabase.from("bank_service_requests" as any).delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("Request deleted");
    refresh();
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Service Requests ({requests.length})</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">{openCount} open · {overdueCount} overdue</p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => { setEditData(null); setFormOpen(true); }}>
            <Plus className="h-3 w-3 mr-1" /> Log Request
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <Input placeholder="Search subject, reference, contact..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open only</SelectItem>
              <SelectItem value="all">All statuses</SelectItem>
              {REQUEST_STATUSES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {REQUEST_TYPES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No service requests match these filters.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Expected</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Status</TableHead>
                {isAdmin && <TableHead className="w-20" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.subject}</TableCell>
                  <TableCell>{labelFor(REQUEST_TYPES, r.request_type)}</TableCell>
                  <TableCell>{r.date_requested || "—"}</TableCell>
                  <TableCell>{r.date_submitted || "—"}</TableCell>
                  <TableCell>
                    {r.expected_completion || "—"}
                    {isRequestOverdue(r) && <Badge className="ml-2 bg-red-100 text-red-800 hover:bg-red-100">Overdue</Badge>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.bank_reference || "—"}</TableCell>
                  <TableCell>
                    <Badge className={`${STATUS_COLORS[r.status] || ""} hover:${STATUS_COLORS[r.status] || ""}`}>
                      {labelFor(REQUEST_STATUSES, r.status)}
                    </Badge>
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="icon" onClick={() => { setEditData(r); setFormOpen(true); }}><Edit className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(r)}><Trash2 className="h-3 w-3" /></Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {formOpen && (
        <ServiceRequestForm
          open={formOpen}
          onClose={() => { setFormOpen(false); setEditData(null); }}
          onSaved={() => { setFormOpen(false); setEditData(null); refresh(); }}
          bankAccountId={bankAccountId}
          facilities={(facilities as any[]).map(f => ({ id: f.id, label: f.facility_type }))}
          limits={(limits as any[]).map(l => ({ id: l.id, label: l.limit_type }))}
          signatories={signatories as any[]}
          editData={editData}
        />
      )}
    </Card>
  );
}
