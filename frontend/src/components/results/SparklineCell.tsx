import type { StockRow } from "screener-contract";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SparklineCellProps {
  values: StockRow["sparkline"] | null | undefined;
  /** Used to tint the line up/down when present. */
  perf1y?: number | null;
}

/**
 * Inline SVG sparkline — one lightweight polyline per row.
 * Empty / single-point / non-finite arrays render an em dash (never crash).
 */
export function SparklineCell({ values, perf1y }: SparklineCellProps) {
  const series =
    Array.isArray(values) ?
      values.filter((v): v is number => typeof v === "number" && Number.isFinite(v))
    : [];

  if (series.length < 2) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="cursor-help text-muted-foreground underline decoration-dotted decoration-muted-foreground/40 underline-offset-2"
            tabIndex={0}
            aria-label="Not available from data source"
          >
            —
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4}>
          Not available from data source
        </TooltipContent>
      </Tooltip>
    );
  }

  const width = 72;
  const height = 24;
  const padY = 2;

  let min = series[0]!;
  let max = series[0]!;
  for (const v of series) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min || 1;

  const points = series
    .map((v, i) => {
      const x = (i / (series.length - 1)) * width;
      const y = height - padY - ((v - min) / range) * (height - padY * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  // CSS var references — theme-safe for inline SVG strokes.
  const stroke =
    perf1y == null || !Number.isFinite(perf1y)
      ? "currentColor"
      : perf1y >= 0
        ? "var(--up)"
        : "var(--down)";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="inline-block text-muted-foreground"
      aria-hidden
    >
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points}
      />
    </svg>
  );
}
