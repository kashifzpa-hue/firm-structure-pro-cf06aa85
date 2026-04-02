import { LayoutDashboard, Building2, FileText, Settings, LogOut, Link2, GitBranch, ScrollText, Shield, FileBarChart, Bell, Landmark, PenLine, Lock } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useBankingEnabled } from "@/hooks/use-banking-enabled";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Entities", url: "/entities", icon: Building2 },
  { title: "Ownership", url: "/ownership", icon: Link2 },
  { title: "Org Chart", url: "/org-chart", icon: GitBranch },
  { title: "Ledger", url: "/ledger", icon: ScrollText },
  { title: "UBO Registry", url: "/ubo", icon: Shield },
  { title: "Reports", url: "/reports", icon: FileBarChart },
  { title: "Documents", url: "/documents", icon: FileText },
  { title: "Settings", url: "/settings", icon: Settings },
];

const bankingItems = [
  { title: "Bank Accounts", url: "/bank-accounts", icon: Landmark },
  { title: "Signatory Register", url: "/signatory-register", icon: PenLine },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut } = useAuth();

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarContent className="bg-sidebar">
        <div className="flex items-center gap-2 px-4 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-bold text-sm">
            CS
          </div>
          {!collapsed && (
            <span className="text-lg font-semibold text-sidebar-foreground">CorpSync</span>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/dashboard"}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      activeClassName="bg-sidebar-accent text-sidebar-foreground font-medium"
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="bg-sidebar">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={signOut}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground cursor-pointer"
            >
              <LogOut className="h-5 w-5 shrink-0" />
              {!collapsed && <span>Sign Out</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
