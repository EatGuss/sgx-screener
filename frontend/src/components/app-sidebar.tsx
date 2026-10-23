import type { ComponentProps } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, LineChart, LogIn, LogOut, Settings, SlidersHorizontal } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { logout } from "@/lib/auth";

const NAV_ITEMS = [
  { title: "Home", url: "/screener/home", icon: Home },
  { title: "Builder", url: "/screener", icon: SlidersHorizontal },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar(props: ComponentProps<typeof Sidebar>) {
  const { pathname } = useLocation();
  const { user, signedIn, loading } = useAuth();

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1">
          <LineChart className="size-5 text-sidebar-primary" />
          <span className="text-sm font-semibold">SGX Screener</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Screener</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.url}>
                  {/* Exact match so /screener/home does not light up "Builder". */}
                  <SidebarMenuButton asChild isActive={pathname === item.url}>
                    <Link to={item.url}>
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      {!loading && (
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              {signedIn ? (
                <SidebarMenuButton
                  onClick={() => {
                    void logout().then(() => window.location.assign("/screener/home"));
                  }}
                >
                  <LogOut className="size-4" />
                  <span className="truncate">Log out {user?.username}</span>
                </SidebarMenuButton>
              ) : (
                <SidebarMenuButton asChild isActive={pathname === "/login"}>
                  <Link to="/login">
                    <LogIn className="size-4" />
                    <span>Log in</span>
                  </Link>
                </SidebarMenuButton>
              )}
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      )}
      <SidebarRail />
    </Sidebar>
  );
}
