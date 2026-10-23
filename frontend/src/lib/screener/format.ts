/** Format a monetary value in SGD with an explicit S$ prefix. Null → em dash. */
export function formatSgd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const amount = value.toLocaleString("en-SG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `S$${amount}`;
}

/** Compact market-cap display (e.g. S$52.3B). */
export function formatMarketCap(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) {
    return `S$${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (abs >= 1_000_000) {
    return `S$${(value / 1_000_000).toFixed(1)}M`;
  }
  return formatSgd(value);
}

/** Contract stores ratios as decimals (0.04 = 4%). */
export function formatPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

/** Generic numeric display (e.g. P/E). Null → em dash. */
export function formatNumber(
  value: number | null | undefined,
  digits = 1,
): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-SG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

/** UI whole-percent input → API decimal (4 → 0.04). */
export function percentToDecimal(wholePercent: number): number {
  return wholePercent / 100;
}

/** API decimal → UI whole-percent display (0.04 → 4). */
export function decimalToPercent(decimal: number): number {
  return decimal * 100;
}

/** Parse billions input (e.g. "5" → 5_000_000_000). */
export function billionsToRaw(billions: number): number {
  return billions * 1_000_000_000;
}

/** Raw market cap → billions for control display. */
export function rawToBillions(value: number): number {
  return value / 1_000_000_000;
}

/**
 * Format an ingest as-of ISO date (YYYY-MM-DD) for display, e.g. "11 Jul 2026".
 * Parsed as UTC calendar date to avoid timezone day-shifts.
 */
export function formatAsOfDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) return isoDate;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
