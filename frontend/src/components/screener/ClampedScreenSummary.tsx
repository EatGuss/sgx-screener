import { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ClampedScreenSummaryProps {
  text: string;
  className?: string;
}

/**
 * True when `el`'s full wrapped height exceeds its clamped box.
 *
 * Naive `scrollHeight > clientHeight` is unreliable for `-webkit-line-clamp` /
 * Tailwind `line-clamp-*` (`display: -webkit-box` / `flow-root`): many engines
 * report equal heights even when text is visually truncated. Compare against an
 * unclamped clone at the same width instead.
 */
function isVisuallyClamped(el: HTMLElement): boolean {
  const width = el.getBoundingClientRect().width;
  if (width <= 0) return false;

  const clone = el.cloneNode(true) as HTMLElement;
  clone.className = el.className.replace(/\bline-clamp-\d+\b/g, "");
  clone.style.cssText = [
    "position:absolute",
    "left:-9999px",
    "top:0",
    "visibility:hidden",
    "pointer-events:none",
    "height:auto",
    "max-height:none",
    "overflow:visible",
    "display:block",
    "-webkit-line-clamp:unset",
    "-webkit-box-orient:unset",
    `width:${width}px`,
  ].join(";");
  // Keep out of a11y tree while measuring.
  clone.setAttribute("aria-hidden", "true");
  document.body.appendChild(clone);
  const fullHeight = clone.scrollHeight;
  clone.remove();

  return fullHeight > el.clientHeight + 1;
}

/**
 * Two-line clamped screen description. Shows a styled shadcn tooltip with the
 * full text only when the clamp actually truncates (Home cards + Open screen).
 */
export function ClampedScreenSummary({
  text,
  className,
}: ClampedScreenSummaryProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [clamped, setClamped] = useState(false);
  const [open, setOpen] = useState(false);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const next = isVisuallyClamped(el);
    setClamped(next);
    if (!next) setOpen(false);
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        // Second frame: fonts / grid equalization often settle one paint later.
        requestAnimationFrame(measure);
      });
    };

    schedule();
    const ro = new ResizeObserver(schedule);
    ro.observe(el);

    const fontsReady = document.fonts?.ready;
    void fontsReady?.then(schedule);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [measure]);

  return (
    // Local provider so delay isn't forced to 0 by the app-wide TooltipProvider.
    <TooltipProvider delayDuration={250}>
      <Tooltip
        open={clamped && open}
        onOpenChange={(next) => {
          if (clamped) setOpen(next);
        }}
      >
        <TooltipTrigger asChild>
          <div
            ref={ref}
            className={cn(
              "line-clamp-2 leading-relaxed text-muted-foreground",
              // Ensure the trigger can receive hover even inside a parent <button>.
              "relative pointer-events-auto",
              className,
            )}
          >
            {text}
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          sideOffset={6}
          className={cn(
            // Above dialog overlay/content (both z-50); portal keeps it out of overflow clips.
            "z-[100] max-w-[320px] whitespace-normal rounded-md border border-border",
            "bg-popover px-3 py-2 text-left text-xs leading-relaxed text-popover-foreground shadow-md",
            "[&>svg]:hidden",
          )}
        >
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
