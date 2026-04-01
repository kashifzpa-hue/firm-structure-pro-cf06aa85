import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Search, Building2, User, Link2, AlertTriangle, Wrench, CheckCircle } from "lucide-react";
import { format, parseISO, isToday } from "date-fns";
import { toast } from "sonner";
import { OwnershipFormModal } from "@/components/OwnershipFormModal";

export default function Ownership() {
  const { workspaceId } = useAuth();
  const [links, setLinks] = useState<any[]>([]);
  const [entities, setEntities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [entityFilter, setEntityFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<any>(null);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closingLink, setClosingLink] = useState<any>(null);
  const [closeDate, setCloseDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingLink, setDeletingLink] = useState<any>(null);

  const fetchData = async () => {
    if (!workspaceId) return;
    const [linksRes, entitiesRes] = await Promise.all([
      supabase
        .from("equity_links")
        .select("*, owner:entities!equity_links_owner_entity_id_fkey(*), owned:entities!equity_links_owned_entity_id_fkey(*), share_class:share_classes(*)")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false }),
      supabase.from("entities").select("id, name, type").eq("workspace_id", workspaceId).order("name"),
    ]);
    setLinks(linksRes.data || []);
    setEntities(entitiesRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [workspaceId]);

  const filtered = useMemo(() => {
    return links.filter((l) => {
      if (activeOnly && l.end_date) return false;
      const ownerName = l.owner?.name?.toLowerCase() || "";
      const ownedName = l.owned?.name?.toLowerCase() || "";
      const matchSearch = ownerName.includes(search.toLowerCase()) || ownedName.includes(search.toLowerCase());
      const matchEntity = entityFilter === "all" || l.owner_entity_id === entityFilter || l.owned_entity_id === entityFilter;
      return matchSearch && matchEntity;
    });
  }, [links, search, activeOnly, entityFilter]);

  const handleCloseLink = async () => {
    if (!closingLink) return;
    const { error } = await supabase.from("equity_links").update({ end_date: closeDate }).eq("id", closingLink.id);
    if (error) { toast.error("Failed to close link"); return; }
    toast.success("Ownership link closed");
    setCloseDialogOpen(false);
    setClosingLink(null);
    fetchData();
  };

  const handleDelete = async () => {
    if (!deletingLink) return;
    const { error } = await supabase.from("equity_links").delete().eq("id", deletingLink.id);
    if (error) { toast.error("Failed to delete link"); return; }
    toast.success("Ownership link deleted");
    setDeleteDialogOpen(false);
    setDeletingLink(null);
    fetchData();
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Ownership Links</h1>
        <Button onClick={() => { setEditingLink(null); setModalOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Add Ownership Link
        </Button>
      </div>

      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by entity name..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-52"><SelectValue placeholder="All Entities" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Entities</SelectItem>
            {entities.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Switch id="active-only" checked={activeOnly} onCheckedChange={setActiveOnly} />
          <Label htmlFor="active-only" className="text-sm">Show Active Only</Label>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Link2 className="h-16 w-16 mb-4 opacity-20" />
          <p className="text-lg font-medium">No ownership links found</p>
          <p className="text-sm mb-4">Add your first ownership link to get started.</p>
          <Button onClick={() => { setEditingLink(null); setModalOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Add Ownership Link
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Owner</TableHead>
                <TableHead>Owns (Company)</TableHead>
                <TableHead>Share Class</TableHead>
                <TableHead>Shares Owned</TableHead>
                <TableHead>% Holding</TableHead>
                <TableHead>Voting</TableHead>
                <TableHead>Effective Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((link) => {
                const isActive = !link.end_date;
                const canDelete = link.effective_date && isToday(parseISO(link.effective_date));
                const hasShares = !!link.share_class_id;
                return (
                  <TableRow key={link.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{link.owner?.name}</span>
                        <Badge variant="outline" className="gap-1 text-xs">
                          {link.owner?.type === "person" ? <User className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
                          {link.owner?.type === "person" ? "Person" : "Company"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{link.owned?.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {link.share_class ? link.share_class.class_name : (
                        <Badge variant="outline" className="text-xs text-warning gap-1"><AlertTriangle className="h-3 w-3" /> No share data</Badge>
                      )}
                    </TableCell>
                    <TableCell>{link.shares_owned ? link.shares_owned.toLocaleString() : "—"}</TableCell>
                    <TableCell><Badge variant="secondary">{Number(link.percentage).toFixed(2)}%</Badge></TableCell>
                    <TableCell>
                      {link.share_class ? (
                        link.share_class.voting_rights ? <Badge className="bg-success text-success-foreground text-xs">Yes</Badge> : <Badge variant="secondary" className="text-xs">Non-voting</Badge>
                      ) : "—"}
                    </TableCell>
                    <TableCell>{format(parseISO(link.effective_date), "MMM dd, yyyy")}</TableCell>
                    <TableCell>
                      {isActive ? (
                        <Badge className="bg-success text-success-foreground">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Closed</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => { setEditingLink(link); setModalOpen(true); }}>Edit</Button>
                        {isActive && !canDelete && (
                          <Button variant="outline" size="sm" onClick={() => { setClosingLink(link); setCloseDate(format(new Date(), "yyyy-MM-dd")); setCloseDialogOpen(true); }}>Close</Button>
                        )}
                        {canDelete && (
                          <Button variant="destructive" size="sm" onClick={() => { setDeletingLink(link); setDeleteDialogOpen(true); }}>Delete</Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <OwnershipFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        editingLink={editingLink}
        entities={entities}
        workspaceId={workspaceId!}
        onSaved={fetchData}
      />

      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close Ownership Link</DialogTitle>
            <DialogDescription>Set the end date for this ownership link. It will be kept for historical records.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>End Date</Label>
            <Input type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} className="mt-1" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCloseLink}>Close Link</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Ownership Link</DialogTitle>
            <DialogDescription>Are you sure? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
