/**
 * Combines the ratio pass-through and technicals into the full set of
 * derived fields for one company's `screener_metrics` row. Pure — the
 * caller (the nightly job, not yet built) is responsible for fetching
 * `raw`/`bars` and persisting the result.
 */
import type { RawFundamentals } from "../ingest/yahoo/mapping";
import { computeRatioMetrics, type RatioMetrics } from "./ratios";
import { computeTechnicals, type PriceBar, type TechnicalsResult } from "./technicals";

export type ScreenerMetricsComputed = RatioMetrics & TechnicalsResult;

export function computeScreenerMetrics(
  raw: RawFundamentals,
  bars: readonly PriceBar[],
): ScreenerMetricsComputed {
  const ratios = computeRatioMetrics(raw);
  const technicals = computeTechnicals(bars, raw.price);
  return { ...ratios, ...technicals };
}
