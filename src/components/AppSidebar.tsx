import { NavLink, useLocation } from "react-router-dom";
import { Library, Disc3, Mic2, Heart, Radio, ListMusic, Sparkles } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";

const browse = [
  { title: "Discover", url: "/", icon: Sparkles },
  { title: "Albums", url: "/albums", icon: Disc3 },
  { title: "Artists", url: "/artists", icon: Mic2 },
  { title: "Library", url: "/library", icon: Library },
  { title: "Radio", url: "/radio", icon: Radio },
];

const personal = [
  { title: "Favourites", url: "/favourites", icon: Heart },
  { title: "Queue", url: "/queue", icon: ListMusic },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const isActive = (path: string) => (path === "/" ? pathname === "/" : pathname.startsWith(path));

  const itemCls = (active: boolean) =>
    `flex items-center gap-3 px-3 py-2 rounded-sm text-sm transition-colors ${
      active
        ? "bg-sidebar-accent text-sidebar-accent-foreground"
        : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
    }`;

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="px-4 pt-5 pb-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-sm bg-gold flex items-center justify-center shadow-gold">
            <span className="font-display text-lg text-primary-foreground leading-none">A</span>
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="font-display text-xl tracking-wide">Aurum</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">High Fidelity</div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="scrollbar-thin">
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground px-3">
              Browse
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {browse.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end={item.url === "/"} className={itemCls(isActive(item.url))}>
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="font-medium">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground px-3">
              You
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {personal.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className={itemCls(isActive(item.url))}>
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="font-medium">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
