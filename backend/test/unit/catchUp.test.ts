import assert from "node:assert/strict";
import { describe, test } from "vitest";
import {
  decideIngestCatchUp,
  formatCatchUpDecision,
  toAsOfIso,
} from "../../src/services/ingest/catchUp";
import { countSgxTradingDaysAfter } from "../../src/services/ingest/sgxDate";

describe("ingest catch-up decision", () => {
  test("current as_of → skip", () => {
    const d = decideIngestCatchUp("2026-08-06", "2026-08-06");
    assert.deepEqual(d, {
      action: "skip",
      asOf: "2026-08-06",
      target: "2026-08-06",
    });
    assert.equal(
      formatCatchUpDecision(d),
      "[ingest] data current (as_of 2026-08-06) — skipping catch-up",
    );
  });

  test("stale as_of → run with session gap", () => {
    // Thu 2026-07-23 … Thu 2026-07-30 inclusive after 07-23: 5 sessions
    // (24,27,28,29,30) — use a known week without holidays
    const d = decideIngestCatchUp("2026-07-23", "2026-07-30");
    assert.equal(d.action, "run");
    if (d.action !== "run") return;
    assert.equal(d.asOf, "2026-07-23");
    assert.equal(d.sessionsBehind, 5);
    assert.equal(
      formatCatchUpDecision(d),
      "[ingest] as_of 2026-07-23 is 5 sessions behind — starting catch-up",
    );
  });

  test("empty metrics → run without session count", () => {
    const d = decideIngestCatchUp(null, "2026-08-06");
    assert.deepEqual(d, {
      action: "run",
      asOf: null,
      target: "2026-08-06",
      sessionsBehind: null,
    });
    assert.equal(
      formatCatchUpDecision(d),
      "[ingest] no screener_metrics as_of — starting catch-up",
    );
  });

  test("countSgxTradingDaysAfter skips weekends", () => {
    // Fri → Mon is 1 session (Mon), not Sat/Sun
    assert.equal(countSgxTradingDaysAfter("2026-07-10", "2026-07-13"), 1);
  });

  test("toAsOfIso normalizes Date and string", () => {
    assert.equal(toAsOfIso("2026-08-06"), "2026-08-06");
    assert.equal(toAsOfIso(new Date("2026-08-06T00:00:00.000Z")), "2026-08-06");
    assert.equal(toAsOfIso(null), null);
  });
});
