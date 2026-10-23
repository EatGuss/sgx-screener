import { formatAsOfDate } from "@/lib/screener/format";
import { cn } from "@/lib/utils";

interface DataFreshnessProps {
  /** ISO date YYYY-MM-DD from ResultsResponse.asOf; omit/null while loading. */
  asOf: string | null | undefined;
  className?: string;
}

/** Muted ingest freshness line (header or above results). */
export function DataFreshness({ asOf, className }: DataFreshnessProps) {
  if (!asOf) return null;

  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      Data as of {formatAsOfDate(asOf)} (end of day) · Updates nightly
    </p>
  );
}
