/**
 * SGX calendar helpers for EOD ingestion.
 *
 * Product rule: never stamp a partial/intraday session as a close.
 * `as_of` and stored daily bars must end at the latest *completed* SGX
 * trading day (regular close 17:00 Asia/Singapore; early-close days at 12:00).
 */

export const SGX_TIMEZONE = "Asia/Singapore";

/** Regular equity session close (SGT). */
export const SGX_REGULAR_CLOSE = { hour: 17, minute: 0 } as const;

/** Full-day SGX closures (weekdays). Extend yearly as calendars are published. */
const SGX_FULL_HOLIDAYS = new Set<string>([
  // 2025
  "2025-01-01",
  "2025-01-29",
  "2025-01-30",
  "2025-03-31",
  "2025-04-18",
  "2025-05-01",
  "2025-05-12",
  "2025-10-20",
  "2025-12-25",
  // 2026 (Mom gazette + SGX early-close calendar)
  "2026-01-01",
  "2026-02-17",
  "2026-02-18",
  "2026-04-03",
  "2026-05-01",
  "2026-05-27",
  "2026-06-01", // Vesak observed (Sun 31 May)
  "2026-08-10", // National Day observed (Sun 9 Aug)
  "2026-11-09", // Deepavali observed (Sun 8 Nov)
  "2026-12-25",
]);

/** Half-day sessions — complete after 12:00 SGT. */
const SGX_EARLY_CLOSE = new Map<string, { hour: number; minute: number }>([
  ["2025-01-28", { hour: 12, minute: 0 }],
  ["2025-12-24", { hour: 12, minute: 0 }],
  ["2025-12-31", { hour: 12, minute: 0 }],
  ["2026-02-16", { hour: 12, minute: 0 }],
  ["2026-12-24", { hour: 12, minute: 0 }],
  ["2026-12-31", { hour: 12, minute: 0 }],
]);

export interface SgxWallClock {
  date: string; // YYYY-MM-DD
  hour: number;
  minute: number;
  /** 0 = Sunday … 6 = Saturday (ISO-like via Date.UTC weekday). */
  weekday: number;
}

/** Calendar date (YYYY-MM-DD) in Asia/Singapore. */
export function sgxCalendarDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SGX_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Wall-clock parts in Asia/Singapore. */
export function sgxWallClock(now: Date = new Date()): SgxWallClock {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: SGX_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(now).map((p) => [p.type, p.value]),
  );
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  // Derive weekday from the SGT calendar date at noon to avoid DST/edge issues.
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const weekday = new Date(Date.UTC(y, m - 1, d, 4, 0, 0)).getUTCDay();
  return { date, hour, minute, weekday };
}

/** Trading-day label for a Yahoo/chart bar timestamp (SGT calendar). */
export function barTradingDate(date: Date): string {
  return sgxCalendarDate(date);
}

export function isWeekendIso(isoDate: string): boolean {
  const [y, m, d] = isoDate.split("-").map(Number) as [number, number, number];
  const weekday = new Date(Date.UTC(y, m - 1, d, 4, 0, 0)).getUTCDay();
  return weekday === 0 || weekday === 6;
}

export function isSgxFullHoliday(isoDate: string): boolean {
  return SGX_FULL_HOLIDAYS.has(isoDate);
}

/** True if SGX has a scheduled equity session on this calendar day. */
export function isSgxTradingDay(isoDate: string): boolean {
  return !isWeekendIso(isoDate) && !isSgxFullHoliday(isoDate);
}

export function sessionCloseClock(isoDate: string): { hour: number; minute: number } {
  return SGX_EARLY_CLOSE.get(isoDate) ?? SGX_REGULAR_CLOSE;
}

/** Whether the session on `isoDate` has fully closed relative to `now`. */
export function isSgxSessionComplete(isoDate: string, now: Date = new Date()): boolean {
  if (!isSgxTradingDay(isoDate)) return false;
  const clock = sgxWallClock(now);
  if (clock.date > isoDate) return true;
  if (clock.date < isoDate) return false;
  const close = sessionCloseClock(isoDate);
  return (
    clock.hour > close.hour ||
    (clock.hour === close.hour && clock.minute >= close.minute)
  );
}

/** Add/subtract whole calendar days from a YYYY-MM-DD string. */
export function addIsoDays(isoDate: string, deltaDays: number): string {
  const [y, m, d] = isoDate.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays, 4, 0, 0));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/**
 * Latest SGX trading day whose session is complete.
 * If run before today's close (or on a weekend/holiday), walks backward.
 */
export function lastCompletedSgxTradingDay(now: Date = new Date()): string {
  let candidate = sgxCalendarDate(now);
  for (let i = 0; i < 21; i++) {
    if (isSgxSessionComplete(candidate, now)) {
      return candidate;
    }
    candidate = addIsoDays(candidate, -1);
  }
  throw new Error(
    `Could not find a completed SGX trading day near ${sgxCalendarDate(now)}`,
  );
}

/**
 * Count SGX trading sessions in `(afterExclusive, throughInclusive]`.
 * Used by boot catch-up to log how many completed sessions the DB is behind.
 */
export function countSgxTradingDaysAfter(
  afterExclusive: string,
  throughInclusive: string,
): number {
  if (afterExclusive >= throughInclusive) return 0;
  let count = 0;
  let d = addIsoDays(afterExclusive, 1);
  for (let i = 0; i < 800 && d <= throughInclusive; i++) {
    if (isSgxTradingDay(d)) count++;
    d = addIsoDays(d, 1);
  }
  return count;
}

/** End of the completed session in absolute time (for Yahoo period2). */
export function endOfCompletedSession(asOf: string): Date {
  const close = sessionCloseClock(asOf);
  const hh = String(close.hour).padStart(2, "0");
  const mm = String(close.minute).padStart(2, "0");
  return new Date(`${asOf}T${hh}:${mm}:00+08:00`);
}

/**
 * Drop bars after `asOf` (incomplete / future sessions).
 * Dates are interpreted in Asia/Singapore.
 */
export function filterBarsThroughAsOf<T extends { date: Date }>(
  bars: readonly T[],
  asOf: string,
): T[] {
  return bars.filter((b) => barTradingDate(b.date) <= asOf);
}
