import "dotenv/config";
import { closeDrizzle, initDrizzle } from "../src/db/drizzleClient";
import { seedMiniUniverse } from "../src/services/ingest/universe/miniSeed";

async function main(): Promise<void> {
  await initDrizzle();
  const map = await seedMiniUniverse();
  console.log(`Seeded ${map.size} companies:`);
  for (const [ticker, id] of map) {
    console.log(`  ${ticker} -> id ${id}`);
  }
  await closeDrizzle();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
