/**
 * Maps a yahoo-finance2 quoteSummary result into the raw fundamental inputs
 * the compute layer needs. This is the single place that knows Yahoo's field
 * names and quirks — tune it after running scripts/validate-sgx.ts.
 *
 * What this does NOT produce: technicals (RSI, performance windows, MA-relative
 * %, 30-day avg volume). Those are derived from the daily price series in the
 * compute layer, not from quoteSummary.
 *
 * What does NOT come from Yahoo at all: `board` (Mainboard/Catalist) — that
 * comes from the SGX universe seed, not from any Yahoo response.
 */

/** Raw, lightly-normalised fundamentals for one company. */
export interface RawFundamentals {
  ticker: string;

  // identity
  name: string | null;
  exchange: string | null;
  sector: string | null;
  industry: string | null;
  country: string | null;
  currency: string | null;

  // direct values
  marketCap: number | null;
  sharesOutstanding: number | null;
  price: number | null;

  // valuation
  pe: number | null;
  pb: number | null;
  ps: number | null;
  peg: number | null;

  // profitability
  profitMargin: number | null;
  operatingMargin: number | null;
  roe: number | null;
  roa: number | null;
  eps: number | null;

  // growth
  revenueGrowthYoy: number | null;
  earningsGrowthYoy: number | null;

  // financial health
  debtToEquity: number | null; // normalised to a ratio (Yahoo returns a %)
  freeCashFlow: number | null;
  totalRevenue: number | null; // needed to compute fcf_margin

  // dividends
  dividendYield: number | null;
  payoutRatio: number | null;

  // technical reference points from Yahoo (the compute layer may instead
  // derive these from the price series for consistency)
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  fiftyDayAverage: number | null;
  twoHundredDayAverage: number | null;
}

const n = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const s = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

/**
 * `qs` is the result of yahooFinance.quoteSummary(ticker, { modules: [...] }).
 * Typed as `any` here to stay resilient to module-shape changes; the provider
 * passes the real typed result through.
 */
export function mapFundamentals(ticker: string, qs: any): RawFundamentals {
  const price = qs?.price ?? {};
  const sd = qs?.summaryDetail ?? {};
  const ks = qs?.defaultKeyStatistics ?? {};
  const fd = qs?.financialData ?? {};
  const sp = qs?.summaryProfile ?? {};

  // Yahoo reports debtToEquity as a percentage (e.g. 152.3 → 1.523x).
  const rawDte = n(fd.debtToEquity);

  return {
    ticker,

    name: s(price.longName) ?? s(price.shortName),
    exchange: s(price.exchangeName),
    sector: s(sp.sector),
    industry: s(sp.industry),
    country: s(sp.country),
    currency: s(price.currency),

    marketCap: n(price.marketCap) ?? n(sd.marketCap),
    sharesOutstanding: n(ks.sharesOutstanding),
    price: n(price.regularMarketPrice) ?? n(fd.currentPrice),

    pe: n(sd.trailingPE),
    pb: n(ks.priceToBook),
    ps: n(sd.priceToSalesTrailing12Months),
    peg: n(ks.pegRatio),

    profitMargin: n(fd.profitMargins) ?? n(ks.profitMargins),
    operatingMargin: n(fd.operatingMargins),
    roe: n(fd.returnOnEquity),
    roa: n(fd.returnOnAssets),
    eps: n(ks.trailingEps),

    revenueGrowthYoy: n(fd.revenueGrowth),
    earningsGrowthYoy: n(fd.earningsGrowth),

    debtToEquity: rawDte === null ? null : rawDte / 100,
    freeCashFlow: n(fd.freeCashflow),
    totalRevenue: n(fd.totalRevenue),

    dividendYield: n(sd.dividendYield) ?? n(sd.trailingAnnualDividendYield),
    payoutRatio: n(sd.payoutRatio),

    fiftyTwoWeekHigh: n(sd.fiftyTwoWeekHigh),
    fiftyTwoWeekLow: n(sd.fiftyTwoWeekLow),
    fiftyDayAverage: n(sd.fiftyDayAverage),
    twoHundredDayAverage: n(sd.twoHundredDayAverage),
  };
}
