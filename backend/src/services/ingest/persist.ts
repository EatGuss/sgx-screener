import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "../../db/drizzleClient";
import { companies } from "../../models/screener/companies";
import { dailyPrices } from "../../models/screener/dailyPrices";
import { fundamentals } from "../../models/screener/fundamentals";
import { screenerMetrics } from "../../models/screener/screenerMetrics";
import type { ScreenerMetricsComputed } from "../compute/screenerMetricsRow";
import { barTradingDate } from "./sgxDate";
import type { RawFundamentals } from "./yahoo/mapping";
import type { RawFundamentalsHistoryRow } from "./yahoo/mappingHistory";
import type { DailyBar } from "./yahoo/provider";

function numStr(v: number | null | undefined): string | null {
  if (v === null || v === undefined || !Number.isFinite(v)) return null;
  return String(v);
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Upsert one company's computed metrics. On conflict, replaces the full row. */
export async function upsertScreenerMetrics(
  companyId: number,
  asOf: string,
  m: ScreenerMetricsComputed,
): Promise<void> {
  await db
    .insert(screenerMetrics)
    .values({
      companyId,
      asOf,
      marketCap: numStr(m.marketCap),
      marketCapBucket: m.marketCapBucket,
      pe: numStr(m.pe),
      pb: numStr(m.pb),
      ps: numStr(m.ps),
      peg: numStr(m.peg),
      profitMargin: numStr(m.profitMargin),
      operatingMargin: numStr(m.operatingMargin),
      roe: numStr(m.roe),
      roa: numStr(m.roa),
      eps: numStr(m.eps),
      revenueGrowthYoy: numStr(m.revenueGrowthYoy),
      earningsGrowthYoy: numStr(m.earningsGrowthYoy),
      debtToEquity: numStr(m.debtToEquity),
      freeCashFlow: numStr(m.freeCashFlow),
      fcfMargin: numStr(m.fcfMargin),
      dividendYield: numStr(m.dividendYield),
      payoutRatio: numStr(m.payoutRatio),
      price: numStr(m.price),
      pctFrom52wHigh: numStr(m.pctFrom52wHigh),
      pctFrom52wLow: numStr(m.pctFrom52wLow),
      priceVs50ma: numStr(m.priceVs50ma),
      priceVs200ma: numStr(m.priceVs200ma),
      rsi14: numStr(m.rsi14),
      avgVolume30d:
        m.avgVolume30d === null ? null : Math.round(m.avgVolume30d),
      perf1d: numStr(m.perf1d),
      perf1w: numStr(m.perf1w),
      perf1m: numStr(m.perf1m),
      perfYtd: numStr(m.perfYtd),
      perf1y: numStr(m.perf1y),
      sparkline30d: m.sparkline30d.map((v) => String(v)),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: screenerMetrics.companyId,
      set: {
        asOf: sql`excluded.as_of`,
        marketCap: sql`excluded.market_cap`,
        marketCapBucket: sql`excluded.market_cap_bucket`,
        pe: sql`excluded.pe`,
        pb: sql`excluded.pb`,
        ps: sql`excluded.ps`,
        peg: sql`excluded.peg`,
        profitMargin: sql`excluded.profit_margin`,
        operatingMargin: sql`excluded.operating_margin`,
        roe: sql`excluded.roe`,
        roa: sql`excluded.roa`,
        eps: sql`excluded.eps`,
        revenueGrowthYoy: sql`excluded.revenue_growth_yoy`,
        earningsGrowthYoy: sql`excluded.earnings_growth_yoy`,
        debtToEquity: sql`excluded.debt_to_equity`,
        freeCashFlow: sql`excluded.free_cash_flow`,
        fcfMargin: sql`excluded.fcf_margin`,
        dividendYield: sql`excluded.dividend_yield`,
        payoutRatio: sql`excluded.payout_ratio`,
        price: sql`excluded.price`,
        pctFrom52wHigh: sql`excluded.pct_from_52w_high`,
        pctFrom52wLow: sql`excluded.pct_from_52w_low`,
        priceVs50ma: sql`excluded.price_vs_50ma`,
        priceVs200ma: sql`excluded.price_vs_200ma`,
        rsi14: sql`excluded.rsi_14`,
        avgVolume30d: sql`excluded.avg_volume_30d`,
        perf1d: sql`excluded.perf_1d`,
        perf1w: sql`excluded.perf_1w`,
        perf1m: sql`excluded.perf_1m`,
        perfYtd: sql`excluded.perf_ytd`,
        perf1y: sql`excluded.perf_1y`,
        sparkline30d: sql`excluded.sparkline_30d`,
        updatedAt: new Date(),
      },
    });
}

/** Upsert daily OHLCV bars for one company. Never deletes existing rows. */
export async function upsertDailyPrices(
  companyId: number,
  bars: DailyBar[],
): Promise<number> {
  const valid = bars.filter((b) => b.close != null);
  if (valid.length === 0) return 0;

  const values = valid.map((b) => ({
    companyId,
    date: barTradingDate(b.date),
    open: b.open != null ? String(b.open) : null,
    high: b.high != null ? String(b.high) : null,
    low: b.low != null ? String(b.low) : null,
    close: String(b.close),
    adjClose: b.adjClose != null ? String(b.adjClose) : null,
    volume: b.volume,
  }));

  for (const part of chunk(values, 100)) {
    await db
      .insert(dailyPrices)
      .values(part)
      .onConflictDoUpdate({
        target: [dailyPrices.companyId, dailyPrices.date],
        set: {
          open: sql`excluded.open`,
          high: sql`excluded.high`,
          low: sql`excluded.low`,
          close: sql`excluded.close`,
          adjClose: sql`excluded.adj_close`,
          volume: sql`excluded.volume`,
        },
      });
  }

  return valid.length;
}

/**
 * Remove daily bars strictly after `asOf` (e.g. a prior mistaken intraday bar).
 * Keeps the EOD table aligned with the completed-session cutoff.
 */
export async function deleteDailyPricesAfter(
  companyId: number,
  asOf: string,
): Promise<void> {
  await db
    .delete(dailyPrices)
    .where(
      and(eq(dailyPrices.companyId, companyId), gt(dailyPrices.date, asOf)),
    );
}

/** Upsert annual fundamentals history rows for one company. */
export async function upsertFundamentalsHistory(
  companyId: number,
  rows: RawFundamentalsHistoryRow[],
): Promise<number> {
  if (rows.length === 0) return 0;

  for (const row of rows) {
    await db
      .insert(fundamentals)
      .values({
        companyId,
        fiscalPeriod: row.fiscalPeriod,
        periodEnd: row.periodEnd,
        revenue: numStr(row.revenue),
        netIncome: numStr(row.netIncome),
        operatingIncome: numStr(row.operatingIncome),
        epsDiluted: numStr(row.epsDiluted),
        totalAssets: numStr(row.totalAssets),
        totalEquity: numStr(row.totalEquity),
        totalDebt: numStr(row.totalDebt),
        freeCashFlow: numStr(row.freeCashFlow),
        sharesOutstanding: numStr(row.sharesOutstanding),
        dividendsPerShare: numStr(row.dividendsPerShare),
      })
      .onConflictDoUpdate({
        target: [fundamentals.companyId, fundamentals.fiscalPeriod],
        set: {
          periodEnd: sql`excluded.period_end`,
          revenue: sql`excluded.revenue`,
          netIncome: sql`excluded.net_income`,
          operatingIncome: sql`excluded.operating_income`,
          epsDiluted: sql`excluded.eps_diluted`,
          totalAssets: sql`excluded.total_assets`,
          totalEquity: sql`excluded.total_equity`,
          totalDebt: sql`excluded.total_debt`,
          freeCashFlow: sql`excluded.free_cash_flow`,
          sharesOutstanding: sql`excluded.shares_outstanding`,
          dividendsPerShare: sql`excluded.dividends_per_share`,
        },
      });
  }

  return rows.length;
}

/** Write Yahoo identity fields onto `companies` (sector/industry/name). */
export async function updateCompanyIdentity(
  companyId: number,
  raw: Pick<RawFundamentals, "sector" | "industry" | "name">,
): Promise<void> {
  await db
    .update(companies)
    .set({
      ...(raw.sector ? { sector: raw.sector } : {}),
      ...(raw.industry ? { industry: raw.industry } : {}),
      ...(raw.name ? { name: raw.name } : {}),
      updatedAt: new Date(),
    })
    .where(eq(companies.id, companyId));
}
