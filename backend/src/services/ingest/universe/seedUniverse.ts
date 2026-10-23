import { and, eq, notInArray, sql } from "drizzle-orm";
import { db } from "../../../db/drizzleClient";
import { companies } from "../../../models/screener/companies";
import { LIQUID_CORE_UNIVERSE } from "./liquidCore";
import type { UniverseSeedEntry } from "./types";

export interface SeedUniverseResult {
  upserted: number;
  tickers: string[];
  deactivated: string[];
}

function toCompanyRow(entry: UniverseSeedEntry) {
  return {
    ticker: entry.ticker,
    name: entry.name,
    exchange: "SGX",
    // BOARD IS UNVERIFIED. The `board` tags in the seed lists were hand-entered
    // and are demonstrably wrong (e.g. Sasseur REIT / CRPU.SI was tagged
    // Catalist but is Mainboard). Yahoo does not supply Mainboard/Catalist, so
    // we cannot verify it from our data source. Until an SGX-sourced listing
    // is wired in, every active company is forced to 'Mainboard' rather than
    // guessing per-name. Do NOT reintroduce per-entry board tags here without
    // an authoritative SGX source. Tracked as a v1 limitation in
    // docs/HIGH_LEVEL_DESIGN.md.
    board: "Mainboard",
    sector: entry.sector ?? null,
    industry: entry.industry ?? null,
    country: entry.country ?? "SG",
    currency: entry.currency ?? "SGD",
    isActive: true,
    updatedAt: new Date(),
  };
}

/**
 * Idempotent upsert of the liquid-core universe into `companies`.
 * Re-runs update metadata in place — no duplicate tickers.
 *
 * After upserting, any existing company whose ticker is NOT in the current
 * list is marked `is_active = false` (never deleted — screener_metrics and
 * daily_prices carry FKs to it). Deactivated rows are excluded from ingestion
 * and screen queries.
 */
export async function seedUniverse(
  entries: UniverseSeedEntry[] = LIQUID_CORE_UNIVERSE,
): Promise<SeedUniverseResult> {
  const tickers: string[] = [];

  for (const entry of entries) {
    await db
      .insert(companies)
      .values(toCompanyRow(entry))
      .onConflictDoUpdate({
        target: companies.ticker,
        set: {
          name: sql`excluded.name`,
          exchange: sql`excluded.exchange`,
          board: sql`excluded.board`,
          sector: sql`excluded.sector`,
          industry: sql`excluded.industry`,
          country: sql`excluded.country`,
          currency: sql`excluded.currency`,
          isActive: sql`excluded.is_active`,
          updatedAt: new Date(),
        },
      });

    tickers.push(entry.ticker);
  }

  // Only flip currently-active rows so re-runs report 0 new deactivations.
  const deactivatedRows = await db
    .update(companies)
    .set({ isActive: false, updatedAt: new Date() })
    .where(
      and(eq(companies.isActive, true), notInArray(companies.ticker, tickers)),
    )
    .returning({ ticker: companies.ticker });

  const deactivated = deactivatedRows.map((r) => r.ticker).sort();

  return { upserted: tickers.length, tickers, deactivated };
}

/** Count of active vs inactive companies, for reporting. */
export async function companyActivityCounts(): Promise<{
  active: number;
  inactive: number;
}> {
  const active = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(companies)
    .where(eq(companies.isActive, true));
  const inactive = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(companies)
    .where(eq(companies.isActive, false));
  return {
    active: Number(active[0]?.n ?? 0),
    inactive: Number(inactive[0]?.n ?? 0),
  };
}
