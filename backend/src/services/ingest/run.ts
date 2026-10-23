/**
 * Nightly ingestion orchestrator: iterate active companies, fetch from
 * Yahoo (with throttle/backoff via YahooProvider), compute metrics, upsert
 * screener_metrics / daily_prices / fundamentals. Per-ticker failures are
 * caught and logged — existing rows are never wiped on a bad night.
 */
import { eq } from "drizzle-orm";
import { db } from "../../db/drizzleClient";
import { companies } from "../../models/screener/companies";
import { computeScreenerMetrics } from "../compute/screenerMetricsRow";
import type { PriceBar } from "../compute/technicals";
import { DEFAULT_CACHE_DIR, YahooResponseCache } from "./cache";
import {
  deactivateMissingMarketCap,
  type CompletenessGuardResult,
} from "./completenessGuard";
import {
  crossCheckSampleCorporateActions,
  type CorporateActionWarning,
} from "./corporateActionCheck";
import {
  upsertDailyPrices,
  deleteDailyPricesAfter,
  upsertFundamentalsHistory,
  upsertScreenerMetrics,
  updateCompanyIdentity,
} from "./persist";
import { mapFundamentals } from "./yahoo/mapping";
import { mapFundamentalsHistory } from "./yahoo/mappingHistory";
import {
  endOfCompletedSession,
  filterBarsThroughAsOf,
  lastCompletedSgxTradingDay,
  barTradingDate,
} from "./sgxDate";
import { YahooProvider, type DailyBar } from "./yahoo/provider";

const QS_MODULES = [
  "price",
  "summaryDetail",
  "defaultKeyStatistics",
  "financialData",
  "summaryProfile",
] as const;

/** ~400 calendar days yields ~250 trading bars for SGX. */
const PRICE_HISTORY_DAYS = 400;

export interface IngestRunOptions {
  provider?: YahooProvider;
  cacheDir?: string;
  useCache?: boolean;
  /** Override clock (tests). */
  now?: Date;
}

export interface IngestRunResult {
  asOf: string;
  total: number;
  succeeded: number;
  failed: string[];
  corporateActionWarnings: CorporateActionWarning[];
  /** Active companies deactivated for null market_cap after this run. */
  completeness: CompletenessGuardResult;
}

function priceHistoryFrom(asOfEnd: Date): Date {
  const from = new Date(asOfEnd);
  from.setUTCDate(from.getUTCDate() - PRICE_HISTORY_DAYS);
  return from;
}

type CachedDailyBar = Omit<DailyBar, "date"> & { date: string };

function serializeDailyBars(bars: DailyBar[]): CachedDailyBar[] {
  return bars.map((b) => ({
    ...b,
    date: b.date.toISOString(),
  }));
}

function deserializeDailyBars(rows: CachedDailyBar[]): DailyBar[] {
  return rows.map((b) => ({
    ...b,
    date: new Date(b.date),
  }));
}

function toPriceBars(bars: DailyBar[]): PriceBar[] {
  return bars
    .filter((b) => b.close != null)
    .map((b) => ({
      date: barTradingDate(b.date),
      close: b.close!,
      high: b.high,
      low: b.low,
      volume: b.volume,
    }));
}

