import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBanks, type BankRow } from "@/hooks/use-banks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";

export function BanksSettingsTab() {
  const { workspaceId, userRole } = useAuth();
  const isAdmin = userRole === "admin";
  const qc = useQueryClient();
  const { banks, isLoading } = useBanks(true);

  const [editing, setEditing] = useState<BankRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<BankRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", short_code: "", country: "UAE", display_order: 0, is_active: true });

  const refresh = () => qc.invalidateQueries({ queryKey: ["banks"] });

  const openCreate = () => {
    setForm({ name: "", short_code: "", country: "UAE", display_order: (banks.length + 1) * 1, is_active: true });
    setCreating(true);
  };

  const openEdit = (b: BankRow) => {
    setForm({
      name: b.name,
      short_code: b.short_code || "",
      country: b.country || "UAE",
      display_order: b.display_order,
      is_active: b.is_active,
    });
    setEditing(b);
  };

  const handleSave = async () => {
    if (!workspaceId || !form.name.trim()) {
      toast.error("Bank name is required");
      return;
    }
    setSaving(true);
    const payload = {
      workspace_id: workspaceId,
      name: form.name.trim(),
      short_code: form.short_code.trim() || null,
      country: form.country.trim() || "UAE",
      display_order: Number(form.display_order) || 0,
      is_active: form.is_active,
    };
    const { error } = editing
      ? await supabase.from("banks" as any).update(payload).eq("id", editing.id)
      : await supabase.from("banks" as any).insert(payload);
    setSaving(false);
    if (error) {
      toast.error(error.message.includes("duplicate") ? "That bank is already in the list" : error.message);
      return;
    }
    toast.success(editing ? "Bank updated" : "Bank added");
    setEditing(null);
    setCreating(false);
    refresh();
  };

  const toggleActive = async (b: BankRow) => {
    const { error } = await supabase.from("banks" as any).update({ is_active: !b.is_active }).eq("id", b.id);
    if (error) toast.error(error.message);
    else refresh();
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("banks" as any).delete().eq("id", deleting.id);
    setDeleting(null);
    if (error) toast.error(error.message);
    else {
      toast.success("Bank removed");
      refresh();
    }
  };

  const dialogOpen = creating || !!editing;

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Banks</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            This list feeds the bank dropdowns on relationships (CIF) and bank accounts.
          </p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />Add Bank
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : banks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No banks yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Short Code</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Status</TableHead>
                {isAdmin && <TableHead className="w-24"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {banks.map(b => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell>{b.short_code || "—"}</TableCell>
                  <TableCell>{b.country}</TableCell>
                  <TableCell>
                    {isAdmin ? (
                      <div className="flex items-center gap-2">
                        <Switch checked={b.is_active} onCheckedChange={() => toggleActive(b)} />
                        <span className="text-xs text-muted-foreground">{b.is_active ? "Active" : "Hidden"}</span>
                      </div>
                    ) : (
                      <Badge variant={b.is_active ? "default" : "secondary"}>{b.is_active ? "Active" : "Hidden"}</Badge>
                    )}
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(b)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleting(b)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) { setCreating(false); setEditing(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit Bank" : "Add Bank"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Bank Name *</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Short Code</Label><Input value={form.short_code} onChange={e => setForm(p => ({ ...p, short_code: e.target.value }))} /></div>
              <div><Label>Country</Label><Input value={form.country} onChange={e => setForm(p => ({ ...p, country: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4 items-end">
              <div><Label>Display Order</Label><Input type="number" value={form.display_order} onChange={e => setForm(p => ({ ...p, display_order: Number(e.target.value) }))} /></div>
              <div className="flex items-center gap-2 pb-2">
                <Switch checked={form.is_active} onCheckedChange={v => setForm(p => ({ ...p, is_active: v }))} />
                <Label className="mb-0">Active</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreating(false); setEditing(null); }}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : editing ? "Update" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Bank</DialogTitle>
            <DialogDescription>
              Remove “{deleting?.name}” from the list? Existing accounts and relationships keep their stored bank name.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
