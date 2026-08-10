import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBankingEnabled } from "@/hooks/use-banking-enabled";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Grid3x3, Search, CheckCircle2, Users } from "lucide-react";
import { maskAccountNumber, formatLimit, getAuthorityLabels, RULE_TYPES } from "@/lib/banking-utils";
import { format, parseISO } from "date-fns";

type Row = Record<string, any>;

function bankLabel(a: Row | undefined | null) {
  if (!a) return "—";
  return a.bank_name === "Other" ? a.bank_name_custom || "Other" : a.bank_name;
}

const ruleTypeLabel = (t: string) => RULE_TYPES.find((r) => r.value === t)?.label ?? t.replace(/_/g, " ");

function describeRule(rule: Row) {
  const parts: string[] = [];
  if (rule.rule_type === "solo") {
    parts.push(`Any 1 from ${rule.group_a?.group_label ?? "Group A"}`);
  } else if (rule.rule_type === "joint_same_group") {
    parts.push(`Any ${rule.min_signatories_from_a ?? 2} from ${rule.group_a?.group_label ?? "Group A"}`);
  } else {
    parts.push(
      `${rule.min_signatories_from_a ?? 1} from ${rule.group_a?.group_label ?? "Group A"} + ${
        rule.min_signatories_from_b ?? 1
      } from ${rule.group_b?.group_label ?? "Group B"}`,
    );
  }
  return parts.join(" ");
}

