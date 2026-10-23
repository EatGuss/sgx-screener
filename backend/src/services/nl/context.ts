import { and, eq, inArray } from "drizzle-orm";
// Request-time read: runs on the read-only pool.
import { readDb as db } from "../../db/drizzleClient";
import { companies } from "../../models/screener/companies";
import { screenerMetrics } from "../../models/screener/screenerMetrics";

function parseNumeric(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** ScreenerField-keyed fundamentals for LLM @-reference context. */
export interface ReferenceFundamentals {
  ticker: string;
  name: string;
  sector: string | null;
  industry: string | null;
  fundamentals: Record<string, number | null>;
}

function metricsToFundamentals(
  row: typeof screenerMetrics.$inferSelect,
): Record<string, number | null> {
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

/**
 * Load active companies + screener_metrics for @-mentioned tickers.
 * Missing tickers are omitted (caller may warn).
 */
export async function loadReferenceContext(
  tickers: string[],
): Promise<ReferenceFundamentals[]> {
  const unique = [...new Set(tickers.map((t) => t.trim()).filter(Boolean))];
  if (unique.length === 0) return [];

  const companyRows = await db
    .select()
    .from(companies)
    .where(and(eq(companies.isActive, true), inArray(companies.ticker, unique)));

  if (companyRows.length === 0) return [];

  const ids = companyRows.map((c) => c.id);
  const metricsRows = await db
    .select()
    .from(screenerMetrics)
    .where(inArray(screenerMetrics.companyId, ids));

  const metricsByCompanyId = new Map(
    metricsRows.map((m) => [m.companyId, m] as const),
  );

  return companyRows.map((c) => {
    const metrics = metricsByCompanyId.get(c.id);
    return {
      ticker: c.ticker,
      name: c.name,
      sector: c.sector,
      industry: c.industry,
      fundamentals: metrics ? metricsToFundamentals(metrics) : {},
    };
  });
}

/** Compact JSON block for the user prompt. */
export function formatReferenceContextBlock(
  refs: ReferenceFundamentals[],
): string {
  if (refs.length === 0) return "";
  const payload = refs.map((r) => ({
    ticker: r.ticker,
    name: r.name,
    sector: r.sector,
    industry: r.industry,
    ...r.fundamentals,
  }));
  return [
    "Referenced tickers (factual fundamentals from our database).",
    "Percentages are decimals (0.046 = 4.6%). Money is raw SGD.",
    "Use these values when the user compares to or references @tickers:",
    JSON.stringify(payload, null, 2),
  ].join("\n");
}
