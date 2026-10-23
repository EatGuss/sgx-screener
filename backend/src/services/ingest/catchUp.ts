/**
 * Boot-time catch-up decision helpers (pure).
 * DB lookup lives in getMaxScreenerMetricsAsOf.ts; scheduling in jobs/.
 */
import {
  countSgxTradingDaysAfter,
  lastCompletedSgxTradingDay,
} from "./sgxDate";

/** Normalize drizzle/pg date to YYYY-MM-DD. */
export function toAsOfIso(value: string | Date | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    // date columns are calendar dates — use UTC slice to avoid TZ drift
    return value.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

export type CatchUpDecision =
  | { action: "skip"; asOf: string; target: string }
  | {
      action: "run";
      asOf: string | null;
      target: string;
      sessionsBehind: number | null;
    };

/**
 * Compare DB freshness to the last completed SGX session.
 * Never targets an open/partial session — `target` must already be EOD-complete.
 */
export function decideIngestCatchUp(
  maxAsOf: string | null,
  target: string = lastCompletedSgxTradingDay(),
): CatchUpDecision {
  if (maxAsOf != null && maxAsOf >= target) {
    return { action: "skip", asOf: maxAsOf, target };
  }
  return {
    action: "run",
    asOf: maxAsOf,
    target,
    sessionsBehind:
      maxAsOf == null ? null : countSgxTradingDaysAfter(maxAsOf, target),
  };
}

export function formatCatchUpDecision(decision: CatchUpDecision): string {
  if (decision.action === "skip") {
    return `[ingest] data current (as_of ${decision.asOf}) — skipping catch-up`;
  }
  if (decision.asOf == null || decision.sessionsBehind == null) {
    return `[ingest] no screener_metrics as_of — starting catch-up`;
  }
  return (
    `[ingest] as_of ${decision.asOf} is ${decision.sessionsBehind} ` +
    `sessions behind — starting catch-up`
  );
}
