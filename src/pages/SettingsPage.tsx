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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Trash2, Mail, Clock } from "lucide-react";
import { AlertRulesTab } from "@/components/AlertRulesTab";

export default function SettingsPage() {
  const { workspaceId, userRole, user } = useAuth();
  const [workspaceName, setWorkspaceName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "viewer">("viewer");
  const [members, setMembers] = useState<any[]>([]);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [removeUser, setRemoveUser] = useState<any>(null);
  const isAdmin = userRole === "admin";

  const fetchData = async () => {
    if (!workspaceId) return;

    const { data: ws } = await supabase.from("workspaces").select("name").eq("id", workspaceId).single();
    if (ws) setWorkspaceName(ws.name);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("*, user_roles(*)")
      .eq("workspace_id", workspaceId);
    setMembers(profiles || []);

    const { data: invites } = await supabase
      .from("workspace_invitations")
      .select("*")
      .eq("workspace_id", workspaceId)
      .is("accepted_at", null)
      .order("created_at", { ascending: false });
    setPendingInvites(invites || []);
  };

  useEffect(() => {
    fetchData();
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
    const email = inviteEmail.trim().toLowerCase();

    // Check if already a member
    const existingMember = members.find((m) => m.email?.toLowerCase() === email);
    if (existingMember) {
      toast.error("This user is already a member of the workspace");
      return;
    }

    // Check if already invited
    const existingInvite = pendingInvites.find((i) => i.email.toLowerCase() === email);
    if (existingInvite) {
      toast.error("An invitation has already been sent to this email");
      return;
    }

    setInviting(true);
    const { error } = await supabase.from("workspace_invitations").insert({
      workspace_id: workspaceId!,
      email,
      role: inviteRole,
      invited_by: user!.id,
    } as any);
    setInviting(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Invitation sent to ${email}. They can sign up and will be automatically added to your workspace.`);
      setInviteEmail("");
      setInviteRole("viewer");
      fetchData();
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    const { error } = await supabase.from("workspace_invitations").delete().eq("id", inviteId);
    if (error) toast.error(error.message);
    else {
      toast.success("Invitation cancelled");
      fetchData();
    }
  };

  const handleRemoveUser = async () => {
    if (!removeUser) return;
    await supabase.from("user_roles").delete().eq("user_id", removeUser.user_id).eq("workspace_id", workspaceId);
    await supabase.from("profiles").update({ workspace_id: null } as any).eq("user_id", removeUser.user_id);
    setMembers(members.filter((m) => m.user_id !== removeUser.user_id));
    setRemoveUser(null);
    toast.success("User removed from workspace");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      <Tabs defaultValue="workspace">
        <TabsList>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="alert-rules">Alert Rules</TabsTrigger>
        </TabsList>

        <TabsContent value="workspace" className="space-y-6 mt-4">
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
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="user@example.com"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="flex-1"
                  />
                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as "admin" | "viewer")}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">Viewer</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={handleInvite} disabled={inviting}>
                    <Mail className="h-4 w-4 mr-2" />
                    {inviting ? "Sending..." : "Invite"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Invited users will be automatically added to your workspace when they sign up with the invited email address.
                </p>

                {pendingInvites.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> Pending Invitations
                    </h4>
                    <div className="space-y-2">
                      {pendingInvites.map((invite) => (
                        <div key={invite.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                          <div className="flex items-center gap-2">
                            <span>{invite.email}</span>
                            <Badge variant="secondary" className="text-xs">{invite.role}</Badge>
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleCancelInvite(invite.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
        </TabsContent>

        <TabsContent value="alert-rules" className="mt-4">
          <Card className="shadow-sm">
            <CardContent className="pt-6">
              <AlertRulesTab />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
