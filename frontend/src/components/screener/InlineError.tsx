import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface InlineErrorProps {
  message: string;
  onRetry?: () => void;
  /** Compact bar above content vs centered first-load panel. */
  variant?: "banner" | "panel";
  className?: string;
}

/** Inline API failure with optional retry — distinct from empty results. */
export function InlineError({
  message,
  onRetry,
  variant = "panel",
  className,
}: InlineErrorProps) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-md border border-destructive/30 bg-destructive/5",
        variant === "panel"
          ? "flex flex-col items-center justify-center gap-3 px-4 py-10 text-center"
          : "flex flex-row flex-wrap items-center justify-between gap-3 px-3 py-2.5 text-left",
        className,
      )}
    >
      <p
        className={cn(
          "text-sm text-destructive",
          variant === "panel" && "max-w-sm",
        )}
      >
        {message}
      </p>
      {onRetry && (
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}
