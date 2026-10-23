/**
 * Phase 0 validation — run this BEFORE building ingestion.
 * Usage (from repo root):  npx tsx backend/scripts/validate-sgx.ts
 * Only dependency: yahoo-finance2.
 */
import YahooFinance from "yahoo-finance2";

// yahoo-finance2 v3: construct an instance (v2 called methods on the import directly).
const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const TICKERS = ["D05.SI", "C38U.SI"];

const QS_MODULES = [
  "price",
  "summaryDetail",
  "defaultKeyStatistics",
  "financialData",
  "summaryProfile",
] as const;

type Probe = { field: string; get: (qs: any) => unknown; note?: string };

const PROBES: Probe[] = [
  { field: "name", get: (q) => q.price?.longName ?? q.price?.shortName },
  { field: "exchange", get: (q) => q.price?.exchangeName },
  { field: "currency", get: (q) => q.price?.currency },
  { field: "sector", get: (q) => q.summaryProfile?.sector },
  { field: "industry", get: (q) => q.summaryProfile?.industry },
  { field: "country", get: (q) => q.summaryProfile?.country },
  { field: "market_cap", get: (q) => q.price?.marketCap ?? q.summaryDetail?.marketCap },
  { field: "shares_outstanding", get: (q) => q.defaultKeyStatistics?.sharesOutstanding },
  { field: "pe", get: (q) => q.summaryDetail?.trailingPE },
  { field: "pb", get: (q) => q.defaultKeyStatistics?.priceToBook },
  { field: "ps", get: (q) => q.summaryDetail?.priceToSalesTrailing12Months },
  { field: "peg", get: (q) => q.defaultKeyStatistics?.pegRatio, note: "often null for SGX" },
  { field: "profit_margin", get: (q) => q.financialData?.profitMargins ?? q.defaultKeyStatistics?.profitMargins },
  { field: "operating_margin", get: (q) => q.financialData?.operatingMargins },
  { field: "roe", get: (q) => q.financialData?.returnOnEquity },
  { field: "roa", get: (q) => q.financialData?.returnOnAssets },
  { field: "eps", get: (q) => q.defaultKeyStatistics?.trailingEps },
  { field: "revenue_growth_yoy", get: (q) => q.financialData?.revenueGrowth },
  { field: "earnings_growth_yoy", get: (q) => q.financialData?.earningsGrowth },
  { field: "debt_to_equity", get: (q) => q.financialData?.debtToEquity, note: "Yahoo gives a %, divide by 100" },
  { field: "free_cash_flow", get: (q) => q.financialData?.freeCashflow },
  { field: "total_revenue", get: (q) => q.financialData?.totalRevenue, note: "for fcf_margin" },
  { field: "dividend_yield", get: (q) => q.summaryDetail?.dividendYield ?? q.summaryDetail?.trailingAnnualDividendYield },
  { field: "payout_ratio", get: (q) => q.summaryDetail?.payoutRatio },
  { field: "price", get: (q) => q.price?.regularMarketPrice ?? q.financialData?.currentPrice },
  { field: "fiftyTwoWeekHigh", get: (q) => q.summaryDetail?.fiftyTwoWeekHigh },
  { field: "fiftyTwoWeekLow", get: (q) => q.summaryDetail?.fiftyTwoWeekLow },
  { field: "fiftyDayAverage", get: (q) => q.summaryDetail?.fiftyDayAverage },
  { field: "twoHundredDayAverage", get: (q) => q.summaryDetail?.twoHundredDayAverage },
];

function fmt(v: unknown): string {
  if (v === undefined || v === null) return "—";
  if (typeof v === "number") return String(Number(v.toFixed(4)));
  return String(v);
}

async function probeTicker(ticker: string) {
  console.log(`\n${"=".repeat(64)}\n${ticker}\n${"=".repeat(64)}`);
  let qs: any;
  try {
    qs = await yahooFinance.quoteSummary(ticker, { modules: [...QS_MODULES] });
  } catch (err) {
    console.log(`  quoteSummary FAILED: ${(err as Error).message}`);
    return;
  }
  let present = 0;
  for (const p of PROBES) {
    const v = p.get(qs);
    const ok = v !== undefined && v !== null;
    if (ok) present++;
    const note = p.note ? `   (${p.note})` : "";
    console.log(`  [${ok ? "OK " : "MISS"}] ${p.field.padEnd(22)} ${fmt(v)}${note}`);
  }
  console.log(`  ----\n  fundamentals coverage: ${present}/${PROBES.length} fields populated`);
  try {
    const to = new Date();
    const from = new Date();
    from.setFullYear(from.getFullYear() - 1);
    const chart: any = await yahooFinance.chart(ticker, { period1: from, period2: to, interval: "1d" });
    const bars: any[] = chart.quotes ?? [];
    const withClose = bars.filter((b) => b.close != null).length;
    console.log(`  price series: ${bars.length} daily bars, ${withClose} with close (need ~250 for 52w/MA/RSI)`);
  } catch (err) {
    console.log(`  chart FAILED: ${(err as Error).message}`);
  }
}

async function main() {
  for (const t of TICKERS) {
    await probeTicker(t);
    await new Promise((r) => setTimeout(r, 1200));
  }
  console.log(
    "\nReading the result: MISS on peg/some growth fields is normal. If core fields " +
      "(market_cap, pe, pb, roe, dividend_yield, price, the 52w/MA refs) and ~250 daily bars " +
      "come back, the free SGX route is viable.\n",
  );
}

main();