/**
 * Ticker dialects used across this app. Keep conversions here — do not
 * strip/append suffixes inline at call sites or the three forms will drift.
 *
 * - yahoo / screener / watchlist: exchange-suffixed Yahoo symbols (`D05.SI`, `AAPL`,
 *   `7203.T`) — display, quotes, and watchlist storage
 * - modd: bare SGX codes without `.SI` (`D05`) — `/stocks/:ticker`, compare URLs,
 *   TRACKED_UNIVERSE, and `sd_stocks` storage. `toModdTicker` / `toYahooTicker`
 *   are inverses for SGX names: `D05.SI` ↔ `D05`.
 */

/** Normalize whitespace + case. Empty input stays empty. */
function normalize(ticker: string): string {
  return ticker.trim().toUpperCase();
}

/**
 * Yahoo / screener form. Bare SGX-style equity codes (no `.` / `-` / `=`) get
 * `.SI` so watchlist quotes and search stay consistent with the screener.
 * Tickers that already carry an exchange suffix or Yahoo special form are left alone.
 */
export function toYahooTicker(ticker: string): string {
  const t = normalize(ticker);
  if (!t) return t;
  if (t.includes(".") || t.includes("-") || t.includes("=")) return t;
  return `${t}.SI`;
}

/** Form stored on watchlist rows (Yahoo symbols). */
export function toWatchlistTicker(ticker: string): string {
  return toYahooTicker(ticker);
}

/**
 * MOD-D / `/stocks/:ticker` / compare identity. Bare SGX codes are canonical
 * (`D05`, not `D05.SI`). Strips a trailing `.SI` only; other Yahoo suffixes
 * (`7203.T`) and special forms (`BTC-USD`, `GC=F`) are left alone.
 */
export function toModdTicker(ticker: string): string {
  return normalize(ticker).replace(/\.SI$/i, "");
}
