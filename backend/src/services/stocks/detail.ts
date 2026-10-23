import { and, asc, eq } from "drizzle-orm";
import type { StockDetailResponse } from "screener-contract";
// Request-time read: runs on the read-only pool.
import { readDb as db } from "../../db/drizzleClient";
import { companies } from "../../models/screener/companies";
import { dailyPrices } from "../../models/screener/dailyPrices";
import { screenerMetrics } from "../../models/screener/screenerMetrics";
import { lastCompletedSgxTradingDay } from "../ingest/sgxDate";

/** Coerce pg numeric → number, preserving null. */
function parseNumeric(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function toIsoDate(value: string | Date | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

/**
 * Map screener_metrics columns → ScreenerField keys for the fundamentals record.
 * Identity fields live on `company`; sparkline/asOf are omitted here.
 */
function metricsToFundamentals(row: typeof screenerMetrics.$inferSelect): Record<
  string,
  number | null
> {
  return {
    market_cap: parseNumeric(row.marketCap),
    pe: parseNumeric(row.pe),
    pb: parseNumeric(row.pb),
    ps: parseNumeric(row.ps),
    peg: parseNumeric(row.peg),
    profit_margin: parseNumeric(row.profitMargin),
    operating_margin: parseNumeric(row.operatingMargin),
    roe: parseNumeric(row.roe),
    roa: parseNumeric(row.roa),
    eps: parseNumeric(row.eps),
    revenue_growth_yoy: parseNumeric(row.revenueGrowthYoy),
    earnings_growth_yoy: parseNumeric(row.earningsGrowthYoy),
    debt_to_equity: parseNumeric(row.debtToEquity),
    free_cash_flow: parseNumeric(row.freeCashFlow),
    fcf_margin: parseNumeric(row.fcfMargin),
    dividend_yield: parseNumeric(row.dividendYield),
    payout_ratio: parseNumeric(row.payoutRatio),
    price: parseNumeric(row.price),
    pct_from_52w_high: parseNumeric(row.pctFrom52wHigh),
    pct_from_52w_low: parseNumeric(row.pctFrom52wLow),
    price_vs_50ma: parseNumeric(row.priceVs50ma),
    price_vs_200ma: parseNumeric(row.priceVs200ma),
    rsi_14: parseNumeric(row.rsi14),
    avg_volume_30d: row.avgVolume30d ?? null,
    perf_1d: parseNumeric(row.perf1d),
    perf_1w: parseNumeric(row.perf1w),
    perf_1m: parseNumeric(row.perf1m),
    perf_ytd: parseNumeric(row.perfYtd),
    perf_1y: parseNumeric(row.perf1y),
  };
}

export class StockNotFoundError extends Error {
  constructor(ticker: string) {
    super(`Stock not found: ${ticker}`);
    this.name = "StockNotFoundError";
  }
}

/** Detail drawer payload for an active company. */
export async function getStockDetail(ticker: string): Promise<StockDetailResponse> {
  const companyRows = await db
    .select()
    .from(companies)
    .where(and(eq(companies.ticker, ticker), eq(companies.isActive, true)))
    .limit(1);

  const company = companyRows[0];
  if (!company) {
    throw new StockNotFoundError(ticker);
  }

  const [metricsRows, priceRows] = await Promise.all([
    db
      .select()
      .from(screenerMetrics)
      .where(eq(screenerMetrics.companyId, company.id))
      .limit(1),
    db
      .select({
        date: dailyPrices.date,
        close: dailyPrices.close,
      })
      .from(dailyPrices)
      .where(eq(dailyPrices.companyId, company.id))
      .orderBy(asc(dailyPrices.date)),
  ]);

  const metrics = metricsRows[0];
  const fundamentals = metrics
    ? metricsToFundamentals(metrics)
    : {};

  // Never serve an incomplete session bar (e.g. today's intraday quote).
  const chartAsOf = lastCompletedSgxTradingDay();
  const priceHistory = priceRows
    .map((p) => {
      const date = toIsoDate(p.date);
      const close = parseNumeric(p.close);
      if (!date || close == null) return null;
      if (date > chartAsOf) return null;
      return { date, close };
    })
    .filter((p): p is { date: string; close: number } => p != null);

  return {
    company: {
      ticker: company.ticker,
      name: company.name,
      exchange: company.exchange,
      board: company.board,
      sector: company.sector,
      industry: company.industry,
      currency: company.currency,
    },
    fundamentals,
    priceHistory,
  };
}
