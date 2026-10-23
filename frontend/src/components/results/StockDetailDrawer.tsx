import {
  useCallback,
  useEffect,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  FIELD_DEFS,
  FIELD_GROUPS,
  type StockDetailResponse,
  type StockRow,
} from "screener-contract";
import { PriceChart } from "@/components/results/PriceChart";
import { ChartErrorBoundary } from "@/components/results/ChartErrorBoundary";
import { MetricValue } from "@/components/results/MetricValue";
import { InlineError } from "@/components/screener/InlineError";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { useScreenSpec } from "@/hooks/useScreenSpec";
import { useScreenerSettings } from "@/hooks/useScreenerSettings";
import { getScreenerApi } from "@/lib/screener/api";
import { formatPercent, formatSgd } from "@/lib/screener/format";
import {
  clampDetailDrawerWidth,
  DETAIL_DRAWER_WIDTH_MAX,
  DETAIL_DRAWER_WIDTH_MIN,
} from "@/lib/screener/settings";
import { buildSimilarSpec } from "@/lib/screener/similar";
import { cn } from "@/lib/utils";

interface StockDetailDrawerProps {
  ticker: string | null;
  /** Row snapshot for header while detail loads (optional). */
  row?: StockRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const GROUP_ORDER = [
  "Identity",
  "Valuation",
  "Profitability",
  "Growth",
  "Financial Health",
  "Dividends",
  "Price & Technicals",
  "Volume & Momentum",
] as const;

export function StockDetailDrawer({
  ticker,
  row,
  open,
  onOpenChange,
}: StockDetailDrawerProps) {
  const isMobile = useIsMobile();
  const { loadSpec } = useScreenSpec();
  const { settings, update } = useScreenerSettings();
  const [detail, setDetail] = useState<StockDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [findingSimilar, setFindingSimilar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [drawerWidth, setDrawerWidth] = useState(() =>
    clampDetailDrawerWidth(settings.detailDrawerWidth),
  );
  const [resizing, setResizing] = useState(false);

  const retry = useCallback(() => {
    setRetryKey((k) => k + 1);
  }, []);

  useEffect(() => {
    setDrawerWidth(clampDetailDrawerWidth(settings.detailDrawerWidth));
  }, [settings.detailDrawerWidth]);

  const onResizePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (isMobile) return;
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startW = drawerWidth;
      const el = e.currentTarget;
      el.setPointerCapture(e.pointerId);
      setResizing(true);

      const onMove = (ev: PointerEvent) => {
        // Dragging the left edge leftward increases width.
        setDrawerWidth(clampDetailDrawerWidth(startW + (startX - ev.clientX)));
      };
      const onUp = (ev: PointerEvent) => {
        try {
          el.releasePointerCapture(ev.pointerId);
        } catch {
          /* already released */
        }
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        setResizing(false);
        const next = clampDetailDrawerWidth(startW + (startX - ev.clientX));
        setDrawerWidth(next);
        update({ detailDrawerWidth: next });
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [drawerWidth, isMobile, update],
  );

  useEffect(() => {
    if (!open || !ticker) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetail(null);

    getScreenerApi()
      .getStockDetail(ticker)
      .then((res) => {
        if (cancelled) return;
        setDetail(res);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load stock");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, ticker, retryKey]);

  async function handleFindSimilar() {
    if (!detail) return;

    setFindingSimilar(true);
    try {
      const spec = buildSimilarSpec(detail);
      loadSpec(spec, {
        excludeTicker: detail.company.ticker,
        screenName: `Similar to ${detail.company.ticker}`,
        source: "untitled",
        screenId: null,
      });
      onOpenChange(false);
    } finally {
      setFindingSimilar(false);
    }
  }

  const price = detail?.fundamentals.price ?? row?.price ?? null;
  const perf1y = detail?.fundamentals.perf_1y ?? row?.perf1y ?? null;
  const name = detail?.company.name ?? row?.name ?? ticker ?? "";
  const sector = detail?.company.sector ?? null;
  const industry = detail?.company.industry ?? null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          "gap-0 overflow-y-auto overscroll-contain",
          isMobile
            ? "inset-x-0 h-[100dvh] max-h-[100dvh] w-full rounded-none border-0 p-0"
            : [
                // Beat Sheet's data-[side=right]:w-3/4 and sm:max-w-sm so
                // inline width is what the user actually sees while dragging.
                "w-auto max-w-none sm:max-w-none",
                "data-[side=right]:w-auto data-[side=right]:max-w-none",
                "data-[side=right]:sm:max-w-none",
                // Sheet defaults to transition-all; width must update instantly.
                resizing ? "transition-none" : "transition-[transform,opacity]",
              ],
        )}
        style={
          isMobile
            ? undefined
            : {
                width: drawerWidth,
                // Inline maxWidth wins over data-[side=right]:sm:max-w-sm.
                maxWidth: "100vw",
              }
        }
      >
        {!isMobile && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize detail panel"
            aria-valuemin={DETAIL_DRAWER_WIDTH_MIN}
            aria-valuemax={DETAIL_DRAWER_WIDTH_MAX}
            aria-valuenow={drawerWidth}
            onPointerDown={onResizePointerDown}
            className="absolute inset-y-0 -left-1 z-[60] w-3 cursor-col-resize touch-none hover:bg-border/70 active:bg-border"
          />
        )}
        <SheetHeader className="border-b text-left">
          <SheetTitle className="pr-8 font-mono text-base tabular-nums">
            {ticker}
          </SheetTitle>
          <SheetDescription className="text-base text-foreground">
            {name}
          </SheetDescription>
          {(sector || industry) && (
            <p className="text-xs text-muted-foreground">
              {[sector, industry].filter(Boolean).join(" · ")}
            </p>
          )}
          <div className="flex flex-wrap items-baseline gap-3 pt-1">
            <span className="text-lg font-medium tabular-nums">
              {formatSgd(price)}
            </span>
            <span
              className={cn(
                "text-sm tabular-nums",
                perf1y != null &&
                  Number.isFinite(perf1y) &&
                  (perf1y >= 0
                    ? "text-up"
                    : "text-down"),
              )}
            >
              {perf1y == null || !Number.isFinite(perf1y)
                ? "—"
                : `${perf1y > 0 ? "+" : ""}${formatPercent(perf1y)} 1Y`}
            </span>
          </div>
        </SheetHeader>

        <div className="min-w-0 space-y-6 p-4">
          {error && (
            <InlineError message={error} onRetry={retry} />
          )}

          {loading && !detail && !error && (
            <div
              className="space-y-6"
              aria-busy="true"
              aria-label="Loading stock detail"
            >
              <div className="min-w-0 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-64 w-full" />
              </div>
              <div className="space-y-3">
                <Skeleton className="h-4 w-28" />
                <div className="grid grid-cols-2 gap-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="space-y-1">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-5 w-20" />
                    </div>
                  ))}
                </div>
              </div>
              <Skeleton className="h-9 w-full" />
            </div>
          )}

