import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Search, History, ChevronDown, Building2, FileText } from "lucide-react";
import { format, parseISO } from "date-fns";

type AuditRow = {
  id: string;
  table_name: string;
  record_id: string;
  record_label: string | null;
  action: string;
  actor_name: string | null;
  actor_email: string | null;
  changed_fields: Record<string, { old: unknown; new: unknown }> | null;
  created_at: string;
};

const HIDDEN_FIELDS = new Set(["updated_at", "created_at", "workspace_id", "id"]);

const actionVariant: Record<string, string> = {
  INSERT: "bg-success/15 text-success border-success/30",
  UPDATE: "bg-warning/15 text-warning border-warning/30",
  DELETE: "bg-destructive/15 text-destructive border-destructive/30",
};

const actionLabel: Record<string, string> = {
  INSERT: "Created",
  UPDATE: "Updated",
  DELETE: "Deleted",
};

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatFieldName(field: string) {
  return field.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AuditLog() {
  const { workspaceId } = useAuth();
  const [search, setSearch] = useState("");
  const [tableFilter, setTableFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [openRow, setOpenRow] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["audit-log", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as unknown as AuditRow[];
    },
  });

  const rows = useMemo(() => {
    return (data ?? []).filter((r) => {
      if (tableFilter !== "all" && r.table_name !== tableFilter) return false;
      if (actionFilter !== "all" && r.action !== actionFilter) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        (r.record_label || "").toLowerCase().includes(q) ||
        (r.actor_name || "").toLowerCase().includes(q) ||
        (r.actor_email || "").toLowerCase().includes(q)
      );
    });
  }, [data, tableFilter, actionFilter, search]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <History className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
          <p className="text-sm text-muted-foreground">
            Every create, update and delete on entities and documents in this workspace.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search record or user…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={tableFilter} onValueChange={setTableFilter}>
          <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All records</SelectItem>
            <SelectItem value="entities">Entities</SelectItem>
            <SelectItem value="documents">Documents</SelectItem>
          </SelectContent>
        </Select>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            <SelectItem value="INSERT">Created</SelectItem>
            <SelectItem value="UPDATE">Updated</SelectItem>
            <SelectItem value="DELETE">Deleted</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-44">When</TableHead>
              <TableHead className="w-28">Action</TableHead>
              <TableHead>Record</TableHead>
              <TableHead>By</TableHead>
              <TableHead className="w-32 text-right">Changes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow>
            )}
            {!isLoading && rows.length === 0 && (
              <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">No audit activity yet.</TableCell></TableRow>
            )}
            {rows.map((r) => {
              const changes = Object.entries(r.changed_fields || {}).filter(([k]) => !HIDDEN_FIELDS.has(k));
              const isOpen = openRow === r.id;
              return (
                <Collapsible key={r.id} asChild open={isOpen} onOpenChange={(o) => setOpenRow(o ? r.id : null)}>
                  <>
                    <TableRow>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {format(parseISO(r.created_at), "dd MMM yyyy, HH:mm")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={actionVariant[r.action]}>
                          {actionLabel[r.action] ?? r.action}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {r.table_name === "entities"
                            ? <Building2 className="h-4 w-4 text-muted-foreground" />
                            : <FileText className="h-4 w-4 text-muted-foreground" />}
                          <span className="font-medium">{r.record_label || "—"}</span>
                          <span className="text-xs text-muted-foreground capitalize">
                            {r.table_name === "entities" ? "entity" : "document"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{r.actor_name || "System"}</div>
                        {r.actor_email && <div className="text-xs text-muted-foreground">{r.actor_email}</div>}
                      </TableCell>
                      <TableCell className="text-right">
                        {changes.length > 0 ? (
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="gap-1">
                              {changes.length} field{changes.length > 1 ? "s" : ""}
                              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                            </Button>
                          </CollapsibleTrigger>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                    <CollapsibleContent asChild>
                      <TableRow>
                        <TableCell colSpan={5} className="bg-muted/40">
                          <div className="space-y-2 py-2">
                            {changes.map(([field, v]) => (
                              <div key={field} className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-[200px_1fr]">
                                <div className="font-medium">{formatFieldName(field)}</div>
                                <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                                  <span className="line-through">{formatValue(v?.old)}</span>
                                  <span>→</span>
                                  <span className="text-foreground">{formatValue(v?.new)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    </CollapsibleContent>
                  </>
                </Collapsible>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
