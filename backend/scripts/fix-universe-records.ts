/**
 * One-off remediation:
 *  (1) find companies present under two ACTIVE tickers (duplicate name) and
 *      deactivate the stale symbol (the one not in the current seed list);
 *  (2) confirm S61.SI=SBS Transit, S08.SI=SingPost from Yahoo, C61.SI inactive;
 *  (3) set board='Mainboard' for all active companies (board is unverified).
 *
 * Usage: npx tsx scripts/fix-universe-records.ts
 */
import "dotenv/config";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { closeDrizzle, db, initDrizzle } from "../src/db/drizzleClient";
import { companies } from "../src/models/screener/companies";
import { LIQUID_CORE_UNIVERSE } from "../src/services/ingest/universe/liquidCore";
import { extractPrice } from "../src/services/ingest/universe/probe";
import { YahooProvider } from "../src/services/ingest/yahoo/provider";

async function step1DuplicateNames(): Promise<void> {
  console.log("=".repeat(64));
  console.log("(1) Duplicate-name check on ACTIVE companies");
  console.log("=".repeat(64));

  const dupes = await db.execute(sql`
    SELECT lower(name) AS name_key, array_agg(ticker ORDER BY ticker) AS tickers, count(*)::int AS n
    FROM companies
    WHERE is_active = true
    GROUP BY lower(name)
    HAVING count(*) > 1
  `);

  if (dupes.rows.length === 0) {
    console.log("No active company appears under two tickers.\n");
    return;
  }

  const seedTickers = new Set(LIQUID_CORE_UNIVERSE.map((e) => e.ticker));

  for (const row of dupes.rows as Array<{ name_key: string; tickers: string[]; n: number }>) {
    console.log(`\nDuplicate: "${row.name_key}" under ${JSON.stringify(row.tickers)}`);
    const stale = row.tickers.filter((t) => !seedTickers.has(t));
    const kept = row.tickers.filter((t) => seedTickers.has(t));

    if (kept.length === 0) {
      console.log("  Neither ticker is in the seed list — leaving for manual review.");
      continue;
    }

    if (stale.length === 0) {
      console.log("  Both tickers are in the seed list — leaving for manual review.");
      continue;
    }

    const deactivated = await db
      .update(companies)
      .set({ isActive: false, updatedAt: new Date() })
      .where(inArray(companies.ticker, stale))
      .returning({ ticker: companies.ticker });

    console.log(`  Keeping ${JSON.stringify(kept)} (in seed list)`);
    console.log(`  Deactivated stale: ${JSON.stringify(deactivated.map((d) => d.ticker))}`);
  }
  console.log();
}

async function step2VerifyTickers(provider: YahooProvider): Promise<void> {
  console.log("=".repeat(64));
  console.log("(2) Verify S61.SI / S08.SI names and C61.SI inactive");
  console.log("=".repeat(64));

  for (const [ticker, expected] of [
    ["S61.SI", "SBS Transit"],
    ["S08.SI", "SingPost / Singapore Post"],
  ] as const) {
    try {
      const qs = await provider.fetchQuoteSummary(ticker, ["price"]);
      const price = extractPrice(qs);
      console.log(`  ${ticker}: Yahoo longName = "${price.longName}" (expected ${expected})`);
    } catch (err) {
      console.log(`  ${ticker}: lookup FAILED — ${(err as Error).message}`);
    }
  }

  const rows = await db
    .select({
      ticker: companies.ticker,
      name: companies.name,
      isActive: companies.isActive,
    })
    .from(companies)
    .where(inArray(companies.ticker, ["S61.SI", "S08.SI", "C61.SI"]));

  console.log("\n  DB state:");
  for (const r of rows.sort((a, b) => a.ticker.localeCompare(b.ticker))) {
    console.log(`    ${r.ticker}  active=${r.isActive}  name="${r.name}"`);
  }
  console.log();
}

async function step3BoardMainboard(): Promise<void> {
  console.log("=".repeat(64));
  console.log("(3) Set board='Mainboard' for all ACTIVE companies (unverified)");
  console.log("=".repeat(64));

  const before = await db
    .select({ board: companies.board, n: sql<number>`count(*)::int` })
    .from(companies)
    .where(eq(companies.isActive, true))
    .groupBy(companies.board);
  console.log("  Active board breakdown BEFORE:");
  for (const r of before) console.log(`    ${r.board ?? "(null)"}: ${r.n}`);

  const updated = await db
    .update(companies)
    .set({ board: "Mainboard", updatedAt: new Date() })
    .where(and(eq(companies.isActive, true), ne(companies.board, "Mainboard")))
    .returning({ ticker: companies.ticker });
  console.log(`\n  Rows changed to Mainboard: ${updated.length} ${JSON.stringify(updated.map((u) => u.ticker))}`);

  const after = await db
    .select({ board: companies.board, n: sql<number>`count(*)::int` })
    .from(companies)
    .where(eq(companies.isActive, true))
    .groupBy(companies.board);
  console.log("\n  Active board breakdown AFTER:");
  for (const r of after) console.log(`    ${r.board ?? "(null)"}: ${r.n}`);
  console.log();
}

async function main(): Promise<void> {
  await initDrizzle();
  const provider = new YahooProvider();

  await step1DuplicateNames();
  await step2VerifyTickers(provider);
  await step3BoardMainboard();

  const active = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(companies)
    .where(eq(companies.isActive, true));
  console.log(`Final active count: ${Number(active[0]?.n ?? 0)}`);

  await closeDrizzle();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
