import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Clock, FileCheck, ShieldAlert, PieChart, Link2Off, CheckCircle, Archive, Bell, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const typeLabels: Record<string, { label: string; icon: any; color: string }> = {
  DOCUMENT_EXPIRED: { label: "Document Expired", icon: AlertTriangle, color: "text-destructive" },
  DOCUMENT_EXPIRING_SOON: { label: "Expiring Soon", icon: Clock, color: "text-warning" },
  MOVEMENT_DRAFT_PENDING: { label: "Draft Pending", icon: FileCheck, color: "text-muted-foreground" },
  UBO_THRESHOLD_BREACH: { label: "UBO Threshold", icon: ShieldAlert, color: "text-destructive" },
  SHAREHOLDING_GAP: { label: "Shareholding Gap", icon: PieChart, color: "text-warning" },
  UNRESOLVED_UBO_CHAIN: { label: "Unresolved Chain", icon: Link2Off, color: "text-orange-500" },
  LIVE_MODE_ACTIVATED: { label: "Live Mode", icon: CheckCircle, color: "text-green-600" },
  ENTITY_DEACTIVATED: { label: "Deactivated", icon: Archive, color: "text-muted-foreground" },
  SYSTEM_ALERT: { label: "System Alert", icon: Bell, color: "text-primary" },
};

export default function Notifications() {
  const { workspaceId } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchNotifications = async () => {
    if (!workspaceId) return;
    let query = supabase
      .from("notifications")
      .select("*, entity:entities(name)")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (typeFilter !== "all") query = query.eq("notification_type", typeFilter as any);
    if (statusFilter === "unread") query = query.eq("is_read", false);
    if (statusFilter === "read") query = query.eq("is_read", true);

    const { data } = await query;
    setNotifications(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchNotifications(); }, [workspaceId, typeFilter, statusFilter]);

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.is_read).map(n => n.id);
    if (!unread.length) return;
    await supabase.from("notifications").update({ is_read: true, read_at: new Date().toISOString() } as any).in("id", unread);
    toast.success("All notifications marked as read");
    fetchNotifications();
  };

  const deleteAllRead = async () => {
    const readIds = notifications.filter(n => n.is_read).map(n => n.id);
    if (!readIds.length) return;
    await supabase.from("notifications").delete().in("id", readIds);
    toast.success("Read notifications deleted");
    fetchNotifications();
  };

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true, read_at: new Date().toISOString() } as any).eq("id", id);
    fetchNotifications();
  };

  const deleteNotification = async (id: string) => {
    await supabase.from("notifications").delete().eq("id", id);
    fetchNotifications();
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={markAllRead}>Mark all as read</Button>
          <Button variant="outline" size="sm" onClick={deleteAllRead}>Delete all read</Button>
        </div>
      </div>

      <div className="flex gap-3">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Filter by type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(typeLabels).map(([key, { label }]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="unread">Unread</SelectItem>
            <SelectItem value="read">Read</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Bell className="h-12 w-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">No notifications</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">Type</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Body</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {notifications.map((n) => {
              const info = typeLabels[n.notification_type] || typeLabels.SYSTEM_ALERT;
              const Icon = info.icon;
              return (
                <TableRow key={n.id} className={n.is_read ? "" : "bg-accent/20"}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${info.color}`} />
                      <span className="text-xs">{info.label}</span>
                    </div>
                  </TableCell>
                  <TableCell className={`font-medium ${n.is_read ? "" : "font-semibold"}`}>{n.title}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">{n.body}</TableCell>
                  <TableCell>
                    {n.entity_id ? (
                      <button onClick={() => navigate(`/entities/${n.entity_id}`)} className="text-primary hover:underline text-sm">
                        {(n.entity as any)?.name || "View"}
                      </button>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-sm">{format(new Date(n.created_at), "dd MMM yyyy HH:mm")}</TableCell>
                  <TableCell>
                    <Badge variant={n.is_read ? "secondary" : "default"}>
                      {n.is_read ? "Read" : "Unread"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {!n.is_read && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => markRead(n.id)}>
                          <CheckCircle className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteNotification(n.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
