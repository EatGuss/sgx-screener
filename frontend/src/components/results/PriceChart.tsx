import { useEffect, useRef, useState } from "react";
import {
  ColorType,
  CrosshairMode,
  createChart,
  type IChartApi,
} from "lightweight-charts";

interface PricePoint {
  date: string;
  close: number;
}

interface PriceChartProps {
  data: PricePoint[];
  className?: string;
}

/**
 * Canvas-safe dark palette — lightweight-charts only accepts hex / rgb / rgba,
 * never oklch() or CSS variables.
 */
const CHART_COLORS = {
  background: "#131722",
  text: "#787b86",
  grid: "rgba(255, 255, 255, 0.05)",
  crosshair: "rgba(255, 255, 255, 0.22)",
  border: "#2a2e39",
  line: "#2962ff",
  areaTop: "rgba(41, 98, 255, 0.30)",
  areaBottom: "rgba(41, 98, 255, 0.02)",
} as const;

function sanitizePoints(
  data: PricePoint[],
): { time: `${number}-${number}-${number}`; value: number }[] {
  const out: { time: `${number}-${number}-${number}`; value: number }[] = [];
  for (const p of data) {
    if (!p?.date || typeof p.close !== "number" || !Number.isFinite(p.close)) {
      continue;
    }
    out.push({
      time: p.date as `${number}-${number}-${number}`,
      value: p.close,
    });
  }
  return out;
}

/**
 * Single large price chart for the detail drawer.
 * Explicitly resizes to the container width so mobile full-screen sheets
 * don't overflow (autoSize alone can miss the first layout pass).
 */
export function PriceChart({ data, className }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const hasRenderablePoints = sanitizePoints(data).length > 0;

  useEffect(() => {
    setFailed(false);
    const el = containerRef.current;
    const points = sanitizePoints(data);
    if (!el || points.length === 0) return;

    let chart: IChartApi | null = null;
    let ro: ResizeObserver | null = null;

    try {
      const width = Math.max(el.clientWidth, 1);
      const height = Math.max(el.clientHeight, 200);

      chart = createChart(el, {
        width,
        height,
        layout: {
          background: { type: ColorType.Solid, color: CHART_COLORS.background },
          textColor: CHART_COLORS.text,
        },
        grid: {
          vertLines: { color: CHART_COLORS.grid },
          horzLines: { color: CHART_COLORS.grid },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: {
            color: CHART_COLORS.crosshair,
            labelBackgroundColor: CHART_COLORS.border,
          },
          horzLine: {
            color: CHART_COLORS.crosshair,
            labelBackgroundColor: CHART_COLORS.border,
          },
        },
        rightPriceScale: {
          borderVisible: true,
          borderColor: CHART_COLORS.border,
        },
        timeScale: {
          borderVisible: true,
          borderColor: CHART_COLORS.border,
        },
        localization: {
          priceFormatter: (price: number) =>
            `S$${price.toLocaleString("en-SG", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`,
        },
      });

      const series = chart.addAreaSeries({
        lineColor: CHART_COLORS.line,
        topColor: CHART_COLORS.areaTop,
        bottomColor: CHART_COLORS.areaBottom,
        lineWidth: 2,
      });

      series.setData(points);
      chart.timeScale().fitContent();

      const syncSize = () => {
        if (!chart || !el) return;
        const w = el.clientWidth;
        const h = el.clientHeight || height;
        if (w > 0) {
          chart.applyOptions({ width: w, height: h });
        }
      };

      // Sheet open animation: width may be 0 on first paint.
      requestAnimationFrame(syncSize);
      ro = new ResizeObserver(syncSize);
      ro.observe(el);
    } catch (err) {
      console.error("PriceChart failed:", err);
      setFailed(true);
      if (chart) {
        try {
          chart.remove();
        } catch {
          // ignore dispose errors
        }
        chart = null;
      }
    }

    return () => {
      ro?.disconnect();
      if (!chart) return;
      try {
        chart.remove();
      } catch {
        // ignore dispose errors on unmount
      }
    };
  }, [data]);

  if (failed) {
    return (
      <p className="rounded-md border border-border bg-muted/30 px-3 py-8 text-center text-sm text-muted-foreground">
        Couldn&apos;t load chart
      </p>
    );
  }

  if (!hasRenderablePoints) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No price history available.
      </p>
    );
  }

  return (
    <div
      ref={containerRef}
      className={className ?? "h-64 w-full min-w-0 max-w-full"}
    />
  );
}
