import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export default function SettingsPage() {
  const { workspaceId, userRole, user } = useAuth();
  const [workspaceName, setWorkspaceName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [removeUser, setRemoveUser] = useState<any>(null);
  const isAdmin = userRole === "admin";

  useEffect(() => {
    if (!workspaceId) return;
    const fetch = async () => {
      const { data: ws } = await supabase.from("workspaces").select("name").eq("id", workspaceId).single();
      if (ws) setWorkspaceName(ws.name);

      const { data: profiles } = await supabase
        .from("profiles")
        .select("*, user_roles(*)")
        .eq("workspace_id", workspaceId);
      setMembers(profiles || []);
    };
    fetch();
  }, [workspaceId]);

  const updateWorkspaceName = async () => {
    if (!workspaceName.trim()) return;
    setLoading(true);
    const { error } = await supabase.from("workspaces").update({ name: workspaceName }).eq("id", workspaceId);
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success("Workspace name updated");
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    toast.info("Invite functionality requires an edge function to send invite emails. For now, users can sign up and be linked to the workspace manually.");
    setInviteEmail("");
  };

  const handleRemoveUser = async () => {
    if (!removeUser) return;
    await supabase.from("user_roles").delete().eq("user_id", removeUser.user_id).eq("workspace_id", workspaceId);
    await supabase.from("profiles").update({ workspace_id: null }).eq("user_id", removeUser.user_id);
    setMembers(members.filter((m) => m.user_id !== removeUser.user_id));
    setRemoveUser(null);
    toast.success("User removed from workspace");
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      <Card className="shadow-sm">
        <CardHeader><CardTitle className="text-base">Workspace</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Workspace Name</Label>
            <div className="flex gap-2">
              <Input value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} disabled={!isAdmin} />
              {isAdmin && (
                <Button onClick={updateWorkspaceName} disabled={loading}>Save</Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {isAdmin && (
        <Card className="shadow-sm">
          <CardHeader><CardTitle className="text-base">Invite User</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input placeholder="user@example.com" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
              <Button onClick={handleInvite}>Send Invite</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-sm">
        <CardHeader><CardTitle className="text-base">Team Members</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                {isAdmin && <TableHead className="w-10"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => {
                const role = m.user_roles?.[0]?.role || "viewer";
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.full_name || "—"}</TableCell>
                    <TableCell>{m.email}</TableCell>
                    <TableCell>
                      <Badge variant={role === "admin" ? "default" : "secondary"}>
                        {role === "admin" ? "Admin" : "Viewer"}
                      </Badge>
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        {m.user_id !== user?.id && (
                          <Button variant="ghost" size="icon" onClick={() => setRemoveUser(m)} className="h-8 w-8 text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!removeUser} onOpenChange={() => setRemoveUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove User</DialogTitle>
            <DialogDescription>Are you sure? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveUser(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRemoveUser}>Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
