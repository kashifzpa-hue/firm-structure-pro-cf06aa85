import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { AUTHORITY_OPTIONS, RULE_TYPES, formatLimit, getAuthorityLabels, logBankingActivity } from "@/lib/banking-utils";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  bankAccountId: string;
  groups: any[];
  editData?: any;
}

export function MatrixRuleForm({ open, onClose, onSaved, bankAccountId, groups, editData }: Props) {
  const { workspaceId } = useAuth();
  const [saving, setSaving] = useState(false);
  const [ruleName, setRuleName] = useState(editData?.rule_name || "");
  const [ruleType, setRuleType] = useState(editData?.rule_type || "solo");
  const [groupAId, setGroupAId] = useState(editData?.group_a_id || "");
  const [minFromA, setMinFromA] = useState(editData?.min_signatories_from_a?.toString() || "1");
  const [groupBId, setGroupBId] = useState(editData?.group_b_id || "");
  const [minFromB, setMinFromB] = useState(editData?.min_signatories_from_b?.toString() || "1");
  const [transactionLimit, setTransactionLimit] = useState(editData?.transaction_limit?.toString() || "");
  const [dailyLimit, setDailyLimit] = useState(editData?.daily_limit?.toString() || "");
  const [limitCurrency, setLimitCurrency] = useState(editData?.limit_currency || "AED");
  const [appliesTo, setAppliesTo] = useState<string[]>(editData?.applies_to || []);
  const [notes, setNotes] = useState(editData?.notes || "");

  const toggleApplies = (value: string) => {
    if (value === "all") {
      setAppliesTo(appliesTo.includes("all") ? [] : ["all"]);
    } else {
      const without = appliesTo.filter(v => v !== "all" && v !== value);
      if (appliesTo.includes(value)) setAppliesTo(without);
      else setAppliesTo([...without, value]);
    }
  };

  // Live preview sentence
  const preview = useMemo(() => {
    const groupA = groups.find(g => g.id === groupAId);
    const groupB = groups.find(g => g.id === groupBId);
    const authLabels = getAuthorityLabels(appliesTo);
    const authStr = authLabels.length > 0 ? authLabels.join(", ") : "[select authorities]";
    const limitStr = transactionLimit ? formatLimit(parseFloat(transactionLimit), limitCurrency) : "Unlimited";

    if (ruleType === "solo") {
      return `This rule means: Any 1 person from [${groupA?.group_label || "select group"}] can authorize [${authStr}] up to [${limitStr}] per transaction.`;
    } else if (ruleType === "joint_same_group") {
      return `This rule means: Any ${minFromA} person(s) from [${groupA?.group_label || "select group"}] must authorize together for [${authStr}] up to [${limitStr}] per transaction.`;
    } else {
      return `This rule means: ${minFromA} from [${groupA?.group_label || "Group A"}] AND ${minFromB} from [${groupB?.group_label || "Group B"}] must authorize together for [${authStr}] up to [${limitStr}] per transaction.`;
    }
  }, [ruleType, groupAId, groupBId, minFromA, minFromB, transactionLimit, limitCurrency, appliesTo, groups]);

  const handleSave = async () => {
    if (!workspaceId || !ruleName) {
      toast.error("Rule name is required");
      return;
    }
    setSaving(true);

    const payload: any = {
      workspace_id: workspaceId,
      bank_account_id: bankAccountId,
      rule_name: ruleName,
      rule_type: ruleType,
      group_a_id: groupAId || null,
      min_signatories_from_a: parseInt(minFromA) || 1,
      group_b_id: ruleType === "joint_cross_group" ? (groupBId || null) : null,
      min_signatories_from_b: ruleType === "joint_cross_group" ? (parseInt(minFromB) || 1) : null,
      transaction_limit: transactionLimit ? parseFloat(transactionLimit) : null,
      daily_limit: dailyLimit ? parseFloat(dailyLimit) : null,
      limit_currency: limitCurrency,
      applies_to: appliesTo,
      notes: notes || null,
    };

    const { data: profile } = await supabase.from("profiles").select("id").eq("user_id", (await supabase.auth.getUser()).data.user?.id || "").single();

    if (editData) {
      const { error } = await supabase.from("signing_matrix_rules").update(payload).eq("id", editData.id);
      if (error) { toast.error(error.message); setSaving(false); return; }
      await logBankingActivity(bankAccountId, "matrix_rule_updated", `Matrix rule "${ruleName}" updated`, profile?.id || "", workspaceId);
      toast.success("Matrix rule updated");
    } else {
      const { error } = await supabase.from("signing_matrix_rules").insert(payload);
      if (error) { toast.error(error.message); setSaving(false); return; }
      await logBankingActivity(bankAccountId, "matrix_rule_added", `Matrix rule "${ruleName}" added`, profile?.id || "", workspaceId);
      toast.success("Matrix rule added");
    }
    setSaving(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editData ? "Edit Matrix Rule" : "Add Matrix Rule"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Rule Name *</Label><Input value={ruleName} onChange={e => setRuleName(e.target.value)} placeholder="e.g. Senior Solo Authority" /></div>

          <div><Label>Rule Type</Label>
            <div className="grid gap-2 mt-2">
              {RULE_TYPES.map(rt => (
                <Card key={rt.value} className={`cursor-pointer transition-colors ${ruleType === rt.value ? "border-primary bg-primary/5" : "hover:border-muted-foreground/30"}`} onClick={() => setRuleType(rt.value)}>
                  <CardContent className="p-3">
                    <div className="font-medium text-sm">{rt.label}</div>
                    <div className="text-xs text-muted-foreground">{rt.desc}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div><Label>Group A</Label>
            <Select value={groupAId} onValueChange={setGroupAId}>
              <SelectTrigger><SelectValue placeholder="Select group" /></SelectTrigger>
              <SelectContent>{groups.map(g => <SelectItem key={g.id} value={g.id}>{g.group_label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {ruleType !== "solo" && (
            <div><Label>Minimum from Group A</Label><Input type="number" min="1" value={minFromA} onChange={e => setMinFromA(e.target.value)} /></div>
          )}

          {ruleType === "joint_cross_group" && (
            <>
              <div><Label>Group B</Label>
                <Select value={groupBId} onValueChange={setGroupBId}>
                  <SelectTrigger><SelectValue placeholder="Select group" /></SelectTrigger>
                  <SelectContent>{groups.map(g => <SelectItem key={g.id} value={g.id}>{g.group_label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Minimum from Group B</Label><Input type="number" min="1" value={minFromB} onChange={e => setMinFromB(e.target.value)} /></div>
            </>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div><Label>Transaction Limit</Label><Input type="number" value={transactionLimit} onChange={e => setTransactionLimit(e.target.value)} placeholder="Unlimited" /></div>
            <div><Label>Daily Limit</Label><Input type="number" value={dailyLimit} onChange={e => setDailyLimit(e.target.value)} placeholder="Unlimited" /></div>
            <div><Label>Currency</Label><Input value={limitCurrency} onChange={e => setLimitCurrency(e.target.value)} /></div>
          </div>

          <div>
            <Label>Applies To</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {AUTHORITY_OPTIONS.map(opt => (
                <div key={opt.value} className="flex items-center gap-2">
                  <Checkbox checked={appliesTo.includes(opt.value) || appliesTo.includes("all")} onCheckedChange={() => toggleApplies(opt.value)} />
                  <span className="text-sm">{opt.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Live Preview */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-3">
              <p className="text-sm italic text-primary">{preview}</p>
            </CardContent>
          </Card>

          <div><Label>Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : editData ? "Update" : "Add Rule"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
