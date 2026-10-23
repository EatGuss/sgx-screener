import type { NlDescribeResponse, ScreenSpec } from "screener-contract";
import { getScreenerApi } from "@/lib/screener/api";

/** Stable cache key — conditions + sort only (ignore page). */
export function describeSpecCacheKey(spec: ScreenSpec): string {
  return JSON.stringify({
    conditions: spec.conditions,
    sort: spec.sort ?? null,
  });
}

const cache = new Map<string, Promise<NlDescribeResponse>>();

/**
 * Describe a screen once per unique spec. Failures are not cached so a later
 * retry (e.g. after the API key is set) can succeed.
 *
 * Callers must not block save on this — treat rejection as "no suggestion".
 */
export function describeScreenCached(
  spec: ScreenSpec,
  signal?: AbortSignal,
): Promise<NlDescribeResponse> {
  const key = describeSpecCacheKey(spec);
  const existing = cache.get(key);
  if (existing) return existing;

  const pending = getScreenerApi()
    .describeNl({ spec }, signal)
    .catch((err: unknown) => {
      cache.delete(key);
      throw err;
    });
  cache.set(key, pending);
  return pending;
}

/** Test helper — clear in-memory describe cache. */
export function clearDescribeCache(): void {
  cache.clear();
}
