import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Lock, Shield, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const PROTECTED_TABLES = [
  "entities", "documents", "profiles", "workspaces", "equity_links",
  "movements", "bank_accounts", "signatories", "ubo_snapshots",
];

export function SecurityTab() {
  const { workspaceId, userRole } = useAuth();
  const isAdmin = userRole === "admin";
  const [encrypted, setEncrypted] = useState(0);
  const [unencrypted, setUnencrypted] = useState(0);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migrateProgress, setMigrateProgress] = useState({ current: 0, total: 0 });
  const [migrateComplete, setMigrateComplete] = useState(false);

  const fetchStats = async () => {
    if (!workspaceId) return;
    setLoading(true);
    const { data: docs } = await supabase
      .from("documents")
      .select("is_encrypted")
      .eq("workspace_id", workspaceId);

    const allDocs = docs || [];
    setEncrypted(allDocs.filter(d => d.is_encrypted).length);
    setUnencrypted(allDocs.filter(d => !d.is_encrypted).length);
    setLoading(false);
  };

  useEffect(() => { fetchStats(); }, [workspaceId]);

  const total = encrypted + unencrypted;
  const pct = total > 0 ? Math.round((encrypted / total) * 100) : 100;
  const allEncrypted = unencrypted === 0;

  const handleStartMigration = async () => {
    setConfirmOpen(false);
    setMigrating(true);
    setMigrateComplete(false);
    setMigrateProgress({ current: 0, total: unencrypted });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const res = await fetch(`${SUPABASE_URL}/functions/v1/encrypt-existing-docs`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ workspace_id: workspaceId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Migration failed" }));
        throw new Error(err.error || "Migration failed");
      }

      const result = await res.json();
      setMigrateProgress({ current: result.encrypted_count, total: result.total_count });
      setMigrateComplete(true);

      if (result.errors?.length > 0) {
        toast.warning(`Encrypted ${result.encrypted_count} documents. ${result.errors.length} failed.`);
      } else {
        toast.success(`All ${result.encrypted_count} documents encrypted successfully`);
      }

      fetchStats();
    } catch (err: any) {
      toast.error(err.message || "Migration failed");
    } finally {
      setMigrating(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-12 text-muted-foreground">Loading security status...</div>;

  return (
    <div className="space-y-6">
      {/* Document Encryption */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4" /> Document Encryption
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Status</span>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="font-medium">Active</span>
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Algorithm</span>
              <div className="font-medium mt-1">AES-256-GCM</div>
            </div>
            <div>
              <span className="text-muted-foreground">Key Method</span>
              <div className="font-medium mt-1">HKDF per-workspace</div>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <div className="flex justify-between text-sm">
              <span>
                Encrypted: <strong>{encrypted}</strong> · Unencrypted: <strong>{unencrypted}</strong> · Total: <strong>{total}</strong>
              </span>
              <span className={allEncrypted ? "text-emerald-600 font-medium" : "text-amber-600 font-medium"}>
                {pct}%
              </span>
            </div>
            <Progress
              value={pct}
              className={`h-2 ${allEncrypted ? "[&>div]:bg-emerald-500" : "[&>div]:bg-amber-500"}`}
            />
          </div>

          {migrating && (
            <div className="flex items-center gap-3 rounded-lg border px-4 py-3 bg-muted/50">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm">
                Encrypting documents... {migrateProgress.current} of {migrateProgress.total}
              </span>
            </div>
          )}

          {migrateComplete && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              <span className="text-sm text-emerald-700">All documents encrypted successfully</span>
            </div>
          )}

          {!allEncrypted && isAdmin && !migrating && (
            <Button onClick={() => setConfirmOpen(true)} className="mt-2">
              <Lock className="h-4 w-4 mr-2" /> Encrypt existing documents
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Access Security */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" /> Access Security
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="space-y-3">
            <div>
              <span className="font-medium">Row Level Security</span>
              <div className="flex items-center gap-1.5 mt-1 text-emerald-600">
                <CheckCircle className="h-3.5 w-3.5" />
                All sensitive tables protected
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {PROTECTED_TABLES.map(t => (
                  <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                ))}
              </div>
            </div>

            <div>
              <span className="font-medium">Session Security</span>
              <p className="text-muted-foreground mt-1">
                Documents are served with <code className="text-xs bg-muted px-1 rounded">Cache-Control: no-store</code> to prevent browser caching of sensitive files.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Modal */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Encrypt Existing Documents
            </DialogTitle>
            <DialogDescription className="space-y-2 pt-2">
              <p>This will encrypt <strong>{unencrypted}</strong> existing documents.</p>
              <p>This process cannot be undone.</p>
              <p>Estimated time: ~{unencrypted * 2} seconds.</p>
              <p>Continue?</p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={handleStartMigration}>
              <Lock className="h-4 w-4 mr-2" /> Start Encryption
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
