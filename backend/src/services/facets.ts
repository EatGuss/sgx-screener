import { and, asc, eq, isNotNull } from "drizzle-orm";
import type { FacetsResponse } from "screener-contract";
// Request-time read: runs on the read-only pool.
import { readDb as db } from "../db/drizzleClient";
import { companies } from "../models/screener/companies";

/** Distinct non-null sector / industry values for active companies. */
export async function getFacets(): Promise<FacetsResponse> {
  const [sectorRows, industryRows] = await Promise.all([
    db
      .selectDistinct({ sector: companies.sector })
      .from(companies)
      .where(and(eq(companies.isActive, true), isNotNull(companies.sector)))
      .orderBy(asc(companies.sector)),
    db
      .selectDistinct({ industry: companies.industry })
      .from(companies)
      .where(and(eq(companies.isActive, true), isNotNull(companies.industry)))
      .orderBy(asc(companies.industry)),
  ]);

  return {
    sectors: sectorRows
      .map((r) => r.sector)
      .filter((v): v is string => typeof v === "string" && v.length > 0),
    industries: industryRows
      .map((r) => r.industry)
      .filter((v): v is string => typeof v === "string" && v.length > 0),
  };
}
