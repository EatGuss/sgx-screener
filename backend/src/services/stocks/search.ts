import { and, eq, ilike, or, sql } from "drizzle-orm";
import type { SearchResponse } from "screener-contract";
// Request-time read: runs on the read-only pool.
import { readDb as db } from "../../db/drizzleClient";
import { companies } from "../../models/screener/companies";
import { screenerMetrics } from "../../models/screener/screenerMetrics";

const SEARCH_LIMIT = 8;

/** Escape `%` / `_` so user input is treated literally in ILIKE patterns. */
function escapeLike(raw: string): string {
  return raw.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/** Top active names by market cap — default dropdown for bare `@`. */
async function topByMarketCap(): Promise<SearchResponse> {
  const rows = await db
    .select({
      ticker: companies.ticker,
      name: companies.name,
    })
    .from(companies)
    .leftJoin(screenerMetrics, eq(companies.id, screenerMetrics.companyId))
    .where(eq(companies.isActive, true))
    .orderBy(sql`${screenerMetrics.marketCap} DESC NULLS LAST`, companies.ticker)
    .limit(SEARCH_LIMIT);

  return { results: rows };
}

/**
 * Case-insensitive ticker/name search for @-mentions.
 * Empty / whitespace `q` → top 8 active by market cap desc.
 * Otherwise: ticker prefix → ticker contains → name prefix → name contains.
 */
export async function searchCompanies(q: string): Promise<SearchResponse> {
  const trimmed = q.trim();
  if (!trimmed) {
    return topByMarketCap();
  }

  const escaped = escapeLike(trimmed);
  const contains = `%${escaped}%`;
  const prefix = `${escaped}%`;

  const rows = await db
    .select({
      ticker: companies.ticker,
      name: companies.name,
    })
    .from(companies)
    .where(
      and(
        eq(companies.isActive, true),
        or(
          ilike(companies.ticker, contains),
          ilike(companies.name, contains),
        ),
      ),
    )
    .orderBy(
      sql`CASE
        WHEN ${companies.ticker} ILIKE ${prefix} THEN 0
        WHEN ${companies.ticker} ILIKE ${contains} THEN 1
        WHEN ${companies.name} ILIKE ${prefix} THEN 2
        ELSE 3
      END`,
      companies.ticker,
    )
    .limit(SEARCH_LIMIT);

  return { results: rows };
}
