import type { ScreenerField } from "screener-contract";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatRowMetric } from "@/lib/screener/column-presets";

const NULL_METRIC_HINT = "Not available from data source";

interface MetricValueProps {
  field: ScreenerField;
  value: number | null | undefined;
  className?: string;
}

/**
 * Formatted metric, or an em dash with a tooltip when the source has no value
 * (e.g. PEG for REITs, ROA for banks) — distinct from a load failure.
 */
export function MetricValue({ field, value, className }: MetricValueProps) {
  if (value != null && Number.isFinite(value)) {
    return <span className={className}>{formatRowMetric(field, value)}</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={
            className ??
            "cursor-help text-muted-foreground underline decoration-dotted decoration-muted-foreground/40 underline-offset-2"
          }
          tabIndex={0}
          aria-label={NULL_METRIC_HINT}
        >
          —
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        {NULL_METRIC_HINT}
      </TooltipContent>
    </Tooltip>
  );
}
