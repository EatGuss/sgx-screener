import {
  decideIngestCatchUp,
  formatCatchUpDecision,
} from "../services/ingest/catchUp";
import { getMaxScreenerMetricsAsOf } from "../services/ingest/getMaxScreenerMetricsAsOf";
import {
  IngestAlreadyRunningError,
  runNightlyIngestion,
} from "../services/ingest/run";
import { lastCompletedSgxTradingDay } from "../services/ingest/sgxDate";

/**
 * Env gate: default ON. Set INGEST_CATCHUP_ON_BOOT=false to disable
 * (demos / resource contention). The 21:00 SGT cron stays registered either way.
 */
export function isIngestCatchUpOnBootEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.INGEST_CATCHUP_ON_BOOT !== "false";
}

/**
 * After DB init: if screener_metrics.max(as_of) lags the last completed SGX
 * session, kick off the nightly ingest in the background so a restart after
 * downtime self-heals. Never blocks listen().
 */
export function scheduleIngestCatchUpOnBoot(): void {
  if (!isIngestCatchUpOnBootEnabled()) {
    console.log(
      "[ingest] INGEST_CATCHUP_ON_BOOT=false — skipping boot catch-up",
    );
    return;
  }

  void runIngestCatchUpOnBoot().catch((err: unknown) => {
    console.error("[ingest] boot catch-up failed:", err);
  });
}

/** Exported for tests / one-shot scripts; prefer {@link scheduleIngestCatchUpOnBoot}. */
export async function runIngestCatchUpOnBoot(): Promise<void> {
  const target = lastCompletedSgxTradingDay();
  const maxAsOf = await getMaxScreenerMetricsAsOf();
  const decision = decideIngestCatchUp(maxAsOf, target);
  console.log(formatCatchUpDecision(decision));

  if (decision.action === "skip") return;

  try {
    const result = await runNightlyIngestion();
    console.log(
      `[ingest] boot catch-up FINISH asOf=${result.asOf}: ` +
        `${result.succeeded}/${result.total} tickers succeeded` +
        (result.failed.length > 0
          ? `; failed=${result.failed.join(",")}`
          : ""),
    );
  } catch (err) {
    if (err instanceof IngestAlreadyRunningError) {
      console.warn(
        "[ingest] boot catch-up skipped — ingest already running",
      );
      return;
    }
    throw err;
  }
}
