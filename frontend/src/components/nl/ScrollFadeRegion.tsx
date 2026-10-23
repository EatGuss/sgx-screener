import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

interface ScrollFadeRegionProps {
  children: ReactNode;
  /** Outer shell — use for flex-1 / min-h-0 in a column layout. */
  className?: string;
  /**
   * Classes on the scrolling element (e.g. max-h-[…] for standalone panels).
   * max-height must live here with overflow-y-auto so scrolling engages.
   */
  contentClassName?: string;
  /**
   * Fade color — should match the panel surface so masks blend in.
   * Defaults to card (proposal panels).
   */
  fadeFromClassName?: string;
}

/**
 * Vertically scrollable region with a thin app scrollbar and top/bottom
 * gradient masks when more content is available above/below.
 */
export function ScrollFadeRegion({
  children,
  className,
  contentClassName,
  fadeFromClassName = "from-card",
}: ScrollFadeRegionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [showTop, setShowTop] = useState(false);
  const [showBottom, setShowBottom] = useState(false);

  const updateFades = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    setShowTop(scrollTop > 1);
    setShowBottom(scrollTop + clientHeight < scrollHeight - 1);
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    updateFades();
    const ro = new ResizeObserver(() => updateFades());
    ro.observe(el);
    // Also watch content size changes inside the scroller.
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    el.addEventListener("scroll", updateFades, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", updateFades);
    };
  }, [updateFades, children]);

  return (
    <div className={cn("relative flex min-h-0 flex-col", className)}>
      <div
        ref={ref}
        className={cn(
          "scrollbar-app min-h-0 flex-1 overflow-y-auto overscroll-contain",
          contentClassName,
        )}
      >
        {children}
      </div>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 z-10 h-5 bg-gradient-to-b to-transparent transition-opacity",
          fadeFromClassName,
          showTop ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 z-10 h-5 bg-gradient-to-t to-transparent transition-opacity",
          fadeFromClassName,
          showBottom ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}
