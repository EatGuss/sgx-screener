/** SGX-scaled market-cap buckets (raw SGD). */
export function marketCapBucket(marketCap: number | null): string | null {
  if (marketCap === null || !Number.isFinite(marketCap)) return null;
  if (marketCap >= 50_000_000_000) return "mega";
  if (marketCap >= 5_000_000_000) return "large";
  if (marketCap >= 1_000_000_000) return "mid";
  if (marketCap >= 300_000_000) return "small";
  return "micro";
}
