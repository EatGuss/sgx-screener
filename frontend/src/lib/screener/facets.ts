import { getScreenerApi } from "./api";

export interface CompanyFacets {
  sectors: string[];
  industries: string[];
}

let cachedFacets: CompanyFacets | null = null;
let inflight: Promise<CompanyFacets> | null = null;

/**
 * Load distinct sector/industry values once via GET /api/facets.
 * No AbortSignal — this is a one-shot cached call, not tied to filter
 * debounce or React effect cleanup (StrictMode remounts must not cancel it).
 * Failures are never cached so a later call can retry.
 */
export async function fetchCompanyFacets(): Promise<CompanyFacets> {
  if (cachedFacets) return cachedFacets;
  if (inflight) return inflight;

  const request = (async (): Promise<CompanyFacets> => {
    const facets = await getScreenerApi().getFacets();
    const loaded: CompanyFacets = {
      sectors: facets.sectors,
      industries: facets.industries,
    };
    cachedFacets = loaded;
    return loaded;
  })();

  inflight = request;

  try {
    return await request;
  } catch (err) {
    // Do not poison the cache — clear so the next caller retries.
    cachedFacets = null;
    throw err;
  } finally {
    if (inflight === request) {
      inflight = null;
    }
  }
}

/** Clear cached facets (tests / hot reload). */
export function resetCompanyFacetsCache(): void {
  cachedFacets = null;
  inflight = null;
}
