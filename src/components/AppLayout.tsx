import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet } from "react-router-dom";
import { NotificationBell } from "@/components/NotificationBell";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Shield, Eye } from "lucide-react";

export function AppLayout() {
  const { userRole } = useAuth();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center border-b px-4">
            <SidebarTrigger className="mr-4" />
            <div className="flex-1" />
            {userRole === "viewer" && (
              <Badge variant="secondary" className="mr-3 gap-1 text-xs">
                <Eye className="h-3 w-3" /> Viewer
              </Badge>
            )}
            {userRole === "admin" && (
              <Badge variant="outline" className="mr-3 gap-1 text-xs border-primary/30 text-primary">
                <Shield className="h-3 w-3" /> Admin
              </Badge>
            )}
            <NotificationBell />
          </header>
          <main className="flex-1 p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
