/** Screener → /compare selection limits (must match Compare.tsx). */
export const SCREENER_COMPARE_MIN = 2;
export const SCREENER_COMPARE_MAX = 5;

export interface CompareSelectionItem {
  /** Bare SGX / MOD-D code (e.g. D05) — same dialect as PriceChart → /compare. */
  ticker: string;
  name: string;
}

/** Build `/compare?tickers=…` for the current selection (bare codes, comma-separated). */
export function buildCompareUrl(items: CompareSelectionItem[]): string {
  const tickers = items.map((i) => i.ticker).filter(Boolean);
  const params = new URLSearchParams({ tickers: tickers.join(",") });
  return `/compare?${params.toString()}`;
}
