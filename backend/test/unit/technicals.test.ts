import assert from "node:assert/strict";
import { test } from "vitest";
import {
  compute52wHigh,
  compute52wLow,
  computeAvgVolume,
  computePctFromHigh,
  computePctFromLow,
  computePerfOverTradingDays,
  computePerfYtd,
  computePriceVsMa,
  computeRsi14,
  computeSma,
  computeSparkline,
  computeTechnicals,
  type PriceBar,
} from "../../src/services/compute/technicals";

/** Build a bar series from closes only, dated sequentially from 2024-01-01. */
function barsFromCloses(closes: number[], startDate = "2024-01-01"): PriceBar[] {
  const start = new Date(startDate + "T00:00:00.000Z");
  return closes.map((close, i) => {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    return { date: d.toISOString().slice(0, 10), close };
  });
}

test("computeRsi14 — hand-verified 15-close series (9 up-2s, 5 down-1s)", () => {
  // Changes: +2,-1,+2,+2,-1,+2,+2,-1,+2,+2,-1,+2,+2,-1
  // sumGains = 9*2 = 18, sumLosses = 5*1 = 5
  // RS = 18/5 = 3.6 -> RSI = 100 - 100/4.6 = 1800/23 = 78.2608695652...
  const closes = [
    100, 102, 101, 103, 105, 104, 106, 108, 107, 109, 111, 110, 112, 114, 113,
  ];
  const rsi = computeRsi14(barsFromCloses(closes));
  assert.ok(rsi !== null);
  assert.ok(Math.abs(rsi! - 1800 / 23) < 1e-9);
  assert.ok(Math.abs(rsi! - 78.26086956521739) < 1e-9);
});

test("computeRsi14 — all gains returns 100", () => {
  const closes = Array.from({ length: 15 }, (_, i) => 100 + i); // strictly increasing
  assert.equal(computeRsi14(barsFromCloses(closes)), 100);
});

test("computeRsi14 — all losses returns 0", () => {
  const closes = Array.from({ length: 15 }, (_, i) => 100 - i); // strictly decreasing
  assert.equal(computeRsi14(barsFromCloses(closes)), 0);
});

test("computeRsi14 — fewer than 15 closes returns null", () => {
  const closes = Array.from({ length: 10 }, (_, i) => 100 + i);
  assert.equal(computeRsi14(barsFromCloses(closes)), null);
});

test("computeSma — 50-day average of 1..50 is 25.5", () => {
  const closes = Array.from({ length: 50 }, (_, i) => i + 1); // 1..50
  assert.equal(computeSma(barsFromCloses(closes), 50), 25.5);
});

test("computeSma — 200-day average of 1..200 is 100.5", () => {
  const closes = Array.from({ length: 200 }, (_, i) => i + 1); // 1..200
  assert.equal(computeSma(barsFromCloses(closes), 200), 100.5);
});

test("computeSma — only uses the trailing `window` closes", () => {
  // 10 extra low closes prepended should not affect a window=5 average of the last 5 values [1,2,3,4,5]
  const closes = [...Array.from({ length: 10 }, () => 0), 1, 2, 3, 4, 5];
  assert.equal(computeSma(barsFromCloses(closes), 5), 3);
});

test("computeSma — insufficient bars returns null", () => {
  const closes = [1, 2, 3];
  assert.equal(computeSma(barsFromCloses(closes), 5), null);
});

test("computePriceVsMa — 110 vs ma 100 is +0.10", () => {
  assert.equal(computePriceVsMa(110, 100), 0.1);
});

test("computePriceVsMa — null inputs propagate null", () => {
  assert.equal(computePriceVsMa(null, 100), null);
  assert.equal(computePriceVsMa(110, null), null);
  assert.equal(computePriceVsMa(110, 0), null);
});

test("compute52wHigh/Low — uses high/low fields when present, falls back to close", () => {
  const bars: PriceBar[] = [
    { date: "2024-01-01", close: 10, high: 12, low: 9 },
    { date: "2024-01-02", close: 11 }, // no high/low -> falls back to close
    { date: "2024-01-03", close: 8, high: 8.5, low: 7 },
  ];
  assert.equal(compute52wHigh(bars), 12);
  assert.equal(compute52wLow(bars), 7);
});

