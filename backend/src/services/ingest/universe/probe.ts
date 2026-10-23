import type { UniverseSeedEntry } from "./types";

export interface PriceProbe {
  longName: string;
  quoteType: string;
  currency: string;
  exchangeName: string;
}

export interface ProbeResult {
  ok: boolean;
  errors: string[];
  price: PriceProbe;
}

const CORP_SUFFIX =
  /\b(ltd|limited|trust|reit|plc|inc|corp|co|pte|group|holdings|singapore|the|public|company)\b/g;

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(CORP_SUFFIX, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function namesDifferMaterially(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return true;
  if (na === nb) return false;
  if (na.includes(nb) || nb.includes(na)) return false;

  const aWords = new Set(na.split(" ").filter((w) => w.length > 2));
  const bWords = new Set(nb.split(" ").filter((w) => w.length > 2));
  let overlap = 0;
  for (const w of aWords) {
    if (bWords.has(w)) overlap++;
  }
  const ratio = overlap / Math.max(aWords.size, 1);
  if (aWords.size <= 2 || bWords.size <= 2) {
    return ratio < 1;
  }
  return ratio < 0.5;
}

/** Reject ETF/index products when the intended name is a plain equity. */
export function isEtfLikeName(name: string, intendedName: string): boolean {
  if (/\b(etf|index fund|tracker)\b/i.test(intendedName)) return false;
  return /\b(etf|index fund|tracker)\b/i.test(name);
}

export function extractPrice(qs: Record<string, unknown>): PriceProbe {
  const price = (qs.price ?? {}) as Record<string, unknown>;
  const str = (v: unknown): string =>
    typeof v === "string" && v.length > 0 ? v : "—";
  return {
    longName: str(price.longName ?? price.shortName),
    quoteType: str(price.quoteType),
    currency: str(price.currency),
    exchangeName: str(price.exchangeName),
  };
}

export function classifyProbe(
  intendedName: string,
  lookupError: string | null,
  price: PriceProbe,
  options: { requireNameMatch?: boolean } = {},
): ProbeResult {
  const requireNameMatch = options.requireNameMatch ?? true;
  const errors: string[] = [];
  if (lookupError) errors.push(lookupError);
  if (price.quoteType !== "—" && price.quoteType !== "EQUITY") {
    errors.push(`quoteType=${price.quoteType}`);
  }
  if (price.currency !== "—" && price.currency !== "SGD") {
    errors.push(`currency=${price.currency}`);
  }
  if (price.longName === "—") errors.push("missing longName");
  if (price.longName !== "—" && isEtfLikeName(price.longName, intendedName)) {
    errors.push("ETF/index product");
  }
  if (
    requireNameMatch &&
    !lookupError &&
    price.longName !== "—" &&
    namesDifferMaterially(intendedName, price.longName)
  ) {
    errors.push("name mismatch (wrong ticker mapping)");
  }
  return { ok: errors.length === 0, errors, price };
}

export function isNameOnlyMismatch(probe: ProbeResult): boolean {
  return (
    probe.errors.length === 1 &&
    probe.errors[0] === "name mismatch (wrong ticker mapping)"
  );
}

export function entryFromProbe(
  ticker: string,
  entry: UniverseSeedEntry,
  price: PriceProbe,
): UniverseSeedEntry {
  return {
    ...entry,
    ticker,
    name: price.longName,
  };
}

interface SearchQuote {
  symbol?: string;
  quoteType?: string;
  exchange?: string;
  longname?: string;
  shortname?: string;
}

export function siSearchCandidatesOrdered(
  searchResult: Record<string, unknown>,
): string[] {
  const quotes = (searchResult.quotes as SearchQuote[]) ?? [];
  const symbols: string[] = [];
  for (const q of quotes) {
    if (typeof q.symbol === "string" && q.symbol.endsWith(".SI")) {
      symbols.push(q.symbol);
    }
  }
  return symbols;
}

export function siSearchCandidates(searchResult: Record<string, unknown>): string[] {
  return [...new Set(siSearchCandidatesOrdered(searchResult))];
}

/** Build fallback search queries when the full seed name returns no .SI hits. */
export function searchQueryVariants(intendedName: string): string[] {
  const stripped = intendedName
    .replace(/\b(ltd|limited|trust|reit|plc|inc|corp|co|pte|public|company)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const words = stripped.split(" ").filter((w) => w.length > 1);
  const variants = [intendedName, stripped];
  if (words.length >= 2) variants.push(words.slice(0, 2).join(" "));
  if (words.length >= 3) variants.push(words.slice(0, 3).join(" "));
  return [...new Set(variants.filter((v) => v.length > 0))];
}
