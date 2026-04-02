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
import { Landmark, Plus, Eye, EyeOff, Building2, Users, AlertTriangle, Search } from "lucide-react";
import { maskAccountNumber, maskIban, ACCOUNT_STATUSES } from "@/lib/banking-utils";
import { BankAccountForm } from "@/components/banking/BankAccountForm";
import { differenceInDays, parseISO } from "date-fns";

export default function BankAccounts() {
  const { workspaceId, userRole } = useAuth();
  const { bankingEnabled } = useBankingEnabled();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCompany, setFilterCompany] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const isAdmin = userRole === "admin";

  const fetchData = async () => {
    if (!workspaceId) return;
    const [accRes, compRes, sigRes] = await Promise.all([
      supabase.from("bank_accounts").select("*, company:entities!bank_accounts_company_entity_id_fkey(id, name)").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
      supabase.from("entities").select("id, name").eq("workspace_id", workspaceId).eq("type", "company").eq("entity_status", "active").order("name"),
      supabase.from("signatories").select("id, bank_account_id, status, expiry_date").eq("workspace_id", workspaceId),
    ]);
    setAccounts(accRes.data || []);
    setCompanies(compRes.data || []);
    setLoading(false);

    // Attach counts
    const sigData = sigRes.data || [];
    const withCounts = (accRes.data || []).map((acc: any) => {
      const sigs = sigData.filter((s: any) => s.bank_account_id === acc.id);
      return {
        ...acc,
        activeSignatories: sigs.filter((s: any) => s.status === "active").length,
      };
    });
    setAccounts(withCounts);
  };

  useEffect(() => { fetchData(); }, [workspaceId]);

  const toggleReveal = (id: string) => {
    setRevealedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Stats
  const totalAccounts = accounts.length;
  const activeAccounts = accounts.filter(a => a.account_status === "active").length;
  const companiesWithBanking = new Set(accounts.map(a => a.company_entity_id)).size;

  const filtered = accounts.filter(a => {
    if (filterCompany !== "all" && a.company_entity_id !== filterCompany) return false;
    if (filterStatus !== "all" && a.account_status !== filterStatus) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!(a.company?.name?.toLowerCase().includes(s) || a.bank_name?.toLowerCase().includes(s) || a.account_number?.includes(s))) return false;
    }
    return true;
  });

  if (!bankingEnabled) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Landmark className="h-16 w-16 mb-4 opacity-30" />
        <p className="text-lg font-medium">Banking Module</p>
        <p className="text-sm">This premium add-on is not enabled for your workspace.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Bank Accounts</h1>
        <Button onClick={() => setFormOpen(true)}><Plus className="mr-2 h-4 w-4" /> Add Bank Account</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="shadow-sm"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Accounts</CardTitle><Landmark className="h-5 w-5 text-primary" /></CardHeader><CardContent><div className="text-3xl font-bold">{totalAccounts}</div></CardContent></Card>
        <Card className="shadow-sm"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Active Accounts</CardTitle><Landmark className="h-5 w-5 text-green-600" /></CardHeader><CardContent><div className="text-3xl font-bold">{activeAccounts}</div></CardContent></Card>
        <Card className="shadow-sm"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Companies with Banking</CardTitle><Building2 className="h-5 w-5 text-primary" /></CardHeader><CardContent><div className="text-3xl font-bold">{companiesWithBanking}</div></CardContent></Card>
        <Card className="shadow-sm"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Active Signatories</CardTitle><Users className="h-5 w-5 text-primary" /></CardHeader><CardContent><div className="text-3xl font-bold">{accounts.reduce((s, a) => s + (a.activeSignatories || 0), 0)}</div></CardContent></Card>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search company, bank, account..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterCompany} onValueChange={setFilterCompany}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All Companies" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Companies</SelectItem>
            {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {ACCOUNT_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {loading ? <div className="py-12 text-center text-muted-foreground">Loading...</div> : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Landmark className="h-12 w-12 mb-4 opacity-30" />
              <p className="text-lg font-medium">No bank accounts found</p>
              <p className="text-sm">Add your first bank account to get started.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Bank Name</TableHead>
                  <TableHead>Account Number</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead>IBAN</TableHead>
                  <TableHead>Signatories</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(acc => {
                  const revealed = revealedIds.has(acc.id);
                  return (
                    <TableRow key={acc.id} className="cursor-pointer" onClick={() => navigate(`/bank-accounts/${acc.id}`)}>
                      <TableCell className="font-medium">{acc.company?.name || "—"}</TableCell>
                      <TableCell>{acc.bank_name === "Other" ? acc.bank_name_custom || "Other" : acc.bank_name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-sm">{revealed ? acc.account_number : maskAccountNumber(acc.account_number)}</span>
                          {isAdmin && (
                            <button onClick={e => { e.stopPropagation(); toggleReveal(acc.id); }} className="text-muted-foreground hover:text-foreground">
                              {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline">{acc.account_type?.replace(/_/g, " ")}</Badge></TableCell>
                      <TableCell>{acc.currency}</TableCell>
                      <TableCell>
                        <span className="font-mono text-sm">{revealed ? (acc.iban || "—") : maskIban(acc.iban)}</span>
                      </TableCell>
                      <TableCell>{acc.activeSignatories || 0}</TableCell>
                      <TableCell>
                        <Badge variant={acc.account_status === "active" ? "default" : acc.account_status === "dormant" ? "secondary" : "outline"}
                          className={acc.account_status === "active" ? "bg-green-100 text-green-800 hover:bg-green-100" : acc.account_status === "closed" ? "bg-red-100 text-red-800" : ""}>
                          {acc.account_status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <BankAccountForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={() => { setFormOpen(false); fetchData(); }} companies={companies} />
    </div>
  );
}
