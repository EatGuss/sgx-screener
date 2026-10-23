import "dotenv/config";
import { closeDrizzle, db, initDrizzle } from "../src/db/drizzleClient";
import { companies } from "../src/models/screener/companies";
import { LIQUID_CORE_UNIVERSE } from "../src/services/ingest/universe/liquidCore";
import {
  companyActivityCounts,
  seedUniverse,
} from "../src/services/ingest/universe/seedUniverse";
import { count, eq, sql } from "drizzle-orm";

async function main(): Promise<void> {
  await initDrizzle();

  console.log(`Liquid-core universe: ${LIQUID_CORE_UNIVERSE.length} tickers`);
  const before = await db.select({ value: count() }).from(companies);
  const beforeCount = Number(before[0]?.value ?? 0);

  const result = await seedUniverse();
  console.log(`Upserted ${result.upserted} companies`);

  const after = await db.select({ value: count() }).from(companies);
  const afterCount = Number(after[0]?.value ?? 0);

  const activity = await companyActivityCounts();

  const boardRows = await db
    .select({
      board: companies.board,
      n: count(),
    })
    .from(companies)
    .where(eq(companies.isActive, true))
    .groupBy(companies.board);

  const catalist = await db
    .select({ ticker: companies.ticker, board: companies.board })
    .from(companies)
    .where(eq(companies.board, "Catalist"));

  console.log(`\ncompanies row count: ${beforeCount} -> ${afterCount}`);
  console.log(`Active: ${activity.active}, Inactive: ${activity.inactive}`);
  console.log(`\nDeactivated tickers (${result.deactivated.length}):`);
  for (const ticker of result.deactivated) {
    console.log(`  ${ticker}`);
  }
  console.log("\nBoard breakdown (active only):");
  for (const row of boardRows) {
    console.log(`  ${row.board ?? "(null)"}: ${row.n}`);
  }
  console.log(`\nCatalist tickers (${catalist.length}):`);
  for (const row of catalist) {
    console.log(`  ${row.ticker}`);
  }

  // Re-run to confirm idempotency (count must not grow, no new deactivations).
  const rerunResult = await seedUniverse();
  const rerun = await db.select({ value: count() }).from(companies);
  const rerunCount = Number(rerun[0]?.value ?? 0);
  console.log(`\nRe-run row count: ${rerunCount} (expected ${afterCount}, no duplicates)`);
  console.log(
    `Re-run deactivated: ${rerunResult.deactivated.length} (expected 0 — all stale rows already inactive)`,
  );

  const dupes = await db.execute(sql`
    SELECT ticker, COUNT(*)::int AS n
    FROM companies
    GROUP BY ticker
    HAVING COUNT(*) > 1
  `);
  if (dupes.rows.length > 0) {
    console.error("Duplicate tickers found:", dupes.rows);
    process.exitCode = 1;
  } else {
    console.log("No duplicate tickers.");
  }

  const nameDupes = await db.execute(sql`
    SELECT name, COUNT(*)::int AS n, array_agg(ticker ORDER BY ticker) AS tickers
    FROM companies
    WHERE is_active = true
    GROUP BY name
    HAVING COUNT(*) > 1
  `);
  if (nameDupes.rows.length > 0) {
    console.error("Duplicate active names found:", nameDupes.rows);
    process.exitCode = 1;
  } else {
    console.log("No duplicate active names (GROUP BY name HAVING COUNT(*) > 1 = 0 rows).");
  }

  await closeDrizzle();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
