import { cn } from "@/lib/utils";
import { useScreenSpec } from "@/hooks/useScreenSpec";

interface LiveCountBadgeProps {
  count: number | null;
  loading: boolean;
  error: string | null;
  className?: string;
}

/** Live match count from the debounced count endpoint. */
export function LiveCountBadge({
  count,
  loading,
  error,
  className,
}: LiveCountBadgeProps) {
  const { excludeTicker } = useScreenSpec();

  if (loading && count === null && !error) {
    return (
      <p
        className={cn(
          "flex items-center gap-2 text-sm text-muted-foreground",
          className,
        )}
      >
        <span
          className="inline-block size-3 shrink-0 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground"
          aria-hidden
        />
        Counting…
      </p>
    );
  }

  const displayCount =
    count != null && excludeTicker ? Math.max(0, count - 1) : count;

  return (
    <p
      className={cn(
        "flex items-center gap-2 text-sm",
        error && "text-destructive",
        !error && loading && "opacity-60",
        className,
      )}
      aria-busy={loading || undefined}
    >
      {loading && !error && (
        <span
          className="inline-block size-3 shrink-0 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground"
          aria-hidden
        />
      )}
      {error && count == null ? (
        <span>Count unavailable</span>
      ) : (
        <span>
          <span className="font-medium tabular-nums">{displayCount ?? "—"}</span>
          <span className={error ? undefined : "text-muted-foreground"}>
            {" "}
            stocks match
          </span>
          {error && <span className="font-normal"> (may be stale)</span>}
        </span>
      )}
    </p>
  );
}
