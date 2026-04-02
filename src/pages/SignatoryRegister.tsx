import { useEffect, useState } from "react";
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
import { PenLine, Users, AlertTriangle, Clock, Search } from "lucide-react";
import { maskAccountNumber, formatLimit, getAuthorityLabels } from "@/lib/banking-utils";
import { format, parseISO, differenceInDays } from "date-fns";

export default function SignatoryRegister() {
  const { workspaceId } = useAuth();
  const { bankingEnabled } = useBankingEnabled();
  const navigate = useNavigate();
  const [signatories, setSignatories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterExpiry, setFilterExpiry] = useState("all");

  useEffect(() => {
    if (!workspaceId) return;
    const fetch = async () => {
      const { data } = await supabase.from("signatories")
        .select("*, person:entities!signatories_person_entity_id_fkey(id, name), bank_account:bank_accounts!signatories_bank_account_id_fkey(id, bank_name, bank_name_custom, account_number, company:entities!bank_accounts_company_entity_id_fkey(id, name)), group:signatory_groups!signatories_signatory_group_id_fkey(group_label)")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });
      setSignatories(data || []);
      setLoading(false);
    };
    fetch();
  }, [workspaceId]);

  const today = new Date();
  const totalActive = signatories.filter(s => s.status === "active").length;
  const expiring30 = signatories.filter(s => s.status === "active" && s.expiry_date && differenceInDays(parseISO(s.expiry_date), today) <= 30 && differenceInDays(parseISO(s.expiry_date), today) >= 0).length;
  const expired = signatories.filter(s => s.status === "active" && s.expiry_date && differenceInDays(parseISO(s.expiry_date), today) < 0).length;
  const pendingAck = signatories.filter(s => s.status === "active" && !s.bank_acknowledged_date).length;

  const filtered = signatories.filter(s => {
    if (filterStatus !== "all" && s.status !== filterStatus) return false;
    if (filterExpiry === "30" && (!s.expiry_date || differenceInDays(parseISO(s.expiry_date), today) > 30)) return false;
    if (filterExpiry === "60" && (!s.expiry_date || differenceInDays(parseISO(s.expiry_date), today) > 60)) return false;
    if (filterExpiry === "90" && (!s.expiry_date || differenceInDays(parseISO(s.expiry_date), today) > 90)) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!(s.person?.name?.toLowerCase().includes(q) || s.bank_account?.company?.name?.toLowerCase().includes(q) || s.bank_account?.bank_name?.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  const exportCSV = () => {
    const headers = ["Person", "Company", "Bank", "Account", "Group", "Designation", "Limit", "Effective", "Expiry", "Bank Acknowledged", "Status"];
    const rows = filtered.map(s => [
      s.person?.name, s.bank_account?.company?.name, s.bank_account?.bank_name,
      maskAccountNumber(s.bank_account?.account_number), s.group?.group_label || "—",
      s.designation, formatLimit(s.individual_limit, s.individual_limit_currency),
      s.effective_date, s.expiry_date || "—", s.bank_acknowledged_date || "Pending", s.status,
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "signatory_register.csv"; a.click();
  };

  if (!bankingEnabled) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <PenLine className="h-16 w-16 mb-4 opacity-30" />
        <p className="text-lg font-medium">Signatory Register</p>
        <p className="text-sm">This premium add-on is not enabled for your workspace.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Signatory Register</h1>
        <Button variant="outline" onClick={exportCSV}>Export CSV</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="shadow-sm"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Active Signatories</CardTitle><Users className="h-5 w-5 text-primary" /></CardHeader><CardContent><div className="text-3xl font-bold">{totalActive}</div></CardContent></Card>
        <Card className="shadow-sm"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Expiring in 30 Days</CardTitle><AlertTriangle className="h-5 w-5 text-amber-500" /></CardHeader><CardContent><div className="text-3xl font-bold">{expiring30}</div></CardContent></Card>
        <Card className="shadow-sm"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Expired Authority</CardTitle><AlertTriangle className="h-5 w-5 text-destructive" /></CardHeader><CardContent><div className="text-3xl font-bold">{expired}</div></CardContent></Card>
        <Card className="shadow-sm"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Awaiting Bank Ack</CardTitle><Clock className="h-5 w-5 text-muted-foreground" /></CardHeader><CardContent><div className="text-3xl font-bold">{pendingAck}</div></CardContent></Card>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search person, company, bank..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="revoked">Revoked</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterExpiry} onValueChange={setFilterExpiry}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All Expiry" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="30">Expiring within 30 days</SelectItem>
            <SelectItem value="60">Expiring within 60 days</SelectItem>
            <SelectItem value="90">Expiring within 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {loading ? <div className="py-12 text-center text-muted-foreground">Loading...</div> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Person</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Bank</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Group</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Limit</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Bank Ack</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(s => {
                  const expiryDiff = s.expiry_date ? differenceInDays(parseISO(s.expiry_date), today) : null;
                  return (
                    <TableRow key={s.id} className="cursor-pointer" onClick={() => navigate(`/bank-accounts/${s.bank_account_id}`)}>
                      <TableCell className="font-medium">{s.person?.name || "—"}</TableCell>
                      <TableCell>{s.bank_account?.company?.name || "—"}</TableCell>
                      <TableCell>{s.bank_account?.bank_name === "Other" ? s.bank_account?.bank_name_custom : s.bank_account?.bank_name}</TableCell>
                      <TableCell className="font-mono text-sm">{maskAccountNumber(s.bank_account?.account_number)}</TableCell>
                      <TableCell>{s.group?.group_label || "—"}</TableCell>
                      <TableCell>{s.designation}</TableCell>
                      <TableCell>{formatLimit(s.individual_limit, s.individual_limit_currency)}</TableCell>
                      <TableCell>
                        {s.expiry_date ? (
                          <span className={expiryDiff !== null && expiryDiff < 0 ? "text-destructive font-medium" : expiryDiff !== null && expiryDiff <= 30 ? "text-amber-600" : ""}>
                            {format(parseISO(s.expiry_date), "dd MMM yy")}
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell>{s.bank_acknowledged_date ? "✓" : "⏳"}</TableCell>
                      <TableCell>
                        <Badge variant={s.status === "active" ? "default" : "secondary"}
                          className={s.status === "active" ? "bg-green-100 text-green-800 hover:bg-green-100" : s.status === "revoked" ? "bg-red-100 text-red-800" : ""}>
                          {s.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">No signatories found</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
