import { and, eq, max } from "drizzle-orm";
import type { ResultsResponse, ScreenSpec, StockRow } from "screener-contract";
// Request-time read: runs on the read-only pool.
import { readDb as db } from "../../db/drizzleClient";
import { companies } from "../../models/screener/companies";
import { screenerMetrics } from "../../models/screener/screenerMetrics";
import { compileOrderBy, compileWhere } from "./compile";
import { countScreen } from "./count";

/** Coerce pg numeric (often a string) → number, preserving null (never 0). */
function parseNumeric(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Coerce sparkline_30d to number[].
 * Postgres numeric[] via node-pg typically arrives as string[].
 */
function parseSparkline(
  value: (string | number | null)[] | null | undefined,
): number[] {
  if (!value || value.length === 0) return [];
  const out: number[] = [];
  for (const v of value) {
    const n = parseNumeric(v);
    if (n != null) out.push(n);
  }
  return out;
}

/** Normalize drizzle/pg date to YYYY-MM-DD ISO date string. */
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

type MetricsSelect = {
  ticker: string;
  name: string;
  currency: string;
  marketCap: string | number | null;
  pe: string | number | null;
  pb: string | number | null;
  ps: string | number | null;
  peg: string | number | null;
  profitMargin: string | number | null;
  operatingMargin: string | number | null;
  roe: string | number | null;
  roa: string | number | null;
  eps: string | number | null;
  revenueGrowthYoy: string | number | null;
  earningsGrowthYoy: string | number | null;
  debtToEquity: string | number | null;
  freeCashFlow: string | number | null;
  fcfMargin: string | number | null;
  dividendYield: string | number | null;
  payoutRatio: string | number | null;
  price: string | number | null;
  pctFrom52wHigh: string | number | null;
  pctFrom52wLow: string | number | null;
  priceVs50ma: string | number | null;
  priceVs200ma: string | number | null;
  rsi14: string | number | null;
  avgVolume30d: number | null;
  perf1d: string | number | null;
  perf1w: string | number | null;
  perf1m: string | number | null;
  perfYtd: string | number | null;
  perf1y: string | number | null;
  sparkline30d: (string | number | null)[] | null;
};

function toStockRow(row: MetricsSelect): StockRow {
  return {
    ticker: row.ticker,
    name: row.name,
    currency: row.currency,
    marketCap: parseNumeric(row.marketCap),
    pe: parseNumeric(row.pe),
    pb: parseNumeric(row.pb),
    ps: parseNumeric(row.ps),
    peg: parseNumeric(row.peg),
    profitMargin: parseNumeric(row.profitMargin),
    operatingMargin: parseNumeric(row.operatingMargin),
    roe: parseNumeric(row.roe),
    roa: parseNumeric(row.roa),
    eps: parseNumeric(row.eps),
    revenueGrowthYoy: parseNumeric(row.revenueGrowthYoy),
    earningsGrowthYoy: parseNumeric(row.earningsGrowthYoy),
    debtToEquity: parseNumeric(row.debtToEquity),
    freeCashFlow: parseNumeric(row.freeCashFlow),
    fcfMargin: parseNumeric(row.fcfMargin),
    dividendYield: parseNumeric(row.dividendYield),
    payoutRatio: parseNumeric(row.payoutRatio),
    price: parseNumeric(row.price),
    pctFrom52wHigh: parseNumeric(row.pctFrom52wHigh),
    pctFrom52wLow: parseNumeric(row.pctFrom52wLow),
    priceVs50ma: parseNumeric(row.priceVs50ma),
    priceVs200ma: parseNumeric(row.priceVs200ma),
    rsi14: parseNumeric(row.rsi14),
    avgVolume30d:
      row.avgVolume30d == null || !Number.isFinite(row.avgVolume30d)
        ? null
        : row.avgVolume30d,
    perf1d: parseNumeric(row.perf1d),
    perf1w: parseNumeric(row.perf1w),
    perf1m: parseNumeric(row.perf1m),
    perfYtd: parseNumeric(row.perfYtd),
    perf1y: parseNumeric(row.perf1y),
    sparkline: parseSparkline(row.sparkline30d),
  };
}

export async function resultsScreen(
  spec: ScreenSpec,
): Promise<ResultsResponse> {
  const compiled = compileWhere(spec);
  // Inactive companies are never eligible for a screen.
  const where = compiled
    ? and(eq(companies.isActive, true), compiled)
    : eq(companies.isActive, true);
  const orderBy = compileOrderBy(spec);
  const page = spec.page ?? 1;
  const pageSize = spec.pageSize ?? 50;
  const offset = (page - 1) * pageSize;

  const base = db
    .select({
      ticker: companies.ticker,
      name: companies.name,
      currency: companies.currency,
      marketCap: screenerMetrics.marketCap,
      pe: screenerMetrics.pe,
      pb: screenerMetrics.pb,
      ps: screenerMetrics.ps,
      peg: screenerMetrics.peg,
      profitMargin: screenerMetrics.profitMargin,
      operatingMargin: screenerMetrics.operatingMargin,
      roe: screenerMetrics.roe,
      roa: screenerMetrics.roa,
      eps: screenerMetrics.eps,
      revenueGrowthYoy: screenerMetrics.revenueGrowthYoy,
      earningsGrowthYoy: screenerMetrics.earningsGrowthYoy,
      debtToEquity: screenerMetrics.debtToEquity,
      freeCashFlow: screenerMetrics.freeCashFlow,
      fcfMargin: screenerMetrics.fcfMargin,
      dividendYield: screenerMetrics.dividendYield,
      payoutRatio: screenerMetrics.payoutRatio,
      price: screenerMetrics.price,
      pctFrom52wHigh: screenerMetrics.pctFrom52wHigh,
      pctFrom52wLow: screenerMetrics.pctFrom52wLow,
      priceVs50ma: screenerMetrics.priceVs50ma,
      priceVs200ma: screenerMetrics.priceVs200ma,
      rsi14: screenerMetrics.rsi14,
      avgVolume30d: screenerMetrics.avgVolume30d,
      perf1d: screenerMetrics.perf1d,
      perf1w: screenerMetrics.perf1w,
      perf1m: screenerMetrics.perf1m,
      perfYtd: screenerMetrics.perfYtd,
      perf1y: screenerMetrics.perf1y,
      sparkline30d: screenerMetrics.sparkline30d,
    })
    .from(companies)
    .innerJoin(screenerMetrics, eq(companies.id, screenerMetrics.companyId))
    .where(where);

  const ordered = orderBy ? base.orderBy(orderBy) : base;

  const [rows, total, asOfRows] = await Promise.all([
    ordered.limit(pageSize).offset(offset),
    countScreen(spec),
    db.select({ asOf: max(screenerMetrics.asOf) }).from(screenerMetrics),
  ]);

  return {
    rows: rows.map(toStockRow),
    total,
    page,
    asOf: toIsoDate(asOfRows[0]?.asOf ?? null),
  };
}
