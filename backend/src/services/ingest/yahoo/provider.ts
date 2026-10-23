/**
 * The yahoo-finance2 adapter — the single implementation of both provider
 * interfaces for v1. The nightly job calls these; nothing else talks to Yahoo
 * directly. Because the rest of the pipeline depends only on these interfaces,
 * swapping to a paid provider later (EODHD / Twelve Data) is a new class here,
 * not a rewrite.
 *
 * Resilience is built in (Yahoo is unofficial): a minimum delay between calls
 * to avoid IP blocks, and exponential-backoff retries on transient failures.
 */
import YahooFinance from "yahoo-finance2";
import { mapFundamentals, type RawFundamentals } from "./mapping";
import {
  mapFundamentalsHistory,
  type RawFundamentalsHistoryRow,
} from "./mappingHistory";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

/** One day of OHLCV. */
export interface DailyBar {
  date: Date;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  adjClose: number | null;
  volume: number | null;
}

/** Raw shape of a yahoo-finance2 chart() quote row (subset we use). */
interface RawChartQuote {
  date: Date;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  adjclose: number | null;
  volume: number | null;
}

export interface FundamentalsProvider {
  fetchFundamentals(ticker: string): Promise<RawFundamentals>;
}

export interface PriceProvider {
  fetchDailyBars(ticker: string, from: Date, to: Date): Promise<DailyBar[]>;
}

export interface FundamentalsHistoryProvider {
  fetchFundamentalsHistory(ticker: string): Promise<RawFundamentalsHistoryRow[]>;
}

const QS_MODULES = [
  "price",
  "summaryDetail",
  "defaultKeyStatistics",
  "financialData",
  "summaryProfile",
] as const;

interface YahooProviderOptions {
  /** Minimum gap between any two Yahoo calls (ms). Avoids rate-limit blocks. */
  minDelayMs?: number;
  /** Max retry attempts on transient failure. */
  maxRetries?: number;
  /** Base backoff (ms); doubles each retry. */
  backoffBaseMs?: number;
}

export class YahooProvider
  implements FundamentalsProvider, PriceProvider, FundamentalsHistoryProvider
{
  private readonly yahooFinance: InstanceType<typeof YahooFinance>;
  private readonly minDelayMs: number;
  private readonly maxRetries: number;
  private readonly backoffBaseMs: number;
  private lastCallAt = 0;

  constructor(opts: YahooProviderOptions = {}) {
    this.yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });
    this.minDelayMs = opts.minDelayMs ?? 1200;
    this.maxRetries = opts.maxRetries ?? 4;
    this.backoffBaseMs = opts.backoffBaseMs ?? 1000;
  }

  async fetchFundamentals(ticker: string): Promise<RawFundamentals> {
    const qs = await this.call(() =>
      this.yahooFinance.quoteSummary(ticker, { modules: [...QS_MODULES] }),
    );
    return mapFundamentals(ticker, qs);
  }

  async fetchDailyBars(ticker: string, from: Date, to: Date): Promise<DailyBar[]> {
    const result = (await this.call(() =>
      this.yahooFinance.chart(ticker, { period1: from, period2: to, interval: "1d" }),
    )) as { quotes: RawChartQuote[] };
    return (result.quotes ?? []).map((q) => ({
      date: q.date,
      open: q.open ?? null,
      high: q.high ?? null,
      low: q.low ?? null,
      close: q.close ?? null,
      adjClose: q.adjclose ?? null,
      volume: q.volume ?? null,
    }));
  }

  /**
   * Annual financial-statement history (income statement + balance sheet +
   * cash flow) for the `fundamentals` table. Uses `fundamentalsTimeSeries`,
   * not the deprecated quoteSummary statement modules (incomeStatementHistory
   * etc. have provided almost no data since Nov 2024 per Yahoo's own runtime
   * warning). Leaves fetchFundamentals/mapFundamentals untouched.
   */
  async fetchFundamentalsHistory(ticker: string): Promise<RawFundamentalsHistoryRow[]> {
    const rows = await this.fetchFundamentalsTimeSeriesRaw(ticker);
    return mapFundamentalsHistory(ticker, rows as any[]);
  }

  /** Raw fundamentalsTimeSeries payload — for caching before mapping. */
  async fetchFundamentalsTimeSeriesRaw(ticker: string): Promise<unknown[]> {
    return (await this.call(() =>
      this.yahooFinance.fundamentalsTimeSeries(ticker, {
        period1: "2015-01-01",
        type: "annual",
        module: "all",
      }),
    )) as unknown[];
  }

  /** quoteSummary with caller-chosen modules; shares throttle/backoff with other methods. */
  async fetchQuoteSummary(
    ticker: string,
    modules: readonly string[],
  ): Promise<Record<string, unknown>> {
    return (await this.call(() =>
      // Caller-chosen modules aren't statically known to be valid
      // QuoteSummaryModules — callers (validation/cleanup scripts) are
      // responsible for passing real Yahoo module names.
      this.yahooFinance.quoteSummary(ticker, { modules: [...modules] as any }),
    )) as Record<string, unknown>;
  }

  /** Symbol search; shares throttle/backoff with other methods. */
  async search(query: string): Promise<Record<string, unknown>> {
    return (await this.call(() =>
      this.yahooFinance.search(query),
    )) as Record<string, unknown>;
  }

  /** Throttle + exponential-backoff wrapper around a single Yahoo call. */
  private async call<T>(fn: () => Promise<T>): Promise<T> {
    await this.throttle();
    let lastErr: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        if (attempt === this.maxRetries) break;
        const wait = this.backoffBaseMs * 2 ** attempt;
        await sleep(wait);
      }
    }
    throw lastErr;
  }

  private async throttle(): Promise<void> {
    const elapsed = Date.now() - this.lastCallAt;
    if (elapsed < this.minDelayMs) await sleep(this.minDelayMs - elapsed);
    this.lastCallAt = Date.now();
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
