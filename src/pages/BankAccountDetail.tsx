import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Edit, Trash2, Eye, EyeOff, Users, AlertTriangle, Download, Loader2, Lock } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { maskAccountNumber, maskIban, formatLimit, getAuthorityLabels, logBankingActivity, BANK_DOC_TYPES } from "@/lib/banking-utils";
import { BankAccountForm } from "@/components/banking/BankAccountForm";
import { SignatoryForm } from "@/components/banking/SignatoryForm";
import { SignatoryCard } from "@/components/banking/SignatoryCard";
import { MatrixRuleForm } from "@/components/banking/MatrixRuleForm";
import { encryptedUpload, encryptedDownload } from "@/lib/encryption";

export default function BankAccountDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { workspaceId, userRole } = useAuth();
  const isAdmin = userRole === "admin";
  const [account, setAccount] = useState<any>(null);
  const [signatories, setSignatories] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [activityLog, setActivityLog] = useState<any[]>([]);
  const [persons, setPersons] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [sigFormOpen, setSigFormOpen] = useState(false);
  const [editSig, setEditSig] = useState<any>(null);
  const [ruleFormOpen, setRuleFormOpen] = useState(false);
  const [editRule, setEditRule] = useState<any>(null);
  const [groupFormOpen, setGroupFormOpen] = useState(false);
  const [newGroupLabel, setNewGroupLabel] = useState("");
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [revokeSig, setRevokeSig] = useState<any>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [showRevoked, setShowRevoked] = useState(false);
  const [docUploadOpen, setDocUploadOpen] = useState(false);
  const [docType, setDocType] = useState("");
  const [docDesc, setDocDesc] = useState("");
  const [docNotes, setDocNotes] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docUploading, setDocUploading] = useState(false);
  const [docUploadStep, setDocUploadStep] = useState<"" | "uploading" | "encrypting" | "done">("");
  const [downloading, setDownloading] = useState<string | null>(null);

  const fetchAll = async () => {
    if (!id || !workspaceId) return;
    const [accRes, sigRes, grpRes, ruleRes, docRes, logRes, persRes, compRes] = await Promise.all([
      supabase.from("bank_accounts").select("*, company:entities!bank_accounts_company_entity_id_fkey(id, name)").eq("id", id).single(),
      supabase.from("signatories").select("*, person:entities!signatories_person_entity_id_fkey(id, name, entity_status)").eq("bank_account_id", id).order("created_at"),
      supabase.from("signatory_groups").select("*").eq("bank_account_id", id).order("display_order"),
      supabase.from("signing_matrix_rules").select("*, group_a:signatory_groups!signing_matrix_rules_group_a_id_fkey(group_label), group_b:signatory_groups!signing_matrix_rules_group_b_id_fkey(group_label)").eq("bank_account_id", id).order("display_order"),
      supabase.from("bank_account_documents").select("*").eq("bank_account_id", id).order("uploaded_at", { ascending: false }),
      supabase.from("banking_activity_log").select("*, profile:profiles!banking_activity_log_done_by_fkey(full_name)").eq("bank_account_id", id).order("created_at", { ascending: false }),
      supabase.from("entities").select("id, name, type, entity_status").eq("workspace_id", workspaceId).eq("type", "person").order("name"),
      supabase.from("entities").select("id, name").eq("workspace_id", workspaceId).eq("type", "company").eq("entity_status", "active").order("name"),
    ]);
    setAccount(accRes.data);
    setSignatories((sigRes.data || []).map((s: any) => ({ ...s, person_name: s.person?.name, person_status: s.person?.entity_status })));
    setGroups(grpRes.data || []);
    setRules(ruleRes.data || []);
    setDocs(docRes.data || []);
    setActivityLog(logRes.data || []);
    setPersons(persRes.data || []);
    setCompanies(compRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [id, workspaceId]);

  const handleRevoke = async () => {
    if (!revokeSig || !revokeReason) return;
    await supabase.from("signatories").update({ status: "revoked", revocation_date: new Date().toISOString().split("T")[0], revocation_reason: revokeReason } as any).eq("id", revokeSig.id);
    const { data: profile } = await supabase.from("profiles").select("id").eq("user_id", (await supabase.auth.getUser()).data.user?.id || "").single();
    await logBankingActivity(id!, "signatory_revoked", `Signatory ${revokeSig.person_name} revoked: ${revokeReason}`, profile?.id || "", workspaceId!);
    toast.success("Signatory revoked");
    setRevokeOpen(false);
    setRevokeSig(null);
    setRevokeReason("");
    fetchAll();
  };

  const handleAddGroup = async () => {
    if (!newGroupLabel || !workspaceId) return;
    const { data: profile } = await supabase.from("profiles").select("id").eq("user_id", (await supabase.auth.getUser()).data.user?.id || "").single();
    await supabase.from("signatory_groups").insert({ workspace_id: workspaceId, bank_account_id: id, group_label: newGroupLabel, display_order: groups.length } as any);
    await logBankingActivity(id!, "group_created", `Group "${newGroupLabel}" created`, profile?.id || "", workspaceId);
    toast.success("Group created");
    setGroupFormOpen(false);
    setNewGroupLabel("");
    fetchAll();
  };

  const handleDeleteRule = async (rule: any) => {
    await supabase.from("signing_matrix_rules").delete().eq("id", rule.id);
    const { data: profile } = await supabase.from("profiles").select("id").eq("user_id", (await supabase.auth.getUser()).data.user?.id || "").single();
    await logBankingActivity(id!, "matrix_rule_deleted", `Matrix rule "${rule.rule_name}" deleted`, profile?.id || "", workspaceId!);
    toast.success("Rule deleted");
    fetchAll();
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;
  if (!account) return <div className="flex items-center justify-center h-64 text-muted-foreground">Account not found</div>;

  const bankDisplayName = account.bank_name === "Other" ? account.bank_name_custom || "Other" : account.bank_name;
  const activeSigs = signatories.filter(s => s.status === "active");
  const filteredSigs = showRevoked ? signatories : signatories.filter(s => s.status !== "revoked");

  // Group signatories by group
  const sigsByGroup: Record<string, any[]> = {};
  const ungrouped: any[] = [];
  filteredSigs.forEach(s => {
    if (s.signatory_group_id) {
      if (!sigsByGroup[s.signatory_group_id]) sigsByGroup[s.signatory_group_id] = [];
      sigsByGroup[s.signatory_group_id].push(s);
    } else {
      ungrouped.push(s);
    }
  });

  // Check groups referenced in rules but with no signatories
  const emptyGroupWarnings = groups.filter(g => {
    const hasActiveSig = activeSigs.some(s => s.signatory_group_id === g.id);
    const referencedInRule = rules.some(r => r.group_a_id === g.id || r.group_b_id === g.id);
    return referencedInRule && !hasActiveSig;
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/bank-accounts")}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{bankDisplayName}</h1>
          <p className="text-sm text-muted-foreground">{account.company?.name} — {isAdmin && revealed ? account.account_number : maskAccountNumber(account.account_number)}</p>
        </div>
        {isAdmin && (
          <Button variant="ghost" size="sm" onClick={() => setRevealed(!revealed)}>
            {revealed ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
            {revealed ? "Hide" : "Reveal"}
          </Button>
        )}
        <Badge variant={account.account_status === "active" ? "default" : "secondary"}
          className={account.account_status === "active" ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}>
          {account.account_status}
        </Badge>
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Account Details</TabsTrigger>
          <TabsTrigger value="signatories">Signatories ({activeSigs.length})</TabsTrigger>
          <TabsTrigger value="matrix">Signing Matrix ({rules.length})</TabsTrigger>
          <TabsTrigger value="documents">Documents ({docs.length})</TabsTrigger>
          <TabsTrigger value="activity">Activity Log</TabsTrigger>
        </TabsList>

        {/* Tab 1: Account Details */}
        <TabsContent value="details">
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Account Information</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}><Edit className="h-3 w-3 mr-1" /> Edit</Button>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-4">
                <div><dt className="text-sm text-muted-foreground">Bank Name</dt><dd className="font-medium">{bankDisplayName}</dd></div>
                <div><dt className="text-sm text-muted-foreground">Account Number</dt><dd className="font-medium font-mono">{isAdmin && revealed ? account.account_number : maskAccountNumber(account.account_number)}</dd></div>
                <div><dt className="text-sm text-muted-foreground">Account Type</dt><dd className="font-medium">{account.account_type?.replace(/_/g, " ")}</dd></div>
                <div><dt className="text-sm text-muted-foreground">Currency</dt><dd className="font-medium">{account.currency}</dd></div>
                <div><dt className="text-sm text-muted-foreground">IBAN</dt><dd className="font-medium font-mono">{isAdmin && revealed ? (account.iban || "—") : maskIban(account.iban)}</dd></div>
                <div><dt className="text-sm text-muted-foreground">SWIFT/BIC</dt><dd className="font-medium">{account.swift_code || "—"}</dd></div>
                <div><dt className="text-sm text-muted-foreground">Branch</dt><dd className="font-medium">{account.branch_name || "—"}{account.branch_code ? ` (${account.branch_code})` : ""}</dd></div>
                <div><dt className="text-sm text-muted-foreground">Opening Date</dt><dd className="font-medium">{account.opening_date ? format(parseISO(account.opening_date), "dd MMM yyyy") : "—"}</dd></div>
              </dl>
              {account.relationship_manager && (
                <Card className="mt-6">
                  <CardContent className="p-4">
                    <h4 className="font-medium text-sm mb-2">Relationship Manager</h4>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div><span className="text-muted-foreground">Name:</span> {account.relationship_manager}</div>
                      <div><span className="text-muted-foreground">Email:</span> {account.rm_email || "—"}</div>
                      <div><span className="text-muted-foreground">Phone:</span> {account.rm_phone || "—"}</div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Signatories */}
        <TabsContent value="signatories">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{activeSigs.length} Active Signatories across {groups.length} Groups</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setGroupFormOpen(true)}>Manage Groups</Button>
                <Button variant="outline" size="sm" onClick={() => setShowRevoked(!showRevoked)}>{showRevoked ? "Hide Revoked" : "Show Revoked"}</Button>
                <Button size="sm" onClick={() => { setEditSig(null); setSigFormOpen(true); }}><Plus className="h-3 w-3 mr-1" /> Add Signatory</Button>
              </div>
            </div>

            {groups.map(group => (
              <div key={group.id}>
                <h3 className="font-semibold text-sm mb-2 text-primary">{group.group_label} {group.description && <span className="text-muted-foreground font-normal">— {group.description}</span>}</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  {(sigsByGroup[group.id] || []).map(s => (
                    <SignatoryCard key={s.id} signatory={s} groupLabel={group.group_label} onEdit={() => { setEditSig(s); setSigFormOpen(true); }} onRevoke={() => { setRevokeSig(s); setRevokeOpen(true); }} />
                  ))}
                  {!(sigsByGroup[group.id] || []).length && <p className="text-sm text-muted-foreground col-span-2">No signatories in this group</p>}
                </div>
              </div>
            ))}

            {ungrouped.length > 0 && (
              <div>
                <h3 className="font-semibold text-sm mb-2">Ungrouped</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  {ungrouped.map(s => (
                    <SignatoryCard key={s.id} signatory={s} onEdit={() => { setEditSig(s); setSigFormOpen(true); }} onRevoke={() => { setRevokeSig(s); setRevokeOpen(true); }} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab 3: Signing Matrix */}
        <TabsContent value="matrix">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Signing Matrix — {bankDisplayName} — {account.company?.name}</h3>
                <p className="text-sm text-muted-foreground">Defines valid signatory combinations and their transaction authorities</p>
              </div>
              <Button size="sm" onClick={() => { setEditRule(null); setRuleFormOpen(true); }}><Plus className="h-3 w-3 mr-1" /> Add Rule</Button>
            </div>

            {emptyGroupWarnings.map(g => (
              <div key={g.id} className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span className="text-sm text-amber-700">Group "{g.group_label}" is referenced in matrix rules but has no active signatories.</span>
              </div>
            ))}

            <Card className="shadow-sm">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rule</TableHead>
                      <TableHead>Signatories Required</TableHead>
                      <TableHead>Transaction Limit</TableHead>
                      <TableHead>Daily Limit</TableHead>
                      <TableHead>Applies To</TableHead>
                      <TableHead className="w-20">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.map(rule => (
                      <TableRow key={rule.id}>
                        <TableCell className="font-medium">{rule.rule_name}</TableCell>
                        <TableCell>
                          {rule.rule_type === "solo" && `Any 1 from ${rule.group_a?.group_label || "—"}`}
                          {rule.rule_type === "joint_same_group" && `Any ${rule.min_signatories_from_a} from ${rule.group_a?.group_label || "—"}`}
                          {rule.rule_type === "joint_cross_group" && `${rule.min_signatories_from_a} from ${rule.group_a?.group_label || "A"} + ${rule.min_signatories_from_b || 1} from ${rule.group_b?.group_label || "B"}`}
                        </TableCell>
                        <TableCell>{formatLimit(rule.transaction_limit, rule.limit_currency)}</TableCell>
                        <TableCell>{formatLimit(rule.daily_limit, rule.limit_currency)}</TableCell>
                        <TableCell>{getAuthorityLabels(rule.applies_to || []).join(", ") || "—"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditRule(rule); setRuleFormOpen(true); }}><Edit className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteRule(rule)}><Trash2 className="h-3 w-3" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {rules.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No signing matrix rules defined</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 4: Documents */}
        <TabsContent value="documents">
          <Card className="shadow-sm">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Upload Date</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {docs.map(d => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.document_type}</TableCell>
                      <TableCell>{d.description || "—"}</TableCell>
                      <TableCell>{format(parseISO(d.uploaded_at), "dd MMM yyyy")}</TableCell>
                      <TableCell>{d.notes || "—"}</TableCell>
                    </TableRow>
                  ))}
                  {docs.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No documents uploaded</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 5: Activity Log */}
        <TabsContent value="activity">
          <Card className="shadow-sm">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Done By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activityLog.map(a => (
                    <TableRow key={a.id}>
                      <TableCell>{format(parseISO(a.created_at), "dd MMM yyyy HH:mm")}</TableCell>
                      <TableCell><Badge variant="outline">{a.action_type?.replace(/_/g, " ")}</Badge></TableCell>
                      <TableCell>{a.details}</TableCell>
                      <TableCell>{a.profile?.full_name || "System"}</TableCell>
                    </TableRow>
                  ))}
                  {activityLog.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No activity recorded</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <BankAccountForm open={editOpen} onClose={() => setEditOpen(false)} onSaved={() => { setEditOpen(false); fetchAll(); }} companies={companies} editData={account} />
      <SignatoryForm open={sigFormOpen} onClose={() => { setSigFormOpen(false); setEditSig(null); }} onSaved={() => { setSigFormOpen(false); setEditSig(null); fetchAll(); }} bankAccountId={id!} groups={groups} persons={persons} editData={editSig} />
      <MatrixRuleForm open={ruleFormOpen} onClose={() => { setRuleFormOpen(false); setEditRule(null); }} onSaved={() => { setRuleFormOpen(false); setEditRule(null); fetchAll(); }} bankAccountId={id!} groups={groups} editData={editRule} />

      {/* Group Form */}
      <Dialog open={groupFormOpen} onOpenChange={v => !v && setGroupFormOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Signatory Group</DialogTitle></DialogHeader>
          <div><Label>Group Label</Label><Input value={newGroupLabel} onChange={e => setNewGroupLabel(e.target.value)} placeholder="e.g. Group A — Senior Signatories" /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupFormOpen(false)}>Cancel</Button>
            <Button onClick={handleAddGroup} disabled={!newGroupLabel}>Create Group</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Modal */}
      <Dialog open={revokeOpen} onOpenChange={v => !v && setRevokeOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Revoke Signatory</DialogTitle></DialogHeader>
          <p className="text-sm">Are you sure you want to revoke <strong>{revokeSig?.person_name}</strong>'s signatory authority?</p>
          <div><Label>Revocation Reason *</Label><Textarea value={revokeReason} onChange={e => setRevokeReason(e.target.value)} /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRevoke} disabled={!revokeReason}>Revoke</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
