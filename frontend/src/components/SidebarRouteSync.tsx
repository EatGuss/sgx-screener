import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useSidebar } from "@/components/ui/sidebar";
import { loadScreenerSettings } from "@/lib/screener/settings";

/** Screener home + builder — paths that should start with a collapsed sidebar. */
export function isScreenerRoute(pathname: string): boolean {
  return pathname === "/screener" || pathname.startsWith("/screener/");
}

/**
 * Collapses the app sidebar when *entering* a screener route (if the screener
 * preference allows it), and expands it again when leaving. Navigating between
 * screener pages (home ↔ builder) does not re-apply the default, so a manual
 * expand sticks until you leave screener.
 */
export function SidebarRouteSync() {
  const { pathname } = useLocation();
  const { setOpen } = useSidebar();
  // Start false so a direct load of /screener counts as "entering".
  const wasScreenerRef = useRef(false);

  useEffect(() => {
    const isScreener = isScreenerRoute(pathname);
    const wasScreener = wasScreenerRef.current;

    if (isScreener && !wasScreener) {
      if (loadScreenerSettings().autoCollapseSidebar) {
        setOpen(false);
      }
    } else if (!isScreener && wasScreener) {
      setOpen(true);
    }

    wasScreenerRef.current = isScreener;
  }, [pathname, setOpen]);

  return null;
}
