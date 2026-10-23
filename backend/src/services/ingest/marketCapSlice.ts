import { eq } from "drizzle-orm";
import { db } from "../../db/drizzleClient";
import { companies } from "../../models/screener/companies";
import { screenerMetrics } from "../../models/screener/screenerMetrics";
import { marketCapBucket } from "../compute/marketCapBucket";
import { lastCompletedSgxTradingDay } from "./sgxDate";
import { YahooProvider } from "./yahoo/provider";

export async function ingestMarketCapSlice(
  provider: YahooProvider = new YahooProvider(),
): Promise<void> {
  const rows = await db
    .select({ id: companies.id, ticker: companies.ticker })
    .from(companies)
    .where(eq(companies.isActive, true));

  const asOf = lastCompletedSgxTradingDay();

  for (const row of rows) {
    const raw = await provider.fetchFundamentals(row.ticker);
    const cap = raw.marketCap;
    const bucket = marketCapBucket(cap);

    await db
      .insert(screenerMetrics)
      .values({
        companyId: row.id,
        asOf,
        marketCap: cap === null ? null : String(cap),
        marketCapBucket: bucket,
      })
      .onConflictDoUpdate({
        target: screenerMetrics.companyId,
        set: {
          asOf,
          marketCap: cap === null ? null : String(cap),
          marketCapBucket: bucket,
          updatedAt: new Date(),
        },
      });
  }
}
