import { ChevronDown } from "lucide-react";
import { useScreenerSettings } from "@/hooks/useScreenerSettings";
import type { CollapsibleSectionId } from "@/lib/screener/settings";
import { cn } from "@/lib/utils";

interface CollapsibleScreenSectionProps {
  sectionId: CollapsibleSectionId;
  title: string;
  description?: string;
  /** Optional count badge next to the title. */
  count?: number;
  children: React.ReactNode;
  className?: string;
}

/**
 * Expand/collapse wrapper for Presets / My screens on Home and Open dialog.
 * Collapsed state is persisted in screener.settings.sectionCollapsed.
 */
export function CollapsibleScreenSection({
  sectionId,
  title,
  description,
  count,
  children,
  className,
}: CollapsibleScreenSectionProps) {
  const { settings, update } = useScreenerSettings();
  const collapsed = settings.sectionCollapsed[sectionId];

  function toggle() {
    update({
      sectionCollapsed: {
        ...settings.sectionCollapsed,
        [sectionId]: !collapsed,
      },
    });
  }

  return (
    <section className={cn("space-y-3", className)}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={!collapsed}
        className="flex w-full items-start gap-2 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronDown
          className={cn(
            "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform",
            collapsed && "-rotate-90",
          )}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-medium">{title}</h2>
            {typeof count === "number" && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {count}
              </span>
            )}
          </div>
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </button>
      {!collapsed ? <div>{children}</div> : null}
    </section>
  );
}
