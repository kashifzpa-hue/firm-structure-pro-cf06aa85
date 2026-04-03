import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CheckCircle, XCircle, AlertTriangle, Download, Loader2, Lock } from "lucide-react";
import { EncryptionLockIcon } from "@/components/EncryptionLockIcon";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { encryptedDownload } from "@/lib/encryption";

const TYPE_COLORS: Record<string, string> = {
  TRANSFER: "bg-primary/10 text-primary",
  ISSUANCE: "bg-green-100 text-green-700",
  CANCELLATION: "bg-destructive/10 text-destructive",
  INHERITANCE: "bg-purple-100 text-purple-700",
  GIFT: "bg-pink-100 text-pink-700",
  COURT_ORDER: "bg-amber-100 text-amber-700",
  CAPITAL_INCREASE: "bg-emerald-100 text-emerald-700",
  CAPITAL_DECREASE: "bg-orange-100 text-orange-700",
};

export default function MovementDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { workspaceId, userRole } = useAuth();
  const isAdmin = userRole === "admin";
  const [movement, setMovement] = useState<any>(null);
  const [movementDocs, setMovementDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [voiding, setVoiding] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  const fetchMovement = async () => {
    if (!id || !workspaceId) return;
    const [movRes, docsRes] = await Promise.all([
      supabase.from("movements")
        .select("*, company:entities!movements_company_entity_id_fkey(id, name), share_class:share_classes(class_name, total_shares_issued), from_entity:entities!movements_from_entity_id_fkey(name), to_entity:entities!movements_to_entity_id_fkey(name), created_by_profile:profiles!movements_created_by_fkey(full_name, email)")
        .eq("id", id).single(),
      supabase.from("movement_documents")
        .select("*")
        .eq("movement_id", id)
        .order("uploaded_at", { ascending: false }),
    ]);

    const data = movRes.data;
    if (data && data.to_entity_id && data.status === "confirmed") {
      const { data: link } = await supabase.from("equity_links")
        .select("circular_ownership_type")
        .eq("owner_entity_id", data.to_entity_id)
        .eq("owned_entity_id", data.company_entity_id)
        .eq("share_class_id", data.share_class_id)
        .eq("workspace_id", workspaceId)
        .not("circular_ownership_type", "is", null)
        .limit(1)
        .maybeSingle();
      if (link) (data as any).circular_exception_type = link.circular_ownership_type;
    }
    setMovement(data);
    setMovementDocs(docsRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchMovement(); }, [id, workspaceId]);

  const handleConfirm = async () => {
    setConfirming(true);
    const { error } = await supabase.rpc("confirm_movement", { p_movement_id: id });
    if (error) { toast.error(error.message); setConfirming(false); return; }
    toast.success("Movement confirmed");
    setConfirming(false);
    fetchMovement();
  };

  const handleVoid = async () => {
    if (!voidReason.trim()) return;
    setVoiding(true);
    const { error } = await supabase.rpc("void_movement", { p_movement_id: id, p_reason: voidReason });
    if (error) { toast.error(error.message); setVoiding(false); return; }
    toast.success("Movement voided");
    setVoidOpen(false); setVoidReason(""); setVoiding(false);
    fetchMovement();
  };

  const handleDocDownload = async (doc: any) => {
    if (!doc.file_url) { toast.error("No file attached"); return; }
    setDownloading(doc.id);
    try {
      await encryptedDownload({
        documentId: doc.id,
        table: "movement_documents",
        filename: `${doc.document_type}_${doc.id}`,
      });
    } catch (err: any) {
      toast.error(err.message || "Download failed");
    } finally {
      setDownloading(null);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;
  if (!movement) return <div className="flex items-center justify-center h-64 text-muted-foreground">Movement not found.</div>;

  const isFuture = new Date(movement.movement_date) > new Date();

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/ledger")}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Movement Detail</h1>
            <Badge className={TYPE_COLORS[movement.movement_type] || ""}>{movement.movement_type.replace(/_/g, " ")}</Badge>
            <Badge className={movement.status === "confirmed" ? "bg-green-100 text-green-700" : movement.status === "voided" ? "bg-destructive/10 text-destructive" : "bg-amber-100 text-amber-700"}>
              {movement.status}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          {movement.status === "draft" && !isFuture && (
            <Button onClick={handleConfirm} disabled={confirming} className="bg-green-600 hover:bg-green-700">
              <CheckCircle className="mr-2 h-4 w-4" /> {confirming ? "Confirming..." : "Confirm"}
            </Button>
          )}
          {movement.status === "confirmed" && (
            <Button variant="destructive" onClick={() => setVoidOpen(true)}>
              <XCircle className="mr-2 h-4 w-4" /> Void
            </Button>
          )}
        </div>
      </div>

      {movement.circular_exception_type && (
        <Alert className="border-amber-300 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 text-sm">
            ⚠ This movement resulted in a circular ownership arrangement. Exception type: <strong>{movement.circular_exception_type.replace(/_/g, " ")}</strong>. See equity link for full details.
          </AlertDescription>
        </Alert>
      )}

      {movement.status === "voided" && (
        <div className="relative">
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <span className="text-6xl font-bold text-destructive/30 rotate-[-15deg]">VOIDED</span>
          </div>
        </div>
      )}

      <Card className={`shadow-sm ${movement.status === "voided" ? "opacity-60" : ""}`}>
        <CardHeader><CardTitle className="text-lg">Details</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div><dt className="text-muted-foreground">Company</dt><dd className="font-medium">{movement.company?.name}</dd></div>
            <div><dt className="text-muted-foreground">Share Class</dt><dd className="font-medium">{movement.share_class?.class_name || "—"}</dd></div>
            <div><dt className="text-muted-foreground">Movement Date</dt><dd className="font-medium">{format(parseISO(movement.movement_date), "MMM dd, yyyy")}</dd></div>
            <div><dt className="text-muted-foreground">Shares Transferred</dt><dd className="font-medium">{movement.shares_transferred.toLocaleString()}</dd></div>
            {movement.from_entity && <div><dt className="text-muted-foreground">From</dt><dd className="font-medium">{movement.from_entity.name}</dd></div>}
            {movement.to_entity && <div><dt className="text-muted-foreground">To</dt><dd className="font-medium">{movement.to_entity.name}</dd></div>}
            {movement.total_consideration && (
              <div><dt className="text-muted-foreground">Consideration</dt><dd className="font-medium">{movement.currency || ""} {movement.total_consideration.toLocaleString()}</dd></div>
            )}
            {movement.price_per_share && (
              <div><dt className="text-muted-foreground">Price/Share</dt><dd className="font-medium">{movement.currency || ""} {movement.price_per_share}</dd></div>
            )}
            {movement.reference_number && <div><dt className="text-muted-foreground">Reference</dt><dd className="font-medium">{movement.reference_number}</dd></div>}
            {movement.notes && <div className="col-span-2"><dt className="text-muted-foreground">Notes</dt><dd className="font-medium">{movement.notes}</dd></div>}
          </dl>
        </CardContent>
      </Card>

      {/* Movement Documents */}
      {movementDocs.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader><CardTitle className="text-lg">Documents</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movementDocs.map(d => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium flex items-center gap-1.5">
                      <EncryptionLockIcon isEncrypted={d.is_encrypted} className="h-3 w-3" />
                      {d.document_type}
                    </TableCell>
                    <TableCell>{d.notes || "—"}</TableCell>
                    <TableCell>{format(parseISO(d.uploaded_at), "dd MMM yyyy")}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDocDownload(d)} disabled={downloading === d.id}>
                        {downloading === d.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Audit log */}
      <Card className="shadow-sm">
        <CardHeader><CardTitle className="text-lg">Audit Trail</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span>{format(parseISO(movement.created_at), "MMM dd, yyyy HH:mm")} by {movement.created_by_profile?.full_name || movement.created_by_profile?.email || "—"}</span></div>
            {movement.confirmed_at && <div className="flex justify-between"><span className="text-muted-foreground">Confirmed</span><span>{format(parseISO(movement.confirmed_at), "MMM dd, yyyy HH:mm")}</span></div>}
            {movement.voided_at && (
              <>
                <div className="flex justify-between"><span className="text-muted-foreground">Voided</span><span>{format(parseISO(movement.voided_at), "MMM dd, yyyy HH:mm")}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Void Reason</span><span className="text-destructive">{movement.void_reason}</span></div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Void Dialog */}
      <Dialog open={voidOpen} onOpenChange={v => { setVoidOpen(v); if (!v) setVoidReason(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Void Movement</DialogTitle>
            <DialogDescription>This will reverse all equity changes. This action is permanent.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason *</Label>
            <Textarea value={voidReason} onChange={e => setVoidReason(e.target.value)} placeholder="Enter reason..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleVoid} disabled={!voidReason.trim() || voiding}>
              {voiding ? "Voiding..." : "Void Movement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
