/**
 * Technical indicators derived purely from a daily price series (`daily_prices`
 * rows for one company). Every export here is a pure function: no DB access,
 * no network call, deterministic given its inputs. The nightly job (not yet
 * built) is responsible for loading the series and persisting the output.
 *
 * CONVENTION (matches screener-contract): percent/ratio outputs are decimal
 * fractions (0.02 = 2%), not whole percents.
 */

/** One day of price data. `high`/`low` are optional — callers without OHLC (e.g. only close) fall back to `close`. */
export interface PriceBar {
  date: string; // ISO yyyy-mm-dd
  close: number;
  high?: number | null;
  low?: number | null;
  volume?: number | null;
}

function sortByDateAsc(bars: readonly PriceBar[]): PriceBar[] {
  return [...bars].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

function closesAsc(bars: readonly PriceBar[]): number[] {
  return sortByDateAsc(bars).map((b) => b.close);
}

/**
 * RSI(14) using Cutler's simple-moving-average variant (average gain/loss
 * over the trailing 14 changes), not Wilder's exponential smoothing. Chosen
 * because it depends only on the last 15 closes — deterministic and easy to
 * hand-verify — rather than on the entire price history via recursive
 * smoothing. Requires at least 15 closes (14 changes); otherwise null.
 */
export function computeRsi14(bars: readonly PriceBar[]): number | null {
  const closes = closesAsc(bars);
  if (closes.length < 15) return null;

  const window = closes.slice(-15);
  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i < window.length; i++) {
    const change = window[i]! - window[i - 1]!;
    if (change > 0) gainSum += change;
    else lossSum += -change;
  }

  const avgGain = gainSum / 14;
  const avgLoss = lossSum / 14;
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;

  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/** Simple moving average of the last `window` closes. Null if fewer than `window` bars exist. */
export function computeSma(bars: readonly PriceBar[], window: number): number | null {
  const closes = closesAsc(bars);
  if (closes.length < window) return null;
  const slice = closes.slice(-window);
  return slice.reduce((sum, v) => sum + v, 0) / window;
}

/** (price - ma) / ma. Null if `ma` is null/zero or `price` is null. */
export function computePriceVsMa(price: number | null, ma: number | null): number | null {
  if (price === null || ma === null || ma === 0) return null;
  return (price - ma) / ma;
}

/** Highest daily high (falls back to close) over the trailing `tradingDays` bars. Null if no bars. */
export function compute52wHigh(
  bars: readonly PriceBar[],
  tradingDays = 252,
): number | null {
  const sorted = sortByDateAsc(bars).slice(-tradingDays);
  if (sorted.length === 0) return null;
  return Math.max(...sorted.map((b) => b.high ?? b.close));
}

/** Lowest daily low (falls back to close) over the trailing `tradingDays` bars. Null if no bars. */
export function compute52wLow(
  bars: readonly PriceBar[],
  tradingDays = 252,
): number | null {
  const sorted = sortByDateAsc(bars).slice(-tradingDays);
  if (sorted.length === 0) return null;
  return Math.min(...sorted.map((b) => b.low ?? b.close));
}

/** (price - high) / high — zero or negative when at/below the high. Null if either input missing/zero. */
export function computePctFromHigh(price: number | null, high: number | null): number | null {
  if (price === null || high === null || high === 0) return null;
  return (price - high) / high;
}

/** (price - low) / low — zero or positive when at/above the low. Null if either input missing/zero. */
export function computePctFromLow(price: number | null, low: number | null): number | null {
  if (price === null || low === null || low === 0) return null;
  return (price - low) / low;
}

/** Average of the last `window` non-null volumes. Null if no volume data is available. */
export function computeAvgVolume(bars: readonly PriceBar[], window = 30): number | null {
  const sorted = sortByDateAsc(bars).slice(-window);
  const volumes = sorted
    .map((b) => b.volume)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (volumes.length === 0) return null;
  return volumes.reduce((sum, v) => sum + v, 0) / volumes.length;
}

/**
 * (latestClose - closeNBarsAgo) / closeNBarsAgo, comparing the latest bar to
 * the bar `tradingDaysBack` positions earlier in the sorted series. Null if
 * there aren't enough bars or the reference close is zero.
 */
export function computePerfOverTradingDays(
  bars: readonly PriceBar[],
  tradingDaysBack: number,
): number | null {
  const closes = closesAsc(bars);
  if (closes.length <= tradingDaysBack) return null;
  const latest = closes[closes.length - 1]!;
  const past = closes[closes.length - 1 - tradingDaysBack]!;
  if (past === 0) return null;
  return (latest - past) / past;
}

/**
 * Year-to-date performance: latest close vs. the last close strictly before
 * Jan 1 of the latest bar's year (i.e. the prior year-end close). If the
 * series doesn't reach back into the prior year, falls back to the first
 * close in the series (best-effort for young/thin histories).
 */
export function computePerfYtd(bars: readonly PriceBar[]): number | null {
  const sorted = sortByDateAsc(bars);
  if (sorted.length === 0) return null;

  const latest = sorted[sorted.length - 1]!;
  const latestYear = latest.date.slice(0, 4);

  let baseline: number | null = null;
  for (let i = sorted.length - 2; i >= 0; i--) {
    if (sorted[i]!.date.slice(0, 4) < latestYear) {
      baseline = sorted[i]!.close;
      break;
    }
  }
  if (baseline === null) baseline = sorted[0]!.close;

  if (baseline === 0) return null;
  return (latest.close - baseline) / baseline;
}

/** Last `window` closes, chronological ascending, for the row sparkline. */
export function computeSparkline(bars: readonly PriceBar[], window = 30): number[] {
  return closesAsc(bars).slice(-window);
}

/** Full technicals row for `screener_metrics`, computed from one company's price series. */
export interface TechnicalsResult {
  price: number | null;
  pctFrom52wHigh: number | null;
  pctFrom52wLow: number | null;
  priceVs50ma: number | null;
  priceVs200ma: number | null;
  rsi14: number | null;
  avgVolume30d: number | null;
  perf1d: number | null;
  perf1w: number | null;
  perf1m: number | null;
  perfYtd: number | null;
  perf1y: number | null;
  sparkline30d: number[];
}

/**
 * Composes all technicals for one company. `currentPrice` defaults to the
 * latest bar's close when omitted (e.g. when a live quote price isn't
 * available for this pass).
 */
export function computeTechnicals(
  bars: readonly PriceBar[],
  currentPrice?: number | null,
): TechnicalsResult {
  const sorted = sortByDateAsc(bars);
  const latestClose = sorted.length > 0 ? sorted[sorted.length - 1]!.close : null;
  const price = currentPrice ?? latestClose;

  const ma50 = computeSma(sorted, 50);
  const ma200 = computeSma(sorted, 200);
  const high52w = compute52wHigh(sorted);
  const low52w = compute52wLow(sorted);

  return {
    price,
    pctFrom52wHigh: computePctFromHigh(price, high52w),
    pctFrom52wLow: computePctFromLow(price, low52w),
    priceVs50ma: computePriceVsMa(price, ma50),
    priceVs200ma: computePriceVsMa(price, ma200),
    rsi14: computeRsi14(sorted),
    avgVolume30d: computeAvgVolume(sorted, 30),
    perf1d: computePerfOverTradingDays(sorted, 1),
    perf1w: computePerfOverTradingDays(sorted, 5),
    perf1m: computePerfOverTradingDays(sorted, 21),
    perfYtd: computePerfYtd(sorted),
    perf1y: computePerfOverTradingDays(sorted, 252),
    sparkline30d: computeSparkline(sorted, 30),
  };
}