export default function SignatoryMatrix() {
  const { workspaceId } = useAuth();
  const { bankingEnabled } = useBankingEnabled();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [activeOnly, setActiveOnly] = useState("active");

  const { data, isLoading } = useQuery({
    queryKey: ["signatory-matrix", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const [accounts, signatories, rules, groups] = await Promise.all([
        supabase
          .from("bank_accounts")
          .select(
            "id, bank_name, bank_name_custom, account_number, currency, account_status, company:entities!bank_accounts_company_entity_id_fkey(id, name), cif:bank_relationships!bank_accounts_cif_id_fkey(id, cif_number)",
          )
          .eq("workspace_id", workspaceId!)
          .order("bank_name"),
        supabase
          .from("signatories")
          .select(
            "id, bank_account_id, designation, title, authorised_for, individual_limit, individual_limit_currency, effective_date, expiry_date, status, bank_acknowledged_date, person:entities!signatories_person_entity_id_fkey(id, name), group:signatory_groups!signatories_signatory_group_id_fkey(id, group_label)",
          )
          .eq("workspace_id", workspaceId!),
        supabase
          .from("signing_matrix_rules")
          .select(
            "id, bank_account_id, rule_name, rule_type, min_signatories_from_a, min_signatories_from_b, transaction_limit, daily_limit, limit_currency, applies_to, display_order, group_a:signatory_groups!signing_matrix_rules_group_a_id_fkey(id, group_label), group_b:signatory_groups!signing_matrix_rules_group_b_id_fkey(id, group_label)",
          )
          .eq("workspace_id", workspaceId!)
          .order("display_order"),
        supabase
          .from("signatory_groups")
          .select("id, bank_account_id, group_label, description, display_order")
          .eq("workspace_id", workspaceId!)
          .order("display_order"),
      ]);
      return {
        accounts: (accounts.data ?? []) as Row[],
        signatories: (signatories.data ?? []) as Row[],
        rules: (rules.data ?? []) as Row[],
        groups: (groups.data ?? []) as Row[],
      };
    },
  });

  const accounts = data?.accounts ?? [];
  const signatories = data?.signatories ?? [];
  const rules = data?.rules ?? [];
  const groups = data?.groups ?? [];

  const companies = useMemo(() => {
    const map = new Map<string, string>();
    accounts.forEach((a) => a.company && map.set(a.company.id, a.company.name));
    return [...map.entries()];
  }, [accounts]);

  const visibleSignatories = useMemo(
    () => (activeOnly === "active" ? signatories.filter((s) => s.status === "active") : signatories),
    [signatories, activeOnly],
  );

  const visibleAccounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accounts.filter((a) => {
      if (companyFilter !== "all" && a.company?.id !== companyFilter) return false;
      if (!q) return true;
      const people = visibleSignatories
        .filter((s) => s.bank_account_id === a.id)
        .map((s) => s.person?.name ?? "")
        .join(" ")
        .toLowerCase();
      return (
        `${bankLabel(a)} ${a.account_number ?? ""} ${a.company?.name ?? ""} ${a.cif?.cif_number ?? ""}`
          .toLowerCase()
          .includes(q) || people.includes(q)
      );
    });
  }, [accounts, companyFilter, search, visibleSignatories]);

  // People x accounts grid
  const people = useMemo(() => {
    const map = new Map<string, string>();
    visibleSignatories.forEach((s) => {
      if (s.person && visibleAccounts.some((a) => a.id === s.bank_account_id)) map.set(s.person.id, s.person.name);
    });
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [visibleSignatories, visibleAccounts]);

  const cell = (personId: string, accountId: string) =>
    visibleSignatories.find((s) => s.person?.id === personId && s.bank_account_id === accountId);

  const exportCSV = () => {
    const header = ["Person", ...visibleAccounts.map((a) => `${bankLabel(a)} ${maskAccountNumber(a.account_number)}`)];
    const rows = people.map(([id, name]) => [
      name,
      ...visibleAccounts.map((a) => {
        const s = cell(id, a.id);
        return s ? `${s.group?.group_label ?? s.designation ?? "signatory"}` : "";
      }),
    ]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "signatory_matrix.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!bankingEnabled) {
    return (
      <div className="flex h-64 flex-col items-center justify-center text-muted-foreground">
        <Grid3x3 className="mb-4 h-16 w-16 opacity-30" />
        <p className="text-lg font-medium">Signatory Matrix</p>
        <p className="text-sm">This premium add-on is not enabled for your workspace.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Signatory Matrix</h1>
          <p className="text-sm text-muted-foreground">
            Who can sign on which bank account, and the signing rules that apply.
          </p>
        </div>
        <Button variant="outline" onClick={exportCSV}>
          Export CSV
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search person, bank, account, CIF…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={companyFilter} onValueChange={setCompanyFilter}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="All companies" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All companies</SelectItem>
            {companies.map(([id, name]) => (
              <SelectItem key={id} value={id}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={activeOnly} onValueChange={setActiveOnly}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active signatories</SelectItem>
            <SelectItem value="all">All statuses</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-primary" />
            Person × Bank account
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">Loading…</div>
          ) : people.length === 0 || visibleAccounts.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">No signatory links found</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-10 min-w-48 bg-card">Person</TableHead>
                    {visibleAccounts.map((a) => (
                      <TableHead key={a.id} className="min-w-40 align-bottom">
                        <button
                          type="button"
                          className="text-left hover:underline"
                          onClick={() => navigate(`/bank-accounts/${a.id}`)}
                        >
                          <span className="block font-medium">{bankLabel(a)}</span>
                          <span className="block font-mono text-xs text-muted-foreground">
                            {maskAccountNumber(a.account_number)}
                          </span>
                          <span className="block text-xs text-muted-foreground">{a.company?.name}</span>
                        </button>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {people.map(([personId, name]) => (
                    <TableRow key={personId}>
                      <TableCell
                        className="sticky left-0 z-10 cursor-pointer bg-card font-medium hover:underline"
                        onClick={() => navigate(`/entities/${personId}`)}
                      >
                        {name}
                      </TableCell>
                      {visibleAccounts.map((a) => {
                        const s = cell(personId, a.id);
                        return (
                          <TableCell key={a.id} className="align-top">
                            {s ? (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5 text-sm">
                                  <CheckCircle2
                                    className={
                                      s.status === "active" ? "h-4 w-4 text-green-600" : "h-4 w-4 text-muted-foreground"
                                    }
                                  />
                                  <span>{s.group?.group_label ?? s.designation}</span>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {formatLimit(s.individual_limit, s.individual_limit_currency)}
                                  {s.expiry_date && ` · to ${format(parseISO(s.expiry_date), "dd MMM yy")}`}
                                </div>
                                {Array.isArray(s.authorised_for) && s.authorised_for.length > 0 && (
                                  <div className="text-xs text-muted-foreground">
                                    {getAuthorityLabels(s.authorised_for).join(", ")}
                                  </div>
                                )}
                                {s.status !== "active" && (
                                  <Badge variant="secondary" className="text-[10px]">
                                    {s.status}
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Signing rules by account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {visibleAccounts.length === 0 && <p className="text-sm text-muted-foreground">No accounts to show.</p>}
          {visibleAccounts.map((a) => {
            const accountRules = rules.filter((r) => r.bank_account_id === a.id);
            const accountGroups = groups.filter((g) => g.bank_account_id === a.id);
            return (
              <div key={a.id} className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="font-medium hover:underline"
                    onClick={() => navigate(`/bank-accounts/${a.id}`)}
                  >
                    {bankLabel(a)} · {maskAccountNumber(a.account_number)}
                  </button>
                  <span className="text-sm text-muted-foreground">{a.company?.name}</span>
                  {a.cif?.cif_number && (
                    <Badge variant="outline" className="text-xs">
                      CIF {a.cif.cif_number}
                    </Badge>
                  )}
                </div>
                {accountGroups.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {accountGroups.map((g) => (
                      <Badge key={g.id} variant="secondary" className="text-xs">
                        {g.group_label}
                        {" · "}
                        {
                          visibleSignatories.filter((s) => s.bank_account_id === a.id && s.group?.id === g.id).length
                        }{" "}
                        signatories
                      </Badge>
                    ))}
                  </div>
                )}
                {accountRules.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No signing rules recorded for this account.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rule</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Requirement</TableHead>
                        <TableHead>Per transaction</TableHead>
                        <TableHead>Daily</TableHead>
                        <TableHead>Applies to</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accountRules.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.rule_name}</TableCell>
                          <TableCell>{ruleTypeLabel(r.rule_type)}</TableCell>
                          <TableCell>{describeRule(r)}</TableCell>
                          <TableCell>{formatLimit(r.transaction_limit, r.limit_currency)}</TableCell>
                          <TableCell>{formatLimit(r.daily_limit, r.limit_currency)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {Array.isArray(r.applies_to) && r.applies_to.length > 0
                              ? getAuthorityLabels(r.applies_to).join(", ")
                              : "All transactions"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