          {detail && (
            <>
              {/*
                Single-column stack at all widths: chart on top, fundamentals
                below. Two-column was unreliable while the sheet max-width
                fought the resize handle (state width ≠ painted width).
              */}
              <section className="min-w-0 space-y-2">
                <h3 className="text-sm font-medium">Price history</h3>
                <ChartErrorBoundary
                  fallbackLabel="Couldn't load chart"
                  resetKey={ticker}
                >
                  <PriceChart
                    data={detail.priceHistory ?? []}
                    className="h-56 w-full min-w-0 max-w-full sm:h-64"
                  />
                </ChartErrorBoundary>
              </section>

              <section className="min-w-0 space-y-4">
                <h3 className="text-sm font-medium">Fundamentals</h3>
                {GROUP_ORDER.map((group) => {
                  const defs = (FIELD_GROUPS[group] ?? []).filter(
                    (d) => d.field in (detail.fundamentals ?? {}),
                  );
                  if (defs.length === 0) return null;
                  return (
                    <div key={group} className="space-y-2">
                      <h4 className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                        {group}
                      </h4>
                      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                        {defs.map((def) => {
                          const raw = detail.fundamentals?.[def.field];
                          const value =
                            typeof raw === "number" && Number.isFinite(raw)
                              ? raw
                              : null;
                          return (
                            <div key={def.field} className="min-w-0">
                              <dt className="truncate text-[11px] text-muted-foreground">
                                {FIELD_DEFS[def.field]?.label ?? def.field}
                              </dt>
                              <dd className="tabular-nums">
                                <MetricValue field={def.field} value={value} />
                              </dd>
                            </div>
                          );
                        })}
                      </dl>
                    </div>
                  );
                })}
              </section>

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button
                  type="button"
                  className="w-full sm:flex-1"
                  onClick={() => void handleFindSimilar()}
                  disabled={
                    findingSimilar ||
                    (!detail.company.sector &&
                      (detail.fundamentals?.market_cap == null ||
                        !Number.isFinite(detail.fundamentals.market_cap)))
                  }
                >
                  {findingSimilar ? "Finding…" : "Find similar stocks"}
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
