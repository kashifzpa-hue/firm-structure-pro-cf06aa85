import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Plus, ExternalLink, Landmark } from "lucide-react";
import { maskAccountNumber, formatLimit } from "@/lib/banking-utils";
import { BankAccountForm } from "@/components/banking/BankAccountForm";

interface Props {
  entityId: string;
}

export function BankingTab({ entityId }: Props) {
  const { workspaceId, userRole } = useAuth();
  const isAdmin = userRole === "admin";
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [signatories, setSignatories] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    if (!workspaceId || !entityId) return;
    const fetch = async () => {
      const [accRes, compRes] = await Promise.all([
        supabase.from("bank_accounts").select("*").eq("company_entity_id", entityId).eq("workspace_id", workspaceId).order("created_at"),
        supabase.from("entities").select("id, name").eq("workspace_id", workspaceId).eq("type", "company").eq("entity_status", "active").order("name"),
      ]);
      const accs = accRes.data || [];
      setCompanies(compRes.data || []);
      if (accs.length > 0) {
        const accIds = accs.map(a => a.id);
        const [sigRes, ruleRes, grpRes] = await Promise.all([
          supabase.from("signatories").select("*, person:entities!signatories_person_entity_id_fkey(name)").eq("workspace_id", workspaceId).in("bank_account_id", accIds).eq("status", "active"),
          supabase.from("signing_matrix_rules").select("*, group_a:signatory_groups!signing_matrix_rules_group_a_id_fkey(group_label), group_b:signatory_groups!signing_matrix_rules_group_b_id_fkey(group_label)").eq("workspace_id", workspaceId).in("bank_account_id", accIds),
          supabase.from("signatory_groups").select("*").eq("workspace_id", workspaceId).in("bank_account_id", accIds),
        ]);
        setSignatories(sigRes.data || []);
        setRules(ruleRes.data || []);
        setGroups(grpRes.data || []);
      }
      setAccounts(accs);
      setLoading(false);
    };
    fetch();
  }, [workspaceId, entityId]);

  if (loading) return <div className="py-8 text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Bank Accounts ({accounts.length})</h3>
        {isAdmin && <Button size="sm" onClick={() => setFormOpen(true)}><Plus className="h-3 w-3 mr-1" /> Add Bank Account</Button>}
      </div>

      {accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Landmark className="h-12 w-12 mb-4 opacity-30" />
          <p>No bank accounts linked to this company.</p>
        </div>
      ) : (
        accounts.map(acc => {
          const accSigs = signatories.filter(s => s.bank_account_id === acc.id);
          const accRules = rules.filter(r => r.bank_account_id === acc.id);
          const bankName = acc.bank_name === "Other" ? acc.bank_name_custom || "Other" : acc.bank_name;
          return (
            <Collapsible key={acc.id}>
              <CollapsibleTrigger className="w-full">
                <Card className="shadow-sm hover:border-primary/30 transition-colors">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Landmark className="h-5 w-5 text-primary" />
                      <span className="font-medium">{bankName}</span>
                      <span className="font-mono text-sm text-muted-foreground">{maskAccountNumber(acc.account_number)}</span>
                      <Badge variant="outline">{acc.currency}</Badge>
                      <Badge variant={acc.account_status === "active" ? "default" : "secondary"}
                        className={acc.account_status === "active" ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}>
                        {acc.account_status}
                      </Badge>
                    </div>
                    <ChevronDown className="h-4 w-4" />
                  </CardContent>
                </Card>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <Card className="mt-1 shadow-sm">
                  <CardContent className="p-4 space-y-3">
                    <div>
                      <h4 className="text-sm font-medium mb-1">Signatories ({accSigs.length} active)</h4>
                      {accSigs.map(s => (
                        <div key={s.id} className="text-sm flex items-center gap-2">
                          <span>{s.person?.name}</span>
                          <span className="text-muted-foreground">— {s.group?.group_label || "Ungrouped"}</span>
                          <span className="text-muted-foreground">— {formatLimit(s.individual_limit, s.individual_limit_currency)}</span>
                        </div>
                      ))}
                      {accSigs.length === 0 && <p className="text-sm text-muted-foreground">No active signatories</p>}
                    </div>
                    <div>
                      <h4 className="text-sm font-medium mb-1">Signing Matrix ({accRules.length} rules)</h4>
                      {accRules.map(r => (
                        <div key={r.id} className="text-sm text-muted-foreground">
                          {r.rule_name}: {r.rule_type === "solo" ? `Solo (${r.group_a?.group_label})` : r.rule_type === "joint_same_group" ? `Joint (${r.group_a?.group_label} × ${r.min_signatories_from_a})` : `Cross (${r.group_a?.group_label}+${r.group_b?.group_label})`} — {formatLimit(r.transaction_limit, r.limit_currency)}
                        </div>
                      ))}
                      {accRules.length === 0 && <p className="text-sm text-muted-foreground">No rules defined</p>}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => navigate(`/bank-accounts/${acc.id}`)}>
                      <ExternalLink className="h-3 w-3 mr-1" /> View Full Account
                    </Button>
                  </CardContent>
                </Card>
              </CollapsibleContent>
            </Collapsible>
          );
        })
      )}

      <BankAccountForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={() => { setFormOpen(false); window.location.reload(); }} companies={companies} />
    </div>
  );
}
