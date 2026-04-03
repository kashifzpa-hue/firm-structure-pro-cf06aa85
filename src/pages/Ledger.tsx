import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MovementWizard } from "@/components/MovementWizard";
import { Plus, Download, Eye, Pencil, Trash2, XCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

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

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-amber-100 text-amber-700",
  confirmed: "bg-green-100 text-green-700",
  voided: "bg-destructive/10 text-destructive",
};

export default function Ledger() {
  const { workspaceId, userRole } = useAuth();
  const isAdmin = userRole === "admin";
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCompany, setFilterCompany] = useState(searchParams.get("company") || "all");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState(searchParams.get("status") || "all");
  const [companies, setCompanies] = useState<any[]>([]);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingMovement, setEditingMovement] = useState<any>(null);
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voiding, setVoiding] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchMovements = async () => {
    if (!workspaceId) return;
    const [movRes, compRes] = await Promise.all([
      supabase.from("movements")
        .select("*, company:entities!movements_company_entity_id_fkey(id, name), share_class:share_classes(class_name), from_entity:entities!movements_from_entity_id_fkey(name), to_entity:entities!movements_to_entity_id_fkey(name)")
        .eq("workspace_id", workspaceId)
        .order("movement_date", { ascending: false }),
      supabase.from("entities").select("id, name, type, captable_status").eq("workspace_id", workspaceId).eq("type", "company").order("name"),
    ]);
    setMovements(movRes.data || []);
    setCompanies(compRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchMovements(); }, [workspaceId]);

  const filtered = movements.filter(m => {
    if (filterCompany !== "all" && m.company_entity_id !== filterCompany) return false;
    if (filterType !== "all" && m.movement_type !== filterType) return false;
    if (filterStatus !== "all" && m.status !== filterStatus) return false;
    if (search) {
      const s = search.toLowerCase();
      if (
        !m.company?.name?.toLowerCase().includes(s) &&
        !m.from_entity?.name?.toLowerCase().includes(s) &&
        !m.to_entity?.name?.toLowerCase().includes(s) &&
        !m.reference_number?.toLowerCase().includes(s)
      ) return false;
    }
    return true;
  });

  const handleExportCSV = () => {
    const headers = ["Date", "Company", "Movement Type", "Share Class", "From", "To", "Shares Transferred", "Price Per Share", "Currency", "Total Consideration", "Reference Number", "Status"];
    const rows = filtered.map(m => [
      m.movement_date,
      m.company?.name || "",
      m.movement_type,
      m.share_class?.class_name || "",
      m.from_entity?.name || "",
      m.to_entity?.name || "",
      m.shares_transferred,
      m.price_per_share || "",
      m.currency || "",
      m.total_consideration || "",
      m.reference_number || "",
      m.status,
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "movement_ledger.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleVoid = async () => {
    if (!voidingId || !voidReason.trim()) return;
    setVoiding(true);
    const { error } = await supabase.rpc("void_movement", { p_movement_id: voidingId, p_reason: voidReason });
    if (error) { toast.error(error.message); setVoiding(false); return; }
    toast.success("Movement voided");
    setVoidOpen(false); setVoidingId(null); setVoidReason(""); setVoiding(false);
    fetchMovements();
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    const { error } = await supabase.from("movements").delete().eq("id", deletingId);
    if (error) { toast.error("Failed to delete"); return; }
    toast.success("Draft deleted");
    setDeleteOpen(false); setDeletingId(null);
    fetchMovements();
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Movement Ledger</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCSV}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>
          {isAdmin && <Button onClick={() => { setEditingMovement(null); setWizardOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Record Movement</Button>}
        </div>
      </div>

      {/* Filters */}
      <Card className="shadow-sm">
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
            <Select value={filterCompany} onValueChange={setFilterCompany}>
              <SelectTrigger><SelectValue placeholder="All Companies" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger><SelectValue placeholder="All Types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {["TRANSFER", "ISSUANCE", "CANCELLATION", "INHERITANCE", "GIFT", "COURT_ORDER", "CAPITAL_INCREASE", "CAPITAL_DECREASE"].map(t =>
                  <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
                )}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger><SelectValue placeholder="All Statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="voided">Voided</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="shadow-sm">
        <CardContent className="pt-0">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg font-medium">No movements found</p>
              <p className="text-sm">Record your first movement to get started.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Share Class</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Shares</TableHead>
                  <TableHead>Consideration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(m => (
                  <TableRow key={m.id} className={m.status === "voided" ? "opacity-50" : ""}>
                    <TableCell>{format(parseISO(m.movement_date), "MMM dd, yyyy")}</TableCell>
                    <TableCell className="font-medium">{m.company?.name}</TableCell>
                    <TableCell><Badge className={TYPE_COLORS[m.movement_type] || ""}>{m.movement_type.replace(/_/g, " ")}</Badge></TableCell>
                    <TableCell>{m.share_class?.class_name || "—"}</TableCell>
                    <TableCell>{m.from_entity?.name || "—"}</TableCell>
                    <TableCell>{m.to_entity?.name || "—"}</TableCell>
                    <TableCell>{m.shares_transferred.toLocaleString()}</TableCell>
                    <TableCell>{m.total_consideration ? `${m.currency || ""} ${m.total_consideration.toLocaleString()}` : "—"}</TableCell>
                    <TableCell><Badge className={STATUS_COLORS[m.status] || ""}>{m.status}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/ledger/${m.id}`)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {isAdmin && m.status === "draft" && (
                          <>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingMovement(m); setWizardOpen(true); }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { setDeletingId(m.id); setDeleteOpen(true); }}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {isAdmin && m.status === "confirmed" && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { setVoidingId(m.id); setVoidOpen(true); }}>
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <MovementWizard open={wizardOpen} onOpenChange={setWizardOpen} onSaved={fetchMovements} editingMovement={editingMovement} />

      {/* Void Dialog */}
      <Dialog open={voidOpen} onOpenChange={v => { setVoidOpen(v); if (!v) { setVoidReason(""); setVoidingId(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Void Movement</DialogTitle>
            <DialogDescription>This will reverse all equity changes from this movement. This action is permanent.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason for voiding *</Label>
            <Textarea value={voidReason} onChange={e => setVoidReason(e.target.value)} placeholder="Enter the reason..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleVoid} disabled={!voidReason.trim() || voiding}>
              {voiding ? "Voiding..." : "Void Movement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Draft</DialogTitle>
            <DialogDescription>Are you sure? This draft movement will be permanently deleted.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
