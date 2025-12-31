import type { ComponentType } from "react";
import { Link, useLocation } from "react-router-dom";
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

import {
  CampaignsQ,
  Units,
  Promotions,
  Sessions,
  Dashboard,
  LocationsDot,
} from "@/components/icons/Icons";

import { useAuth } from "@/hooks/useAuth";
import { NavUser } from "./NavUser";

// ---- Navigation Items ---- //
interface NavItem {
  label: string;
  to: string;
  icon: ComponentType<{ className?: string }>;
  match: (path: string) => boolean;
}

const navItems: NavItem[] = [
  { label: "Dashboard", to: "/", icon: Dashboard, match: (path) => path === "/" },
  {
    label: "Locations",
    to: "/locations",
    icon: LocationsDot,
    match: (path) => path === "/locations" || path.startsWith("/locations/"),
  },
  {
    label: "Promotions",
    to: "/promotions",
    icon: Promotions,
    match: (path) => path.startsWith("/promotions"),
  },
  {
    label: "Campaigns",
    to: "/campaigns",
    icon: CampaignsQ,
    match: (path) => path.startsWith("/campaigns"),
  },
  {
    label: "Units",
    to: "/units",
    icon: Units,
    match: (path) => path === "/units" || path.startsWith("/units/"),
  },
  {
    label: "Sessions",
    to: "/sessions",
    icon: Sessions,
    match: (path) => path.startsWith("/sessions"),
  },
   {
    label: "Interactions",
    to: "/interactions",
    icon: Sessions,
    match: (path) => path.startsWith("/interactions"),
  },
];

export function AppSidebar() {
  const { user, role, signOutUser } = useAuth();
  const location = useLocation();

  const handleLogout = () => void signOutUser();

  return (
    <Sidebar collapsible="icon" className="border-r">
      {/* Brand */}
      <SidebarHeader className="border-b px-4 py-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg">
              <Link to="/" className="flex items-center gap-2">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg">
                  <img
                    src="/oc-icon.svg"
                    alt="Opencharge"
                    className="size-8"
                  />
                </div>
                <span className="truncate text-sm font-semibold">
                  Opencharge Admin
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Nav Items */}
      <SidebarContent className="py-2">
        <SidebarGroup>
          <SidebarGroupLabel className="sr-only">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = item.match(location.pathname);
                const Icon = item.icon;

                return (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link to={item.to} className="flex items-center gap-2">
                        <Icon className="h-5 w-5" />
                        <span className="text-sm font-medium">{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="border-t p-4">
        {user ? (
          <NavUser user={user} role={role} onLogout={handleLogout} />
        ) : null}
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}