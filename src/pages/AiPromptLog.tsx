import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Search, Terminal, ChevronDown, CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from "date-fns";

type PromptLogRow = {
  id: string;
  thread_id: string | null;
  user_email: string | null;
  model: string;
  provider: string;
  run_id: string | null;
  system_prompt: string | null;
  sent_messages: unknown;
  provider_options: unknown;
  available_tools: string[] | null;
  tool_calls: unknown;
  response_text: string | null;
  finish_reason: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  duration_ms: number | null;
  status: string;
  error_message: string | null;
  created_at: string;
};

const statusStyles: Record<string, string> = {
  success: "bg-success/15 text-success border-success/30",
  pending: "bg-warning/15 text-warning border-warning/30",
  error: "bg-destructive/15 text-destructive border-destructive/30",
};

function Json({ value }: { value: unknown }) {
  return (
    <pre className="max-h-80 overflow-auto rounded-md bg-muted/50 p-3 text-xs leading-relaxed">
      {JSON.stringify(value ?? null, null, 2)}
    </pre>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function subjectsOf(r: PromptLogRow): Set<string> {
  const names = [
    ...(r.available_tools ?? []),
    ...(Array.isArray(r.tool_calls) ? (r.tool_calls as { tool?: string }[]).map((c) => c?.tool ?? "") : []),
  ].join(" ").toLowerCase();
  const used = Array.isArray(r.tool_calls)
    ? (r.tool_calls as { tool?: string }[]).map((c) => (c?.tool ?? "").toLowerCase()).join(" ")
    : "";
  const scope = used || names;
  const out = new Set<string>();
  if (scope.includes("entit")) out.add("entities");
  if (scope.includes("document")) out.add("documents");
  if (scope.includes("ownership") || scope.includes("ubo")) out.add("ownership");
  return out;
}

export default function AiPromptLog() {
  const { workspaceId, userRole } = useAuth();
  const isAdmin = userRole === "admin";
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modelFilter, setModelFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [openRow, setOpenRow] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["ai-prompt-log", workspaceId],
    enabled: !!workspaceId && isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_prompt_logs")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data || []) as unknown as PromptLogRow[];
    },
  });

  const models = useMemo(
    () => Array.from(new Set((data ?? []).map((r) => r.model).filter(Boolean))).sort(),
    [data],
  );

  const rows = useMemo(() => {
    return (data ?? []).filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (modelFilter !== "all" && r.model !== modelFilter) return false;
      if (subjectFilter !== "all" && !subjectsOf(r).has(subjectFilter)) return false;
      if (dateRange?.from) {
        const when = parseISO(r.created_at);
        const start = startOfDay(dateRange.from);
        const end = endOfDay(dateRange.to ?? dateRange.from);
        if (!isWithinInterval(when, { start, end })) return false;
      }
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        (r.user_email || "").toLowerCase().includes(q) ||
        (r.model || "").toLowerCase().includes(q) ||
        (r.response_text || "").toLowerCase().includes(q) ||
        JSON.stringify(r.sent_messages ?? "").toLowerCase().includes(q)
      );
    });
  }, [data, statusFilter, modelFilter, subjectFilter, dateRange, search]);

  const filtersActive =
    statusFilter !== "all" || modelFilter !== "all" || subjectFilter !== "all" || !!dateRange?.from || !!search;

  const clearFilters = () => {
    setStatusFilter("all");
    setModelFilter("all");
    setSubjectFilter("all");
    setDateRange(undefined);
    setSearch("");
  };

  if (!isAdmin) {
    return (
      <div className="rounded-lg border bg-card p-10 text-center text-muted-foreground">
        Only workspace admins can view the AI prompt log.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Terminal className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI Prompt Log</h1>
          <p className="text-sm text-muted-foreground">
            Every AI Copilot request, including the exact instructions, conversation and workspace data sent to the model.
            Emails, phone numbers, IBANs, IDs, card numbers, keys and tokens are automatically redacted before being stored.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search user, model or prompt content…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-44">When</TableHead>
              <TableHead>User</TableHead>
              <TableHead className="w-48">Model</TableHead>
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="w-28 text-right">Tokens</TableHead>
              <TableHead className="w-28 text-right">Payload</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow>
            )}
            {!isLoading && rows.length === 0 && (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No AI requests logged yet.</TableCell></TableRow>
            )}
            {rows.map((r) => (
              <Collapsible key={r.id} asChild open={openRow === r.id} onOpenChange={(o) => setOpenRow(o ? r.id : null)}>
                <>
                  <TableRow>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {format(parseISO(r.created_at), "dd MMM yyyy HH:mm")}
                    </TableCell>
                    <TableCell className="text-sm">{r.user_email || "—"}</TableCell>
                    <TableCell className="text-sm">{r.model}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusStyles[r.status] ?? ""}>{r.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {r.total_tokens ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="gap-1">
                          View
                          <ChevronDown className={`h-4 w-4 transition-transform ${openRow === r.id ? "rotate-180" : ""}`} />
                        </Button>
                      </CollapsibleTrigger>
                    </TableCell>
                  </TableRow>
                  <CollapsibleContent asChild>
                    <TableRow>
                      <TableCell colSpan={6} className="bg-muted/20">
                        <div className="space-y-4 py-2">
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <span>Provider: {r.provider}</span>
                            <span>•</span>
                            <span>Finish: {r.finish_reason ?? "—"}</span>
                            <span>•</span>
                            <span>Duration: {r.duration_ms != null ? `${r.duration_ms} ms` : "—"}</span>
                            <span>•</span>
                            <span>In/Out tokens: {r.input_tokens ?? "—"}/{r.output_tokens ?? "—"}</span>
                            {r.run_id && (<><span>•</span><span>Run: {r.run_id}</span></>)}
                          </div>

                          {r.error_message && (
                            <Section title="Error">
                              <p className="text-sm text-destructive">{r.error_message}</p>
                            </Section>
                          )}

                          <Section title="Tools available">
                            <p className="text-sm">{(r.available_tools ?? []).join(", ") || "—"}</p>
                          </Section>

                          <Section title="System prompt sent">
                            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-xs leading-relaxed">
                              {r.system_prompt || "—"}
                            </pre>
                          </Section>

                          <Section title="Messages sent to model">
                            <Json value={r.sent_messages} />
                          </Section>

                          <Section title="Provider options">
                            <Json value={r.provider_options} />
                          </Section>

                          <Section title="Tool calls & data returned to model">
                            <Json value={r.tool_calls} />
                          </Section>

                          <Section title="Model response">
                            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-xs leading-relaxed">
                              {r.response_text || "—"}
                            </pre>
                          </Section>
                        </div>
                      </TableCell>
                    </TableRow>
                  </CollapsibleContent>
                </>
              </Collapsible>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
