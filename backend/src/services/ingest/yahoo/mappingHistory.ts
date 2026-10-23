/**
 * Maps a yahoo-finance2 `fundamentalsTimeSeries` result (type: "annual",
 * module: "all") into rows for the multi-year `fundamentals` table.
 *
 * This is deliberately separate from mapping.ts/mapFundamentals: that path
 * feeds the current-snapshot `screener_metrics` row from `quoteSummary` and
 * is untouched. This path feeds historical per-fiscal-year financials.
 *
 * Yahoo deprecated the old quoteSummary statement modules
 * (incomeStatementHistory / balanceSheetHistory / cashflowStatementHistory —
 * "provided almost no data since Nov 2024"); `fundamentalsTimeSeries` is
 * their documented replacement, confirmed working via a manual spike against
 * a live SGX ticker.
 */

/** One fiscal year of historical fundamentals for one company. */
export interface RawFundamentalsHistoryRow {
  ticker: string;
  fiscalPeriod: string; // e.g. "FY2024"
  periodEnd: string; // ISO yyyy-mm-dd
  revenue: number | null;
  netIncome: number | null;
  operatingIncome: number | null;
  epsDiluted: number | null;
  totalAssets: number | null;
  totalEquity: number | null;
  totalDebt: number | null;
  freeCashFlow: number | null;
  sharesOutstanding: number | null;
  dividendsPerShare: number | null;
}

const n = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

function toIsoDate(v: unknown): string | null {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "string" || typeof v === "number") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  return null;
}

/**
 * `rows` is the result of
 * `yahooFinance.fundamentalsTimeSeries(ticker, { type: "annual", module: "all", period1 })`.
 * Typed as `any[]` to stay resilient to module-shape changes, matching the
 * convention in mapFundamentals. Rows without a usable `date` are dropped.
 */
export function mapFundamentalsHistory(
  ticker: string,
  rows: any[],
): RawFundamentalsHistoryRow[] {
  const out: RawFundamentalsHistoryRow[] = [];

  for (const row of rows ?? []) {
    const periodEnd = toIsoDate(row?.date);
    if (!periodEnd) continue;

    const fiscalYear = periodEnd.slice(0, 4);

    out.push({
      ticker,
      fiscalPeriod: `FY${fiscalYear}`,
      periodEnd,
      revenue: n(row.totalRevenue),
      netIncome: n(row.netIncome),
      operatingIncome: n(row.operatingIncome),
      epsDiluted: n(row.dilutedEPS),
      totalAssets: n(row.totalAssets),
      totalEquity: n(row.stockholdersEquity) ?? n(row.totalEquityGrossMinorityInterest),
      totalDebt: n(row.totalDebt),
      freeCashFlow: n(row.freeCashFlow),
      sharesOutstanding: n(row.ordinarySharesNumber),
      dividendsPerShare: n(row.dividendPerShare),
    });
  }

  return out;
}
