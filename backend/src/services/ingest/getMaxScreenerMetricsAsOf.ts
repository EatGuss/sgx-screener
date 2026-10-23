import { max } from "drizzle-orm";
import { db } from "../../db/drizzleClient";
import { screenerMetrics } from "../../models/screener/screenerMetrics";
import { toAsOfIso } from "./catchUp";

/** `SELECT max(as_of) FROM screener_metrics`. */
export async function getMaxScreenerMetricsAsOf(): Promise<string | null> {
  const rows = await db
    .select({ asOf: max(screenerMetrics.asOf) })
    .from(screenerMetrics);
  return toAsOfIso(rows[0]?.asOf ?? null);
}
