/**
 * Ratio pass-through: most valuation/profitability/growth/dividend fields
 * are already computed by Yahoo and land on `RawFundamentals` via
 * mapFundamentals — this module just renames/shapes them for
 * `screener_metrics`. The only genuinely-derived ratio here is fcf_margin;
 * market_cap_bucket is derived too (see ./marketCapBucket).
 */
import type { RawFundamentals } from "../ingest/yahoo/mapping";
import { marketCapBucket } from "./marketCapBucket";

export interface RatioMetrics {
  marketCap: number | null;
  marketCapBucket: string | null;

  pe: number | null;
  pb: number | null;
  ps: number | null;
  peg: number | null;

  profitMargin: number | null;
  operatingMargin: number | null;
  roe: number | null;
  roa: number | null;
  eps: number | null;

  revenueGrowthYoy: number | null;
  earningsGrowthYoy: number | null;

  debtToEquity: number | null;
  freeCashFlow: number | null;
  fcfMargin: number | null;

  dividendYield: number | null;
  payoutRatio: number | null;
}

/** fcf_margin = freeCashFlow / totalRevenue. Null if either input is missing or revenue is zero. */
export function computeFcfMargin(
  freeCashFlow: number | null,
  totalRevenue: number | null,
): number | null {
  if (freeCashFlow === null || totalRevenue === null || totalRevenue === 0) {
    return null;
  }
  return freeCashFlow / totalRevenue;
}

/** Maps `RawFundamentals` onto the ratio columns of `screener_metrics`. Pure — no DB, no network. */
export function computeRatioMetrics(raw: RawFundamentals): RatioMetrics {
  return {
    marketCap: raw.marketCap,
    marketCapBucket: marketCapBucket(raw.marketCap),

    pe: raw.pe,
    pb: raw.pb,
    ps: raw.ps,
    peg: raw.peg,

    profitMargin: raw.profitMargin,
    operatingMargin: raw.operatingMargin,
    roe: raw.roe,
    roa: raw.roa,
    eps: raw.eps,

    revenueGrowthYoy: raw.revenueGrowthYoy,
    earningsGrowthYoy: raw.earningsGrowthYoy,

    debtToEquity: raw.debtToEquity,
    freeCashFlow: raw.freeCashFlow,
    fcfMargin: computeFcfMargin(raw.freeCashFlow, raw.totalRevenue),

    dividendYield: raw.dividendYield,
    payoutRatio: raw.payoutRatio,
  };
}
