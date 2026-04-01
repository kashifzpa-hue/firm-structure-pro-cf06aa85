import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ShareClassFormModal } from "@/components/ShareClassFormModal";
import { Plus, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  companyEntityId: string;
  companyName: string;
  isLiveMode?: boolean;
}

export function ShareCapitalSection({ companyEntityId, companyName, isLiveMode = false }: Props) {
  const { workspaceId } = useAuth();
  const [shareClasses, setShareClasses] = useState<any[]>([]);
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<any>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingClass, setDeletingClass] = useState<any>(null);

  const fetchData = async () => {
    if (!workspaceId) return;
    const [scRes, linksRes] = await Promise.all([
      supabase.from("share_classes").select("*").eq("company_entity_id", companyEntityId).eq("workspace_id", workspaceId).order("created_at"),
      supabase.from("equity_links").select("share_class_id, shares_owned").eq("owned_entity_id", companyEntityId).eq("workspace_id", workspaceId).is("end_date", null),
    ]);
    setShareClasses(scRes.data || []);
    const alloc: Record<string, number> = {};
    (linksRes.data || []).forEach((l: any) => {
      if (l.share_class_id) {
        alloc[l.share_class_id] = (alloc[l.share_class_id] || 0) + (l.shares_owned || 0);
      }
    });
    setAllocations(alloc);
  };

  useEffect(() => { fetchData(); }, [companyEntityId, workspaceId]);

  const handleDelete = async () => {
    if (!deletingClass) return;
    const allocated = allocations[deletingClass.id] || 0;
    if (allocated > 0) {
      toast.error("Cannot delete this share class while shareholders are linked to it. Remove all shareholdings first.");
      setDeleteOpen(false);
      return;
    }
    const { error } = await supabase.from("share_classes").delete().eq("id", deletingClass.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Share class deleted");
    setDeleteOpen(false);
    setDeletingClass(null);
    fetchData();
  };

  // Summary: total issued capital grouped by currency
  const capitalByCurrency: Record<string, number> = {};
  shareClasses.forEach(sc => {
    const val = sc.total_shares_issued * Number(sc.par_value_per_share);
    capitalByCurrency[sc.currency] = (capitalByCurrency[sc.currency] || 0) + val;
  });
  const capitalSummary = Object.entries(capitalByCurrency).map(([cur, val]) =>
    `${cur} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  ).join(" · ");

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg">Share Capital Structure</CardTitle>
          {shareClasses.length > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              {shareClasses.length} Share Class{shareClasses.length !== 1 ? "es" : ""} · Total Issued Capital: {capitalSummary || "—"}
            </p>
          )}
        </div>
        {!isLiveMode && (
          <Button size="sm" onClick={() => { setEditingClass(null); setModalOpen(true); }}>
            <Plus className="mr-1 h-4 w-4" /> Add Share Class
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {shareClasses.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">No share classes set up yet. Add one to define the company's capital structure.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Class Name</TableHead>
                <TableHead>Shares Issued</TableHead>
                <TableHead>Par Value</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Total Value</TableHead>
                <TableHead>Voting</TableHead>
                <TableHead>Allocated</TableHead>
                <TableHead>Unallocated</TableHead>
                <TableHead>% Allocated</TableHead>
                {!isLiveMode && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {shareClasses.map(sc => {
                const allocated = allocations[sc.id] || 0;
                const unallocated = sc.total_shares_issued - allocated;
                const pctAllocated = sc.total_shares_issued > 0 ? (allocated / sc.total_shares_issued) * 100 : 0;
                const totalVal = sc.total_shares_issued * Number(sc.par_value_per_share);
                return (
                  <TableRow key={sc.id}>
                    <TableCell className="font-medium">{sc.class_name}</TableCell>
                    <TableCell>{sc.total_shares_issued.toLocaleString()}</TableCell>
                    <TableCell>{Number(sc.par_value_per_share).toFixed(4)}</TableCell>
                    <TableCell>{sc.currency}</TableCell>
                    <TableCell>{sc.currency} {totalVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell>
                      {sc.voting_rights ? (
                        <Badge className="bg-success text-success-foreground">Yes</Badge>
                      ) : (
                        <Badge variant="secondary">Non-voting</Badge>
                      )}
                    </TableCell>
                    <TableCell>{allocated.toLocaleString()}</TableCell>
                    <TableCell>
                      <span className={unallocated > 0 ? "text-destructive font-medium" : "text-success font-medium"}>
                        {unallocated.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-[100px]">
                        <Progress value={pctAllocated} className="h-2 flex-1" />
                        <span className="text-xs text-muted-foreground">{pctAllocated.toFixed(0)}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingClass(sc); setModalOpen(true); }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { setDeletingClass(sc); setDeleteOpen(true); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <ShareClassFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        editingClass={editingClass}
        companyEntityId={companyEntityId}
        workspaceId={workspaceId!}
        onSaved={fetchData}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Share Class</DialogTitle>
            <DialogDescription>Are you sure? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
