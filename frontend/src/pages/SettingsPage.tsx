import { ScreenerAppShell } from "@/components/ScreenerAppShell";
import { SidebarTrigger } from "@/components/ui/sidebar";
import ScreenerSettings from "@/pages/Settings/ScreenerSettings";

export default function SettingsPage() {
  return (
    <ScreenerAppShell>
      <header className="flex h-12 items-center border-b px-3">
        <SidebarTrigger />
      </header>
      <div className="overflow-y-auto p-6">
        <ScreenerSettings />
      </div>
    </ScreenerAppShell>
  );
}
