import cron from "node-cron";
import {
  IngestAlreadyRunningError,
  runNightlyIngestion,
} from "../services/ingest/run";

/**
 * Nightly screener ingestion schedule.
 *
 * Default: 21:00 Asia/Singapore daily — after SGX close (17:00 SGT).
 * Override with CRON_INGEST_SCHEDULE (5-field cron) and optionally
 * CRON_INGEST_TIMEZONE (IANA name; default Asia/Singapore).
 *
 * Missed ticks while the process is down are healed on next boot by
 * scheduleIngestCatchUpOnBoot() (INGEST_CATCHUP_ON_BOOT, default on).
 */
const DEFAULT_SCHEDULE = "0 21 * * *";
const DEFAULT_TIMEZONE = "Asia/Singapore";

export function registerNightlyIngestJob(): void {
  const schedule = process.env.CRON_INGEST_SCHEDULE ?? DEFAULT_SCHEDULE;
  const timezone = process.env.CRON_INGEST_TIMEZONE ?? DEFAULT_TIMEZONE;

  if (!cron.validate(schedule)) {
    console.error(
      `[cron] Invalid CRON_INGEST_SCHEDULE "${schedule}" — nightly ingest NOT registered`,
    );
    return;
  }

  cron.schedule(
    schedule,
    async () => {
      const startedAt = new Date();
      console.log(
        `[cron] Nightly ingest START at ${startedAt.toISOString()} (${timezone})`,
      );
      try {
        const result = await runNightlyIngestion();
        console.log(
          `[cron] Nightly ingest FINISH asOf=${result.asOf}: ` +
            `${result.succeeded}/${result.total} tickers succeeded` +
            (result.failed.length > 0
              ? `; failed=${result.failed.join(",")}`
              : ""),
        );
        if (result.corporateActionWarnings.length > 0) {
          console.warn(
            `[cron] Corporate-action warnings: ${result.corporateActionWarnings.length}`,
          );
        }
        if (result.completeness.deactivated.length > 0) {
          console.warn(
            `[cron] Completeness: deactivated ${result.completeness.deactivated.length} ` +
              `null-market_cap ticker(s): ${result.completeness.deactivated.join(", ")}; ` +
              `activeRemaining=${result.completeness.activeRemaining}`,
          );
        }
      } catch (err) {
        if (err instanceof IngestAlreadyRunningError) {
          console.warn(
            "[cron] Nightly ingest skipped — ingest already running",
          );
          return;
        }
        console.error("[cron] Nightly ingest FAILURE:", err);
      }
    },
    { timezone },
  );

  console.log(
    `[cron] Nightly ingest job registered (${schedule} ${timezone}). ` +
      `Missed runs while down are backfilled on boot when INGEST_CATCHUP_ON_BOOT is enabled.`,
  );
}
