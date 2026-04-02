import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const ruleDescriptions: Record<string, string> = {
  DOCUMENT_EXPIRING_SOON: "Alert when a document expires within the threshold",
  DOCUMENT_EXPIRED: "Alert immediately when any document expires",
  MOVEMENT_DRAFT_PENDING: "Alert when a draft movement has not been confirmed",
  UBO_THRESHOLD_BREACH: "Alert when a UBO above 25% has an expired or expiring document",
  SYSTEM_ALERT: "Receive a weekly summary of all compliance items",
};

const ruleLabels: Record<string, string> = {
  DOCUMENT_EXPIRING_SOON: "Document Expiry Warning",
  DOCUMENT_EXPIRED: "Expired Documents",
  MOVEMENT_DRAFT_PENDING: "Draft Movement Reminder",
  UBO_THRESHOLD_BREACH: "UBO Document Alert",
  SYSTEM_ALERT: "Weekly Digest Email",
};

export function AlertRulesTab() {
  const { workspaceId, userRole } = useAuth();
  const [rules, setRules] = useState<any[]>([]);
  const [senderEmail, setSenderEmail] = useState("noreply@corpsync.app");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const isAdmin = userRole === "admin";

  const fetchRules = async () => {
    if (!workspaceId) return;
    const { data } = await supabase
      .from("alert_rules")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true });
    setRules(data || []);
    if (data && data.length > 0 && data[0].sender_email) {
      setSenderEmail(data[0].sender_email);
    }
    setLoading(false);
  };

  useEffect(() => { fetchRules(); }, [workspaceId]);

  const updateRule = (id: string, field: string, value: any) => {
    setRules(rules.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const saveAll = async () => {
    setSaving(true);
    for (const rule of rules) {
      await supabase.from("alert_rules").update({
        is_active: rule.is_active,
        threshold_days: rule.threshold_days,
        notify_in_app: rule.notify_in_app,
        notify_email: rule.notify_email,
        additional_emails: rule.additional_emails,
        sender_email: senderEmail,
      } as any).eq("id", rule.id);
    }
    setSaving(false);
    toast.success("Alert rules saved");
  };

  const resetDefaults = async () => {
    if (!workspaceId) return;
    await supabase.from("alert_rules").delete().eq("workspace_id", workspaceId);
    // Re-insert defaults
    await supabase.from("alert_rules").insert([
      { workspace_id: workspaceId, rule_type: "DOCUMENT_EXPIRING_SOON", threshold_days: 60, notify_in_app: true, notify_email: false },
      { workspace_id: workspaceId, rule_type: "DOCUMENT_EXPIRING_SOON", threshold_days: 30, notify_in_app: true, notify_email: true },
      { workspace_id: workspaceId, rule_type: "DOCUMENT_EXPIRED", notify_in_app: true, notify_email: true },
      { workspace_id: workspaceId, rule_type: "MOVEMENT_DRAFT_PENDING", threshold_days: 7, notify_in_app: true, notify_email: true },
      { workspace_id: workspaceId, rule_type: "UBO_THRESHOLD_BREACH", notify_in_app: true, notify_email: true },
      { workspace_id: workspaceId, rule_type: "SYSTEM_ALERT", notify_in_app: true, notify_email: true },
    ] as any);
    toast.success("Alert rules reset to defaults");
    fetchRules();
  };

  if (loading) return <div className="py-8 text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Alert Rules</h3>
          <p className="text-sm text-muted-foreground">Configure which alerts are active and how they are delivered.</p>
        </div>
        {isAdmin && (
          <button onClick={resetDefaults} className="text-xs text-muted-foreground hover:underline">
            Reset to Defaults
          </button>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Rule</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="w-[100px]">Threshold</TableHead>
            <TableHead className="w-[80px]">In-App</TableHead>
            <TableHead className="w-[80px]">Email</TableHead>
            <TableHead className="w-[200px]">Additional Emails</TableHead>
            <TableHead className="w-[80px]">Active</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rules.map((rule) => {
            const label = ruleLabels[rule.rule_type] || rule.rule_type;
            const desc = ruleDescriptions[rule.rule_type] || "";
            const showThreshold = ["DOCUMENT_EXPIRING_SOON", "MOVEMENT_DRAFT_PENDING"].includes(rule.rule_type);
            return (
              <TableRow key={rule.id}>
                <TableCell className="font-medium text-sm">
                  {label}
                  {rule.rule_type === "DOCUMENT_EXPIRING_SOON" && rule.threshold_days ? ` — ${rule.threshold_days} Day` : ""}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{desc}</TableCell>
                <TableCell>
                  {showThreshold ? (
                    <Input
                      type="number"
                      className="w-20 h-8"
                      value={rule.threshold_days || ""}
                      onChange={(e) => updateRule(rule.id, "threshold_days", parseInt(e.target.value) || null)}
                      disabled={!isAdmin}
                    />
                  ) : "—"}
                </TableCell>
                <TableCell>
                  {rule.rule_type !== "SYSTEM_ALERT" ? (
                    <Switch
                      checked={rule.notify_in_app}
                      onCheckedChange={(v) => updateRule(rule.id, "notify_in_app", v)}
                      disabled={!isAdmin}
                    />
                  ) : "—"}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={rule.notify_email}
                    onCheckedChange={(v) => updateRule(rule.id, "notify_email", v)}
                    disabled={!isAdmin}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    className="h-8 text-xs"
                    placeholder="email1@firm.com, email2@firm.com"
                    value={(rule.additional_emails || []).join(", ")}
                    onChange={(e) => updateRule(rule.id, "additional_emails", e.target.value ? e.target.value.split(",").map((s: string) => s.trim()) : [])}
                    disabled={!isAdmin}
                  />
                </TableCell>
                <TableCell>
                  <Switch
                    checked={rule.is_active}
                    onCheckedChange={(v) => updateRule(rule.id, "is_active", v)}
                    disabled={!isAdmin}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {isAdmin && (
        <div className="flex items-center gap-4 pt-4 border-t">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Send emails from:</span>
            <Input
              className="w-64 h-8"
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
            />
          </div>
          <div className="flex-1" />
          <Button onClick={saveAll} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      )}
    </div>
  );
}
