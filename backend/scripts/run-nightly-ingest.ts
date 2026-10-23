import "dotenv/config";
import { closeDrizzle, initDrizzle } from "../src/db/drizzleClient";
import { runNightlyIngestion } from "../src/services/ingest/run";

async function main(): Promise<void> {
  await initDrizzle();
  const result = await runNightlyIngestion();
  console.log("\nSummary:", JSON.stringify(result, null, 2));
  await closeDrizzle();
  process.exit(result.failed.length > 0 ? 1 : 0);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
