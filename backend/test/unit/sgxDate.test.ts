import assert from "node:assert/strict";
import { describe, test } from "vitest";
import {
  addIsoDays,
  barTradingDate,
  countSgxTradingDaysAfter,
  filterBarsThroughAsOf,
  isSgxSessionComplete,
  isSgxTradingDay,
  lastCompletedSgxTradingDay,
  sgxCalendarDate,
} from "../../src/services/ingest/sgxDate";

/** Build a Date that is `iso` at `hh:mm` in Asia/Singapore. */
function atSgt(iso: string, hh: number, mm: number): Date {
  const h = String(hh).padStart(2, "0");
  const m = String(mm).padStart(2, "0");
  return new Date(`${iso}T${h}:${m}:00+08:00`);
}

describe("sgxDate EOD guards", () => {
  test("weekends are not trading days", () => {
    assert.equal(isSgxTradingDay("2026-07-11"), false); // Sat
    assert.equal(isSgxTradingDay("2026-07-12"), false); // Sun
    assert.equal(isSgxTradingDay("2026-07-10"), true); // Fri
  });

  test("known holiday is not a trading day", () => {
    assert.equal(isSgxTradingDay("2026-01-01"), false);
    assert.equal(isSgxTradingDay("2026-02-17"), false);
  });

  test("before Friday close → last completed is prior Thursday", () => {
    // Fri 10 Jul 2026 16:59 SGT — session still open
    const now = atSgt("2026-07-10", 16, 59);
    assert.equal(isSgxSessionComplete("2026-07-10", now), false);
    assert.equal(lastCompletedSgxTradingDay(now), "2026-07-09");
  });

  test("after Friday close → Friday is complete", () => {
    const now = atSgt("2026-07-10", 17, 0);
    assert.equal(lastCompletedSgxTradingDay(now), "2026-07-10");
  });

  test("Monday mid-session → last completed is prior Friday", () => {
    // Mon 13 Jul 2026 14:00 SGT (market open) → asOf = Fri 10 Jul
    const now = atSgt("2026-07-13", 14, 0);
    assert.equal(sgxCalendarDate(now), "2026-07-13");
    assert.equal(lastCompletedSgxTradingDay(now), "2026-07-10");
  });

  test("Saturday → last completed is Friday", () => {
    const now = atSgt("2026-07-11", 12, 0);
    assert.equal(lastCompletedSgxTradingDay(now), "2026-07-10");
  });

  test("filterBarsThroughAsOf drops incomplete today bar", () => {
    const asOf = "2026-07-10";
    const bars = [
      { date: new Date("2026-07-09T00:00:00.000Z"), close: 1 },
      { date: new Date("2026-07-10T00:00:00.000Z"), close: 2 },
      { date: new Date("2026-07-13T00:00:00.000Z"), close: 3 },
    ];
    const kept = filterBarsThroughAsOf(bars, asOf);
    assert.deepEqual(
      kept.map((b) => barTradingDate(b.date)),
      ["2026-07-09", "2026-07-10"],
    );
  });

  test("addIsoDays crosses month boundaries", () => {
    assert.equal(addIsoDays("2026-07-01", -1), "2026-06-30");
  });

  test("countSgxTradingDaysAfter excludes start day and weekends", () => {
    assert.equal(countSgxTradingDaysAfter("2026-07-10", "2026-07-10"), 0);
    assert.equal(countSgxTradingDaysAfter("2026-07-10", "2026-07-13"), 1);
  });
});
