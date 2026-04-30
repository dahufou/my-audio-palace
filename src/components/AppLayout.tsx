import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { NowPlayingBar } from "@/components/NowPlayingBar";
import { Search } from "lucide-react";

export const AppLayout = ({ children }: { children: ReactNode }) => {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />

        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-3 px-4 border-b border-border bg-background/70 backdrop-blur-md sticky top-0 z-30">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
            <div className="h-5 w-px bg-border" />
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                placeholder="Search albums, artists, tracks…"
                className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground/70 focus:outline-none"
              />
            </div>
            <div className="hidden sm:flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              Lossless · 24-bit
            </div>
          </header>

          <main className="flex-1 overflow-y-auto scrollbar-thin">{children}</main>

          <NowPlayingBar />
        </div>
      </div>
    </SidebarProvider>
  );
};
