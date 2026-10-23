import assert from "node:assert/strict";
import { test } from "vitest";
import type { RawFundamentals } from "../../src/services/ingest/yahoo/mapping";
import {
  computeFcfMargin,
  computeRatioMetrics,
} from "../../src/services/compute/ratios";

function baseRaw(overrides: Partial<RawFundamentals> = {}): RawFundamentals {
  return {
    ticker: "TEST.SI",
    name: "Test Co",
    exchange: "SGX",
    sector: null,
    industry: null,
    country: "SG",
    currency: "SGD",
    marketCap: null,
    sharesOutstanding: null,
    price: null,
    pe: null,
    pb: null,
    ps: null,
    peg: null,
    profitMargin: null,
    operatingMargin: null,
    roe: null,
    roa: null,
    eps: null,
    revenueGrowthYoy: null,
    earningsGrowthYoy: null,
    debtToEquity: null,
    freeCashFlow: null,
    totalRevenue: null,
    dividendYield: null,
    payoutRatio: null,
    fiftyTwoWeekHigh: null,
    fiftyTwoWeekLow: null,
    fiftyDayAverage: null,
    twoHundredDayAverage: null,
    ...overrides,
  };
}

test("computeFcfMargin — freeCashFlow / totalRevenue", () => {
  assert.equal(computeFcfMargin(25_000_000, 100_000_000), 0.25);
});

test("computeFcfMargin — null when either input is missing", () => {
  assert.equal(computeFcfMargin(null, 100), null);
  assert.equal(computeFcfMargin(50, null), null);
});

test("computeFcfMargin — null when totalRevenue is zero (avoid divide-by-zero)", () => {
  assert.equal(computeFcfMargin(50, 0), null);
});

test("computeRatioMetrics — passes through ratio fields unchanged", () => {
  const raw = baseRaw({
    pe: 12.5,
    pb: 1.8,
    ps: 3.2,
    peg: 1.1,
    profitMargin: 0.15,
    operatingMargin: 0.2,
    roe: 0.18,
    roa: 0.08,
    eps: 0.42,
    revenueGrowthYoy: 0.05,
    earningsGrowthYoy: 0.07,
    debtToEquity: 0.6,
    dividendYield: 0.04,
    payoutRatio: 0.5,
  });
  const metrics = computeRatioMetrics(raw);

  assert.equal(metrics.pe, 12.5);
  assert.equal(metrics.pb, 1.8);
  assert.equal(metrics.ps, 3.2);
  assert.equal(metrics.peg, 1.1);
  assert.equal(metrics.profitMargin, 0.15);
  assert.equal(metrics.operatingMargin, 0.2);
  assert.equal(metrics.roe, 0.18);
  assert.equal(metrics.roa, 0.08);
  assert.equal(metrics.eps, 0.42);
  assert.equal(metrics.revenueGrowthYoy, 0.05);
  assert.equal(metrics.earningsGrowthYoy, 0.07);
  assert.equal(metrics.debtToEquity, 0.6);
  assert.equal(metrics.dividendYield, 0.04);
  assert.equal(metrics.payoutRatio, 0.5);
});

test("computeRatioMetrics — derives fcf_margin from freeCashFlow/totalRevenue", () => {
  const raw = baseRaw({ freeCashFlow: 30_000_000, totalRevenue: 200_000_000 });
  const metrics = computeRatioMetrics(raw);
  assert.equal(metrics.freeCashFlow, 30_000_000);
  assert.equal(metrics.fcfMargin, 0.15);
});

test("computeRatioMetrics — derives market_cap_bucket from marketCap", () => {
  assert.equal(computeRatioMetrics(baseRaw({ marketCap: 60_000_000_000 })).marketCapBucket, "mega");
  assert.equal(computeRatioMetrics(baseRaw({ marketCap: 10_000_000_000 })).marketCapBucket, "large");
  assert.equal(computeRatioMetrics(baseRaw({ marketCap: 2_000_000_000 })).marketCapBucket, "mid");
  assert.equal(computeRatioMetrics(baseRaw({ marketCap: 500_000_000 })).marketCapBucket, "small");
  assert.equal(computeRatioMetrics(baseRaw({ marketCap: 50_000_000 })).marketCapBucket, "micro");
  assert.equal(computeRatioMetrics(baseRaw({ marketCap: null })).marketCapBucket, null);
});

test("computeRatioMetrics — all-null input yields all-null output (no throws)", () => {
  const metrics = computeRatioMetrics(baseRaw());
  for (const [key, value] of Object.entries(metrics)) {
    assert.equal(value, null, `expected ${key} to be null`);
  }
});
