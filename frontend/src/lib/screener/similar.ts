import type {
  FilterCondition,
  ScreenSpec,
  StockDetailResponse,
} from "screener-contract";
import { DEFAULT_SCREEN_SPEC } from "./spec";

/** Same SGX-scaled buckets as backend `marketCapBucket`. */
export type MarketCapBucket = "mega" | "large" | "mid" | "small" | "micro";

/** Inclusive raw-SGD bounds for each bucket (upper is exclusive of the next tier). */
export const MARKET_CAP_BUCKET_BOUNDS: Record<
  MarketCapBucket,
  { min: number; max: number }
> = {
  mega: { min: 50_000_000_000, max: Number.MAX_SAFE_INTEGER },
  large: { min: 5_000_000_000, max: 50_000_000_000 },
  mid: { min: 1_000_000_000, max: 5_000_000_000 },
  small: { min: 300_000_000, max: 1_000_000_000 },
  micro: { min: 0, max: 300_000_000 },
};

/** Derive bucket from market cap (mirrors backend compute). */
export function marketCapBucket(marketCap: number | null): MarketCapBucket | null {
  if (marketCap === null || !Number.isFinite(marketCap)) return null;
  if (marketCap >= 50_000_000_000) return "mega";
  if (marketCap >= 5_000_000_000) return "large";
  if (marketCap >= 1_000_000_000) return "mid";
  if (marketCap >= 300_000_000) return "small";
  return "micro";
}

/** ScreenSpec condition for a bucket's market-cap range. */
export function marketCapConditionForBucket(
  bucket: MarketCapBucket,
): FilterCondition {
  const { min, max } = MARKET_CAP_BUCKET_BOUNDS[bucket];
  // Mega has no practical upper bound — use gte so the pill reads clearly.
  if (bucket === "mega") {
    return { field: "market_cap", operator: "gte", value: min };
  }
  return { field: "market_cap", operator: "between", value: [min, max] };
}

/**
 * Find-similar: same sector + same market-cap bucket.
 * Source ticker is excluded client-side via `excludeTicker` on loadSpec.
 */
export function buildSimilarSpec(detail: StockDetailResponse): ScreenSpec {
  const conditions: ScreenSpec["conditions"] = [];

  if (detail.company.sector) {
    conditions.push({
      field: "sector",
      operator: "eq",
      value: detail.company.sector,
    });
  }

  const cap = detail.fundamentals.market_cap;
  const bucket =
    typeof cap === "number" && Number.isFinite(cap) && cap > 0
      ? marketCapBucket(cap)
      : null;

  if (bucket) {
    conditions.push(marketCapConditionForBucket(bucket));
  }

  return {
    ...DEFAULT_SCREEN_SPEC,
    conditions,
    sort: { field: "market_cap", direction: "desc" },
    page: 1,
  };
}
