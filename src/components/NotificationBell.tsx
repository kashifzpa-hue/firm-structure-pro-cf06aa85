import { useState, useEffect, useRef } from "react";
import { Bell, AlertTriangle, Clock, FileCheck, ShieldAlert, PieChart, Link2Off, CheckCircle, Archive, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

const typeIcons: Record<string, { icon: any; color: string }> = {
  DOCUMENT_EXPIRED: { icon: AlertTriangle, color: "text-destructive" },
  DOCUMENT_EXPIRING_SOON: { icon: Clock, color: "text-warning" },
  MOVEMENT_DRAFT_PENDING: { icon: FileCheck, color: "text-muted-foreground" },
  UBO_THRESHOLD_BREACH: { icon: ShieldAlert, color: "text-destructive" },
  SHAREHOLDING_GAP: { icon: PieChart, color: "text-warning" },
  UNRESOLVED_UBO_CHAIN: { icon: Link2Off, color: "text-orange-500" },
  LIVE_MODE_ACTIVATED: { icon: CheckCircle, color: "text-green-600" },
  ENTITY_DEACTIVATED: { icon: Archive, color: "text-muted-foreground" },
  SYSTEM_ALERT: { icon: Bell, color: "text-primary" },
};

export function NotificationBell() {
  const { workspaceId } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    if (!workspaceId) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(20);
    setNotifications(data || []);
    setUnreadCount((data || []).filter((n: any) => !n.is_read).length);
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 300000); // 5 min

    // Realtime subscription
    const channel = supabase
      .channel("notifications-bell")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "notifications",
      }, () => {
        fetchNotifications();
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [workspaceId]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const markAllRead = async () => {
    if (!workspaceId) return;
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() } as any)
      .in("id", unreadIds);
    fetchNotifications();
  };

  const handleClick = async (n: any) => {
    if (!n.is_read) {
      await supabase
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() } as any)
        .eq("id", n.id);
    }
    setOpen(false);
    if (n.action_url) navigate(n.action_url);
    else fetchNotifications();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-accent transition-colors"
      >
        <Bell className="h-5 w-5 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[420px] rounded-lg border bg-popover shadow-lg z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <span className="font-semibold text-sm">Notifications</span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-xs text-primary hover:underline">
                  Mark all as read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <ScrollArea className="max-h-[500px]">
            {notifications.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No notifications yet
              </div>
            ) : (
              <div>
                {notifications.map((n) => {
                  const typeInfo = typeIcons[n.notification_type] || typeIcons.SYSTEM_ALERT;
                  const Icon = typeInfo.icon;
                  return (
                    <div
                      key={n.id}
                      onClick={() => handleClick(n)}
                      className={`flex gap-3 px-4 py-3 cursor-pointer hover:bg-accent/50 transition-colors border-l-2 ${
                        n.is_read ? "border-l-transparent" : "border-l-primary bg-accent/20"
                      }`}
                    >
                      <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${typeInfo.color}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm leading-tight ${n.is_read ? "" : "font-semibold"}`}>
                          {n.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {n.body}
                        </p>
                        <p className="text-xs text-muted-foreground/60 mt-1">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          <div className="border-t px-4 py-2">
            <button
              onClick={() => { setOpen(false); navigate("/notifications"); }}
              className="text-xs text-primary hover:underline w-full text-center"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
