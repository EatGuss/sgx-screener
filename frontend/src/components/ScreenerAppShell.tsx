import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset } from "@/components/ui/sidebar";

/**
 * Screener pages historically had no app sidebar. This shell mounts AppSidebar
 * + SidebarInset under the ambient SidebarProvider so screener routes can
 * auto-collapse for full-width results while keeping the trigger available.
 */
export function ScreenerAppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppSidebar />
      <SidebarInset className="min-h-svh overflow-hidden">
        {children}
      </SidebarInset>
    </>
  );
}
