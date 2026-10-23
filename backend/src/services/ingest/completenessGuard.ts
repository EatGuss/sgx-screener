/**
 * Completeness guard for the screener universe.
 *
 * Market cap is required for size bucketing, default sort, and the market-cap
 * filter. An active company whose screener_metrics.market_cap is null cannot be
 * screened properly and is deactivated. Missing earnings fields (P/E, PEG,
 * growth, etc.) are intentionally allowed.
 */
import { and, count, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../../db/drizzleClient";
import { companies } from "../../models/screener/companies";
import { screenerMetrics } from "../../models/screener/screenerMetrics";

export interface CompletenessGuardResult {
  /** Tickers deactivated this pass (sorted). */
  deactivated: string[];
  /** Active company count after the pass. */
  activeRemaining: number;
}

/**
 * Deactivates active companies whose screener_metrics row has a null market_cap.
 * Logs reason + ticker list. Idempotent on re-run.
 */
export async function deactivateMissingMarketCap(): Promise<CompletenessGuardResult> {
  const offenders = await db
    .select({
      id: companies.id,
      ticker: companies.ticker,
    })
    .from(companies)
    .innerJoin(screenerMetrics, eq(companies.id, screenerMetrics.companyId))
    .where(
      and(eq(companies.isActive, true), isNull(screenerMetrics.marketCap)),
    )
    .orderBy(companies.ticker);

  const deactivated = offenders.map((r) => r.ticker);

  if (deactivated.length > 0) {
    console.warn(
      `[completeness] Deactivating ${deactivated.length} active company(ies) ` +
        `with null screener_metrics.market_cap (required for size bucketing / ` +
        `default sort / market-cap filter). Tickers: ${deactivated.join(", ")}`,
    );

    await db
      .update(companies)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(
          eq(companies.isActive, true),
          inArray(
            companies.id,
            offenders.map((r) => r.id),
          ),
        ),
      );
  } else {
    console.log(
      "[completeness] No active companies with null market_cap — universe OK.",
    );
  }

  const activeRows = await db
    .select({ value: count() })
    .from(companies)
    .where(eq(companies.isActive, true));
  const activeRemaining = Number(activeRows[0]?.value ?? 0);

  if (deactivated.length > 0) {
    console.log(
      `[completeness] Active companies remaining: ${activeRemaining}`,
    );
  }

  return { deactivated, activeRemaining };
}
