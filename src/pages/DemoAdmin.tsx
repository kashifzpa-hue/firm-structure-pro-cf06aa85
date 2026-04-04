import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";
import { encryptedUpload } from "@/lib/encryption";
import { Save, Upload, RefreshCw, CheckCircle2, AlertTriangle, FileText, User, Shield, Landmark, ScrollText } from "lucide-react";

interface HealthCheck {
  realDocs: number;
  placeholderDocs: number;
  personsWithPhotos: number;
  personsWithoutPhotos: number;
  lastUboCalc: string | null;
  bankAccountsWithSignatories: number;
  confirmedMovements: number;
}

export default function DemoAdmin() {
  const { workspaceId } = useAuth();
  const [workspaceName, setWorkspaceName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [placeholderDocs, setPlaceholderDocs] = useState<any[]>([]);
  const [personsWithoutPhotos, setPersonsWithoutPhotos] = useState<any[]>([]);
  const [recalculating, setRecalculating] = useState(false);
  const [health, setHealth] = useState<HealthCheck | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);

  useEffect(() => {
    if (workspaceId) {
      loadAll();
    }
  }, [workspaceId]);

  const loadAll = async () => {
    await Promise.all([loadWorkspaceName(), loadPlaceholderDocs(), loadPersonsWithoutPhotos(), runHealthCheck()]);
  };

  const loadWorkspaceName = async () => {
    const { data } = await supabase.from("workspaces").select("name").eq("id", workspaceId!).single();
    if (data) setWorkspaceName(data.name);
  };

  const saveWorkspaceName = async () => {
    setSavingName(true);
    const { error } = await supabase.from("workspaces").update({ name: workspaceName }).eq("id", workspaceId!);
    setSavingName(false);
    if (error) toast.error(error.message);
    else toast.success("Workspace name updated");
  };

  const loadPlaceholderDocs = async () => {
    const { data } = await supabase
      .from("documents")
      .select("id, document_type, file_url, entity_id, entities!documents_entity_id_fkey(name)")
      .eq("workspace_id", workspaceId!)
      .or("file_url.is.null,file_url.ilike.%placeholder%");
    setPlaceholderDocs(data || []);
  };

  const loadPersonsWithoutPhotos = async () => {
    const { data } = await supabase
      .from("entities")
      .select("id, name")
      .eq("workspace_id", workspaceId!)
      .eq("type", "person")
      .is("profile_photo_url", null);
    setPersonsWithoutPhotos(data || []);
  };

  const handleDocUpload = async (docId: string, entityId: string, file: File) => {
    try {
      const result = await encryptedUpload({ file, storagePath: `${workspaceId}/${entityId}/${Date.now()}_${file.name}` });
      const { error } = await supabase
        .from("documents")
        .update({ file_url: result.file_url, iv: result.iv, is_encrypted: result.is_encrypted })
        .eq("id", docId);
      if (error) throw error;
      toast.success("Document uploaded");
      loadPlaceholderDocs();
      runHealthCheck();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handlePhotoUpload = async (entityId: string, file: File) => {
    try {
      const path = `${workspaceId}/${entityId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("profile-photos").upload(path, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("profile-photos").getPublicUrl(path);
      const { error } = await supabase
        .from("entities")
        .update({ profile_photo_url: publicUrl })
        .eq("id", entityId);
      if (error) throw error;
      toast.success("Photo uploaded");
      loadPersonsWithoutPhotos();
      runHealthCheck();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const recalculateUBO = async () => {
    setRecalculating(true);
    try {
      const { data: companies } = await supabase
        .from("entities")
        .select("id, name")
        .eq("workspace_id", workspaceId!)
        .eq("type", "company");

      let success = 0;
      for (const company of companies || []) {
        const { error } = await supabase.rpc("calculate_ubo", { p_company_entity_id: company.id });
        if (error) {
          console.error(`UBO calc failed for ${company.name}:`, error.message);
        } else {
          success++;
        }
      }
      toast.success(`UBO recalculated for ${success}/${companies?.length || 0} companies`);
      runHealthCheck();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setRecalculating(false);
    }
  };

  const runHealthCheck = async () => {
    setLoadingHealth(true);
    try {
      const [docsRes, personsRes, uboRes, bankRes, movRes] = await Promise.all([
        supabase.from("documents").select("id, file_url").eq("workspace_id", workspaceId!),
        supabase.from("entities").select("id, profile_photo_url").eq("workspace_id", workspaceId!).eq("type", "person"),
        supabase.from("ubo_snapshots").select("calculated_at").eq("workspace_id", workspaceId!).eq("snapshot_type", "live").order("calculated_at", { ascending: false }).limit(1),
        supabase.from("signatories").select("id, bank_account_id").eq("workspace_id", workspaceId!),
        supabase.from("movements").select("id").eq("workspace_id", workspaceId!).eq("status", "confirmed"),
      ]);

      const allDocs = docsRes.data || [];
      const placeholder = allDocs.filter((d) => !d.file_url || d.file_url.includes("placeholder"));
      const allPersons = personsRes.data || [];
      const withPhotos = allPersons.filter((p) => p.profile_photo_url);
      const bankAccountIds = new Set((bankRes.data || []).map((s) => s.bank_account_id));

      setHealth({
        realDocs: allDocs.length - placeholder.length,
        placeholderDocs: placeholder.length,
        personsWithPhotos: withPhotos.length,
        personsWithoutPhotos: allPersons.length - withPhotos.length,
        lastUboCalc: uboRes.data?.[0]?.calculated_at || null,
        bankAccountsWithSignatories: bankAccountIds.size,
        confirmedMovements: movRes.data?.length || 0,
      });
    } catch (err: any) {
      console.error("Health check error:", err);
    } finally {
      setLoadingHealth(false);
    }
  };

  const HealthItem = ({ label, value, icon: Icon, ok }: { label: string; value: string; icon: any; ok: boolean }) => (
    <div className="flex items-center gap-3 p-3 rounded-lg border">
      <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{value}</p>
      </div>
      {ok ? (
        <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
      ) : (
        <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Demo Admin</h1>
        <p className="text-muted-foreground text-sm">Prepare and manage demo workspace data</p>
      </div>

      {/* Section 1 — Workspace Name */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Workspace Display Name</CardTitle>
          <CardDescription>This name appears in the demo banner</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} className="max-w-sm" />
            <Button onClick={saveWorkspaceName} disabled={savingName} className="gap-1">
              <Save className="h-4 w-4" />
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Section 2 — Placeholder Documents */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Demo Documents</CardTitle>
          <CardDescription>{placeholderDocs.length} documents with placeholder or missing files</CardDescription>
        </CardHeader>
        <CardContent>
          {placeholderDocs.length === 0 ? (
            <p className="text-sm text-green-600 flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4" /> All documents have real files
            </p>
          ) : (
            <div className="space-y-2">
              {placeholderDocs.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 p-2 rounded border">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{(doc.entities as any)?.name || "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">{doc.document_type}</p>
                  </div>
                  <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs shrink-0">
                    {doc.file_url ? "Placeholder" : "No file"}
                  </Badge>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleDocUpload(doc.id, doc.entity_id, file);
                      }}
                    />
                    <Button variant="outline" size="sm" className="gap-1 pointer-events-none">
                      <Upload className="h-3 w-3" /> Upload
                    </Button>
                  </label>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 3 — Profile Photos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Profile Photos</CardTitle>
          <CardDescription>{personsWithoutPhotos.length} persons without profile photos</CardDescription>
        </CardHeader>
        <CardContent>
          {personsWithoutPhotos.length === 0 ? (
            <p className="text-sm text-green-600 flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4" /> All persons have profile photos
            </p>
          ) : (
            <div className="space-y-2">
              {personsWithoutPhotos.map((person) => (
                <div key={person.id} className="flex items-center gap-3 p-2 rounded border">
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <p className="text-sm font-medium flex-1">{person.name}</p>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handlePhotoUpload(person.id, file);
                      }}
                    />
                    <Button variant="outline" size="sm" className="gap-1 pointer-events-none">
                      <Upload className="h-3 w-3" /> Upload
                    </Button>
                  </label>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 4 — Recalculate UBO */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recalculate UBO</CardTitle>
          <CardDescription>Run UBO calculation for all company entities</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={recalculateUBO} disabled={recalculating} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${recalculating ? "animate-spin" : ""}`} />
            {recalculating ? "Recalculating..." : "Recalculate All UBO"}
          </Button>
          {health?.lastUboCalc && (
            <p className="text-xs text-muted-foreground mt-2">
              Last calculated: {new Date(health.lastUboCalc).toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Section 5 — Health Check */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Demo Health Check</CardTitle>
          <CardDescription>Overview of demo data readiness</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingHealth || !health ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <HealthItem
                icon={FileText}
                label="Documents"
                value={`${health.realDocs} real / ${health.placeholderDocs} placeholder`}
                ok={health.placeholderDocs === 0}
              />
              <HealthItem
                icon={User}
                label="Profile Photos"
                value={`${health.personsWithPhotos} with / ${health.personsWithoutPhotos} without`}
                ok={health.personsWithoutPhotos === 0}
              />
              <HealthItem
                icon={Shield}
                label="UBO Snapshots"
                value={health.lastUboCalc ? `Last: ${new Date(health.lastUboCalc).toLocaleDateString()}` : "Never calculated"}
                ok={!!health.lastUboCalc && Date.now() - new Date(health.lastUboCalc).getTime() < 86400000}
              />
              <HealthItem
                icon={Landmark}
                label="Bank Accounts with Signatories"
                value={`${health.bankAccountsWithSignatories} account(s)`}
                ok={health.bankAccountsWithSignatories > 0}
              />
              <HealthItem
                icon={ScrollText}
                label="Confirmed Movements"
                value={`${health.confirmedMovements} movement(s)`}
                ok={health.confirmedMovements > 0}
              />
            </div>
          )}
          <Button variant="outline" className="mt-4 gap-1" onClick={runHealthCheck} disabled={loadingHealth}>
            <RefreshCw className={`h-4 w-4 ${loadingHealth ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