async function ingestOneCompany(
  companyId: number,
  ticker: string,
  asOf: string,
  provider: YahooProvider,
  cache: YahooResponseCache,
): Promise<void> {
  const qs = await cache.getOrSet(`${ticker}/quoteSummary.json`, () =>
    provider.fetchQuoteSummary(ticker, [...QS_MODULES]),
  );
  const raw = mapFundamentals(ticker, qs);

  // Fetch through the completed session end — never include an open session.
  const to = endOfCompletedSession(asOf);
  const from = priceHistoryFrom(to);
  const cachedBars = await cache.getOrSet(`${ticker}/dailyBars.json`, async () =>
    serializeDailyBars(await provider.fetchDailyBars(ticker, from, to)),
  );
  const dailyBars = filterBarsThroughAsOf(
    deserializeDailyBars(cachedBars),
    asOf,
  );

  const historyRaw = await cache.getOrSet(`${ticker}/fundamentalsTimeSeries.json`, () =>
    provider.fetchFundamentalsTimeSeriesRaw(ticker),
  );
  const historyRows = mapFundamentalsHistory(ticker, historyRaw as any[]);

  // EOD price = last completed bar close — never Yahoo's live regularMarketPrice.
  const priceBars = toPriceBars(dailyBars);
  const metrics = computeScreenerMetrics(
    { ...raw, price: null },
    priceBars,
  );

  await upsertScreenerMetrics(companyId, asOf, metrics);
  await updateCompanyIdentity(companyId, raw);
  await upsertDailyPrices(companyId, dailyBars);
  await deleteDailyPricesAfter(companyId, asOf);
  await upsertFundamentalsHistory(companyId, historyRows);
}

/** Thrown when cron / boot catch-up / manual run overlap — prevents double-writes. */
export class IngestAlreadyRunningError extends Error {
  constructor() {
    super("Ingest already in progress");
    this.name = "IngestAlreadyRunningError";
  }
}

/** In-process lock shared by cron, boot catch-up, and the manual CLI. */
let ingestInFlight = false;

export function isIngestRunning(): boolean {
  return ingestInFlight;
}

/**
 * Full nightly ingestion pass over all active companies. Never deletes rows —
 * a per-ticker failure leaves that company's previous data untouched.
 * `as_of` is always the latest *completed* SGX session (not "today" if open).
 *
 * Concurrent callers receive {@link IngestAlreadyRunningError} instead of
 * overlapping Yahoo fetches / upserts.
 */
export async function runNightlyIngestion(
  opts: IngestRunOptions = {},
): Promise<IngestRunResult> {
  if (ingestInFlight) {
    console.warn("[ingest] already in progress — skipping concurrent run");
    throw new IngestAlreadyRunningError();
  }
  ingestInFlight = true;
  try {
    return await runNightlyIngestionUnlocked(opts);
  } finally {
    ingestInFlight = false;
  }
}

async function runNightlyIngestionUnlocked(
  opts: IngestRunOptions,
): Promise<IngestRunResult> {
  const now = opts.now ?? new Date();
  const asOf = lastCompletedSgxTradingDay(now);
  const provider = opts.provider ?? new YahooProvider();
  const cache = new YahooResponseCache(
    opts.cacheDir ?? DEFAULT_CACHE_DIR,
    asOf,
    opts.useCache ?? true,
  );

  console.log(
    `[ingest] Starting nightly run asOf=${asOf} ` +
      `(last completed SGX session; wall=${now.toISOString()})`,
  );

  const corporateActionWarnings = await crossCheckSampleCorporateActions(provider);
  for (const w of corporateActionWarnings) {
    console.warn(`[ingest] corporate-action ${w.kind} ${w.ticker}: ${w.detail}`);
  }

  const active = await db
    .select({ id: companies.id, ticker: companies.ticker })
    .from(companies)
    .where(eq(companies.isActive, true))
    .orderBy(companies.ticker);

  const failed: string[] = [];
  let succeeded = 0;

  for (const [i, row] of active.entries()) {
    const label = `[ingest] (${i + 1}/${active.length}) ${row.ticker}`;
    try {
      await ingestOneCompany(row.id, row.ticker, asOf, provider, cache);
      succeeded++;
      console.log(`${label} OK`);
    } catch (err) {
      failed.push(row.ticker);
      console.error(`${label} FAILED — keeping previous data:`, (err as Error).message);
    }
  }

  console.log(
    `[ingest] Done: ${succeeded}/${active.length} succeeded` +
      (failed.length ? `, failed: ${failed.join(", ")}` : ""),
  );

  // After metrics are written, drop names that still lack market_cap — they
  // cannot participate in size bucketing / default sort / market-cap filters.
  const completeness = await deactivateMissingMarketCap();

  return {
    asOf,
    total: active.length,
    succeeded,
    failed,
    corporateActionWarnings,
    completeness,
  };
}
