import assert from "node:assert/strict";
import { test } from "vitest";
import { mapFundamentalsHistory } from "../../src/services/ingest/yahoo/mappingHistory";

/** Synthetic fundamentalsTimeSeries row shape (module: "all", type: "annual"). */
function fakeRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    date: new Date("2024-12-31T00:00:00.000Z"),
    TYPE: "ALL",
    periodType: "12M",
    totalRevenue: 1_000_000_000,
    netIncome: 200_000_000,
    operatingIncome: 250_000_000,
    dilutedEPS: 0.42,
    totalAssets: 5_000_000_000,
    stockholdersEquity: 2_500_000_000,
    totalDebt: 800_000_000,
    freeCashFlow: 180_000_000,
    ordinarySharesNumber: 4_000_000_000,
    dividendPerShare: 0.1,
    ...overrides,
  };
}

test("mapFundamentalsHistory — maps a well-formed row to fundamentals fields", () => {
  const rows = mapFundamentalsHistory("D05.SI", [fakeRow()]);
  assert.equal(rows.length, 1);
  const row = rows[0]!;
  assert.equal(row.ticker, "D05.SI");
  assert.equal(row.fiscalPeriod, "FY2024");
  assert.equal(row.periodEnd, "2024-12-31");
  assert.equal(row.revenue, 1_000_000_000);
  assert.equal(row.netIncome, 200_000_000);
  assert.equal(row.operatingIncome, 250_000_000);
  assert.equal(row.epsDiluted, 0.42);
  assert.equal(row.totalAssets, 5_000_000_000);
  assert.equal(row.totalEquity, 2_500_000_000);
  assert.equal(row.totalDebt, 800_000_000);
  assert.equal(row.freeCashFlow, 180_000_000);
  assert.equal(row.sharesOutstanding, 4_000_000_000);
  assert.equal(row.dividendsPerShare, 0.1);
});

test("mapFundamentalsHistory — falls back to totalEquityGrossMinorityInterest when stockholdersEquity is absent", () => {
  const rows = mapFundamentalsHistory("D05.SI", [
    fakeRow({ stockholdersEquity: undefined, totalEquityGrossMinorityInterest: 2_600_000_000 }),
  ]);
  assert.equal(rows[0]!.totalEquity, 2_600_000_000);
});

test("mapFundamentalsHistory — drops rows without a usable date", () => {
  const rows = mapFundamentalsHistory("D05.SI", [fakeRow({ date: undefined }), fakeRow()]);
  assert.equal(rows.length, 1);
});

test("mapFundamentalsHistory — missing/non-numeric fields become null, not throws", () => {
  const rows = mapFundamentalsHistory("D05.SI", [
    fakeRow({
      totalRevenue: undefined,
      netIncome: "not-a-number",
      dilutedEPS: undefined,
    }),
  ]);
  const row = rows[0]!;
  assert.equal(row.revenue, null);
  assert.equal(row.netIncome, null);
  assert.equal(row.epsDiluted, null);
});

test("mapFundamentalsHistory — multiple years are mapped independently and preserve order", () => {
  const rows = mapFundamentalsHistory("D05.SI", [
    fakeRow({ date: new Date("2023-12-31T00:00:00.000Z"), totalRevenue: 900_000_000 }),
    fakeRow({ date: new Date("2024-12-31T00:00:00.000Z"), totalRevenue: 1_000_000_000 }),
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0]!.fiscalPeriod, "FY2023");
  assert.equal(rows[1]!.fiscalPeriod, "FY2024");
});

test("mapFundamentalsHistory — empty/undefined input returns an empty array", () => {
  assert.deepEqual(mapFundamentalsHistory("D05.SI", []), []);
  assert.deepEqual(mapFundamentalsHistory("D05.SI", undefined as unknown as any[]), []);
});
