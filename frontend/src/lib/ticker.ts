/**
 * Ticker dialects. Keep conversions here — do not strip/append suffixes
 * inline at call sites or the forms will drift.
 *
 * - yahoo / screener: exchange-suffixed Yahoo symbols (`D05.SI`, `AAPL`,
 *   `7203.T`) — what ingest stores and the screener displays
 * - bare: SGX codes without `.SI` (`D05`), the form SGX itself publishes.
 *   `toModdTicker` / `toYahooTicker` are inverses for SGX names:
 *   `D05.SI` ↔ `D05`. (The "modd" name is historical.)
 */

/** Normalize whitespace + case. Empty input stays empty. */
function normalize(ticker: string): string {
  return ticker.trim().toUpperCase();
}

/**
 * Yahoo / screener form. Bare SGX-style equity codes (no `.` / `-` / `=`) get
 * `.SI` so lookups stay consistent with the screener.
 * Tickers that already carry an exchange suffix or Yahoo special form are left alone.
 */
export function toYahooTicker(ticker: string): string {
  const t = normalize(ticker);
  if (!t) return t;
  if (t.includes(".") || t.includes("-") || t.includes("=")) return t;
  return `${t}.SI`;
}

/** Alias of `toYahooTicker`; kept from an earlier watchlist integration. */
export function toWatchlistTicker(ticker: string): string {
  return toYahooTicker(ticker);
}

/**
 * Bare SGX code (`D05`, not `D05.SI`). Strips a trailing `.SI` only; other Yahoo suffixes
 * (`7203.T`) and special forms (`BTC-USD`, `GC=F`) are left alone.
 */
export function toModdTicker(ticker: string): string {
  return normalize(ticker).replace(/\.SI$/i, "");
}
