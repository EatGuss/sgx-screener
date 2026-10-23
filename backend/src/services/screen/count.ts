import { and, count, eq } from "drizzle-orm";
import type { ScreenSpec } from "screener-contract";
// Request-time read: runs on the read-only pool.
import { readDb as db } from "../../db/drizzleClient";
import { companies } from "../../models/screener/companies";
import { screenerMetrics } from "../../models/screener/screenerMetrics";
import { compileWhere } from "./compile";

export async function countScreen(spec: ScreenSpec): Promise<number> {
  const compiled = compileWhere(spec);
  // Inactive companies are never eligible for a screen.
  const where = compiled
    ? and(eq(companies.isActive, true), compiled)
    : eq(companies.isActive, true);

  const result = await db
    .select({ value: count() })
    .from(companies)
    .innerJoin(screenerMetrics, eq(companies.id, screenerMetrics.companyId))
    .where(where);

  return Number(result[0]?.value ?? 0);
}
