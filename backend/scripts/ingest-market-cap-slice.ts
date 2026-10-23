import "dotenv/config";
import { closeDrizzle, initDrizzle } from "../src/db/drizzleClient";
import { ingestMarketCapSlice } from "../src/services/ingest/marketCapSlice";
import { YahooProvider } from "../src/services/ingest/yahoo/provider";

async function main(): Promise<void> {
  await initDrizzle();
  console.log("Ingesting market_cap slice via YahooProvider.fetchFundamentals...");
  await ingestMarketCapSlice(new YahooProvider());
  console.log("Done.");
  await closeDrizzle();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
