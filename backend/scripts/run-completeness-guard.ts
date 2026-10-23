/**
 * One-shot: deactivate active companies with null screener_metrics.market_cap.
 * Usage (from backend/): npx tsx scripts/run-completeness-guard.ts
 */
import "dotenv/config";
import { closeDrizzle, initDrizzle } from "../src/db/drizzleClient";
import { deactivateMissingMarketCap } from "../src/services/ingest/completenessGuard";

async function main(): Promise<void> {
  await initDrizzle();
  const result = await deactivateMissingMarketCap();
  console.log("\nSummary:", JSON.stringify(result, null, 2));
  await closeDrizzle();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