test("compute52wHigh/Low — only considers trailing window", () => {
  const bars: PriceBar[] = [
    { date: "2023-01-01", close: 1000 }, // way outside the window, should be excluded
    ...barsFromCloses([10, 20, 30], "2024-01-01"),
  ];
  assert.equal(compute52wHigh(bars, 3), 30);
  assert.equal(compute52wLow(bars, 3), 10);
});

test("computePctFromHigh/Low", () => {
  assert.equal(computePctFromHigh(90, 100), -0.1);
  assert.equal(computePctFromLow(110, 100), 0.1);
  assert.equal(computePctFromHigh(null, 100), null);
  assert.equal(computePctFromLow(110, 0), null);
});

test("computeAvgVolume — averages trailing window, ignores non-numeric volumes", () => {
  const bars: PriceBar[] = [
    { date: "2024-01-01", close: 1, volume: 100 },
    { date: "2024-01-02", close: 1, volume: null },
    { date: "2024-01-03", close: 1, volume: 200 },
    { date: "2024-01-04", close: 1, volume: 300 },
  ];
  // window defaults to 30, so all 4 bars are in scope; null is dropped -> avg(100,200,300) = 200
  assert.equal(computeAvgVolume(bars), 200);
});

test("computeAvgVolume — no volume data returns null", () => {
  const bars = barsFromCloses([1, 2, 3]);
  assert.equal(computeAvgVolume(bars), null);
});

test("computePerfOverTradingDays — known percentage change", () => {
  // 10 bars: closes 100..109 ascending by 1 each day (day i = 100+i)
  const closes = Array.from({ length: 10 }, (_, i) => 100 + i);
  const bars = barsFromCloses(closes);
  // latest = 109 (index 9), 5 bars back = index 4 = 104 -> (109-104)/104
  assert.ok(Math.abs(computePerfOverTradingDays(bars, 5)! - 5 / 104) < 1e-12);
  // 1 day back = index 8 = 108 -> (109-108)/108
  assert.ok(Math.abs(computePerfOverTradingDays(bars, 1)! - 1 / 108) < 1e-12);
});

test("computePerfOverTradingDays — insufficient history returns null", () => {
  const bars = barsFromCloses([100, 101, 102]);
  assert.equal(computePerfOverTradingDays(bars, 5), null);
});

test("computePerfYtd — compares latest close to prior year-end close", () => {
  const bars: PriceBar[] = [
    { date: "2023-12-29", close: 100 }, // prior year-end baseline
    { date: "2024-01-02", close: 105 },
    { date: "2024-06-15", close: 110 },
  ];
  // (110 - 100) / 100 = 0.10
  assert.equal(computePerfYtd(bars), 0.1);
});

test("computePerfYtd — falls back to first bar when no prior-year data exists", () => {
  const bars: PriceBar[] = [
    { date: "2024-01-02", close: 100 },
    { date: "2024-06-15", close: 120 },
  ];
  assert.equal(computePerfYtd(bars), 0.2);
});

test("computeSparkline — last N closes in chronological order", () => {
  const closes = Array.from({ length: 40 }, (_, i) => i + 1); // 1..40
  const bars = barsFromCloses(closes);
  const spark = computeSparkline(bars, 30);
  assert.equal(spark.length, 30);
  assert.equal(spark[0], 11); // 40 - 30 + 1
  assert.equal(spark[spark.length - 1], 40);
});

test("computeTechnicals — composes a full row from a synthetic series", () => {
  const closes = Array.from({ length: 260 }, (_, i) => 100 + i * 0.5); // steady uptrend, 260 bars
  const bars = barsFromCloses(closes);
  const result = computeTechnicals(bars);

  assert.equal(result.price, closes[closes.length - 1]);
  assert.equal(result.rsi14, 100); // monotonically increasing -> RSI 100
  assert.ok(result.priceVs50ma! > 0); // price above a rising 50-day MA
  assert.ok(result.priceVs200ma! > 0);
  assert.equal(result.sparkline30d.length, 30);
  assert.ok(result.perf1y !== null);
});

test("computeTechnicals — uses explicit currentPrice override when given", () => {
  const bars = barsFromCloses([100, 101, 102]);
  const result = computeTechnicals(bars, 999);
  assert.equal(result.price, 999);
});
