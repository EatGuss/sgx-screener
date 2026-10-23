import { Info, X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Shared surface for staged NL parse / refine proposals. */
export const nlProposalSurfaceClassName =
  "rounded-md border border-border bg-card text-card-foreground shadow-xs";

export function splitNlWarnings(warnings?: string[]): {
  product: string[];
  stub: string[];
} {
  const product: string[] = [];
  const stub: string[] = [];
  for (const w of warnings ?? []) {
    if (/NL_PARSE_STUB|NL parse stub|NL refine stub/i.test(w)) stub.push(w);
    else product.push(w);
  }
  return { product, stub };
}

export function NlProposalWarnings({
  product,
  stub,
}: {
  product: string[];
  stub: string[];
}) {
  if (product.length === 0 && stub.length === 0) return null;

  return (
    <div className="space-y-1">
      {product.map((w) => (
        <p
          key={w}
          className="flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground"
        >
          <Info className="mt-0.5 size-3 shrink-0 opacity-70" aria-hidden />
          <span>{w}</span>
        </p>
      ))}
      {stub.map((w) => (
        <p
          key={w}
          className="font-mono text-[10px] leading-snug text-muted-foreground/70"
        >
          <span className="mr-1.5 rounded border border-border px-1 py-px text-[9px] uppercase tracking-wide text-muted-foreground/60">
            dev
          </span>
          {w}
        </p>
      ))}
    </div>
  );
}

interface NlProposalPanelProps {
  title: string;
  subtitle: string;
  ariaLabel: string;
  onDiscard: () => void;
  onApply: () => void;
  applyLabel: string;
  applyDisabled?: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * Shared chrome for staged NL proposals — header + primary/secondary actions,
 * scrollable body supplied by the caller.
 */
export function NlProposalPanel({
  title,
  subtitle,
  ariaLabel,
  onDiscard,
  onApply,
  applyLabel,
  applyDisabled = false,
  children,
  className,
}: NlProposalPanelProps) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-col gap-2.5 px-3 py-2.5",
        nlProposalSurfaceClassName,
        className,
      )}
      role="region"
      aria-label={ariaLabel}
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <div className="min-w-0">
          <p className="text-xs font-medium leading-none text-foreground">
            {title}
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            {subtitle}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="h-7 px-2.5 text-xs"
            onClick={onDiscard}
          >
            Discard
          </Button>
          <Button
            type="button"
            variant="default"
            size="xs"
            className="h-7 px-2.5 text-xs font-medium"
            disabled={applyDisabled}
            onClick={onApply}
          >
            {applyLabel}
          </Button>
        </div>
      </div>
      {children}
    </div>
  );
}

interface NlProposalEmptyProps {
  onDismiss: () => void;
  children: ReactNode;
  className?: string;
}

/** Model returned nothing applicable — keep the explanatory message. */
export function NlProposalEmpty({
  onDismiss,
  children,
  className,
}: NlProposalEmptyProps) {
  return (
    <div
      className={cn(
        "space-y-2 px-3 py-2.5",
        nlProposalSurfaceClassName,
        className,
      )}
      role="status"
    >
      {children}
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className="h-7 px-2.5 text-xs"
        onClick={onDismiss}
      >
        Dismiss
      </Button>
    </div>
  );
}

interface NlProposalItemProps {
  children: ReactNode;
  /** Dimmed / struck appearance (e.g. rejected refine row). */
  muted?: boolean;
  onRemove?: () => void;
  removeLabel?: string;
  /** Extra trailing controls (e.g. accept) before the shared remove control. */
  trailing?: ReactNode;
  className?: string;
}

/**
 * Shared row/chip shell for proposed items — same shape, type, remove control.
 */
export function NlProposalItem({
  children,
  muted = false,
  onRemove,
  removeLabel = "Remove",
  trailing,
  className,
}: NlProposalItemProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs leading-snug",
        muted
          ? "border-dashed border-border/70 bg-muted/25 text-muted-foreground opacity-70"
          : "border-border bg-secondary/55 text-foreground",
        className,
      )}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {trailing}
      {onRemove ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6 shrink-0 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={removeLabel}
          onClick={onRemove}
        >
          <X className="size-3.5" />
        </Button>
      ) : null}
    </div>
  );
}
