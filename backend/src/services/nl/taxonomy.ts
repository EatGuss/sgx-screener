/**
 * Live Yahoo sector/industry vocabulary for NL parse + refine.
 *
 * Source is GET /api/facets (distinct active `companies.sector` / `.industry`).
 * Cached in-process so each NL request does not hit Postgres.
 */
import type {
  FilterCondition,
  NlRefineChange,
  ScreenSpec,
} from "screener-contract";

export interface NlTaxonomy {
  sectors: string[];
  industries: string[];
}

/** Yahoo equity sectors used only if the facets query fails. */
const YAHOO_SECTOR_FALLBACK: string[] = [
  "Basic Materials",
  "Communication Services",
  "Consumer Cyclical",
  "Consumer Defensive",
  "Energy",
  "Financial Services",
  "Healthcare",
  "Industrials",
  "Real Estate",
  "Technology",
  "Utilities",
];

/**
 * Everyday / GICS labels → Yahoo sector names.
 * Applied only when the field is `sector`.
 */
const SECTOR_ALIASES: Record<string, string> = {
  financial: "Financial Services",
  financials: "Financial Services",
  finance: "Financial Services",
  bank: "Financial Services",
  banks: "Financial Services",
  banking: "Financial Services",
  "financial services": "Financial Services",
  tech: "Technology",
  technology: "Technology",
  "information technology": "Technology",
  property: "Real Estate",
  properties: "Real Estate",
  "real estate": "Real Estate",
  reit: "Real Estate",
  reits: "Real Estate",
  healthcare: "Healthcare",
  "health care": "Healthcare",
  energy: "Energy",
  utilities: "Utilities",
  utility: "Utilities",
  industrials: "Industrials",
  industrial: "Industrials",
  materials: "Basic Materials",
  "basic materials": "Basic Materials",
  communications: "Communication Services",
  "communication services": "Communication Services",
  telecom: "Communication Services",
  telecommunications: "Communication Services",
  "consumer cyclical": "Consumer Cyclical",
  "consumer discretionary": "Consumer Cyclical",
  discretionary: "Consumer Cyclical",
  "consumer defensive": "Consumer Defensive",
  "consumer staples": "Consumer Defensive",
  staples: "Consumer Defensive",
};

const CACHE_TTL_MS = 60 * 60 * 1000;

let cached: { taxonomy: NlTaxonomy; expiresAt: number } | null = null;
let inflight: Promise<NlTaxonomy> | null = null;

export function resetNlTaxonomyCache(): void {
  cached = null;
  inflight = null;
}

export async function loadNlTaxonomy(): Promise<NlTaxonomy> {
  if (cached && cached.expiresAt > Date.now()) return cached.taxonomy;
  if (inflight) return inflight;

  const request = (async (): Promise<NlTaxonomy> => {
    try {
      const { getFacets } = await import("../facets");
      const facets = await getFacets();
      const taxonomy: NlTaxonomy = {
        sectors: facets.sectors,
        industries: facets.industries,
      };
      if (taxonomy.sectors.length === 0) {
        taxonomy.sectors = [...YAHOO_SECTOR_FALLBACK];
      }
      cached = { taxonomy, expiresAt: Date.now() + CACHE_TTL_MS };
      return taxonomy;
    } catch (err) {
      console.error(
        "[nl] Failed to load sector/industry facets; using Yahoo sector fallback.",
        err,
      );
      const taxonomy: NlTaxonomy = {
        sectors: [...YAHOO_SECTOR_FALLBACK],
        industries: [],
      };
      cached = { taxonomy, expiresAt: Date.now() + CACHE_TTL_MS };
      return taxonomy;
    }
  })();

  inflight = request;
  try {
    return await request;
  } finally {
    if (inflight === request) inflight = null;
  }
}

export function formatTaxonomyForPrompt(taxonomy: NlTaxonomy): string {
  const sectorList =
    taxonomy.sectors.length > 0
      ? taxonomy.sectors.map((s) => `- ${s}`).join("\n")
      : "- (none)";
  const industryBlock =
    taxonomy.industries.length > 0
      ? taxonomy.industries.map((s) => `- ${s}`).join("\n")
      : "- (none currently populated in the universe — do not emit industry filters)";

  return [
    "## Allowed sector and industry values (Yahoo taxonomy — authoritative)",
    "These are the ONLY valid `sector` / `industry` strings. They come from the live SGX universe (same source as GET /api/facets).",
    'Copy them **exactly**. Never invent labels such as "Financials", "Tech", or "Property".',
    "Map everyday language onto this list, for example:",
    "- banks / banking / financials → sector `Financial Services`",
    "- tech / technology → sector `Technology`",
    "- property / REITs / real estate → sector `Real Estate`",
    "Prefer `sector` over `industry` unless the user named a specific industry from the list.",
    "If a phrase cannot be mapped onto a listed value, omit that condition and add a warning.",
    "",
    `### Sectors (${taxonomy.sectors.length})`,
    sectorList,
    "",
    `### Industries (${taxonomy.industries.length})`,
    industryBlock,
  ].join("\n");
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function sectorAliasTarget(raw: string): string | undefined {
  const key = normalizeKey(raw);
  if (SECTOR_ALIASES[key]) return SECTOR_ALIASES[key];
  for (const token of key.split(/\s+/).filter(Boolean)) {
    if (SECTOR_ALIASES[token]) return SECTOR_ALIASES[token];
  }
  return undefined;
}

function compactStem(value: string): string {
  let s = normalizeKey(value).replace(/\s+/g, "");
  if (s.endsWith("ies") && s.length > 4) s = `${s.slice(0, -3)}y`;
  else if (s.endsWith("s") && !s.endsWith("ss") && s.length > 3) s = s.slice(0, -1);
  return s;
}

export type ResolveTaxonomyResult =
  | { ok: true; value: string; mappedFrom?: string }
  | { ok: false };

/**
 * Map a model-emitted sector/industry string onto the live vocabulary.
 * Empty `allowed` → pass through (cannot validate).
 */
export function resolveTaxonomyValue(
  raw: unknown,
  allowed: string[],
  field: "sector" | "industry",
): ResolveTaxonomyResult {
  if (typeof raw !== "string") return { ok: false };
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false };
  if (allowed.length === 0) return { ok: true, value: trimmed };

  const exact = allowed.find((a) => a.toLowerCase() === trimmed.toLowerCase());
  if (exact) return { ok: true, value: exact };

  if (field === "sector") {
    const alias = sectorAliasTarget(trimmed);
    if (alias) {
      const hit = allowed.find((a) => a.toLowerCase() === alias.toLowerCase());
      if (hit) return { ok: true, value: hit, mappedFrom: trimmed };
    }
  }

  const stem = compactStem(trimmed);
  if (stem.length < 4) return { ok: false };

  let best: { value: string; score: number } | null = null;
  for (const candidate of allowed) {
    const other = compactStem(candidate);
    if (!other) continue;
    let score = 0;
    if (other === stem) score = 1;
    else if (other.startsWith(stem) && stem.length >= 4) score = 0.85;
    else if (stem.startsWith(other) && other.length >= 4) score = 0.8;
    else if (other.includes(stem) || stem.includes(other)) {
      score =
        (0.65 *
          Math.min(stem.length, other.length)) /
        Math.max(stem.length, other.length);
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { value: candidate, score };
    }
  }

  if (best && best.score >= 0.45) {
    return { ok: true, value: best.value, mappedFrom: trimmed };
  }
  return { ok: false };
}

function allowedFor(
  field: FilterCondition["field"],
  taxonomy: NlTaxonomy,
): "sector" | "industry" | null {
  if (field === "sector" || field === "industry") return field;
  return null;
}

export interface CanonicalizeConditionResult {
  condition: FilterCondition | null;
  warnings: string[];
}

export function canonicalizeCondition(
  condition: FilterCondition,
  taxonomy: NlTaxonomy,
): CanonicalizeConditionResult {
  const taxonomyField = allowedFor(condition.field, taxonomy);
  if (!taxonomyField) return { condition, warnings: [] };
  const allowed =
    taxonomyField === "sector" ? taxonomy.sectors : taxonomy.industries;

  const warnings: string[] = [];

  const resolveOne = (raw: unknown): string | null => {
    const resolved = resolveTaxonomyValue(raw, allowed, taxonomyField);
    if (!resolved.ok) {
      warnings.push(
        `dropped ${condition.field} value '${String(raw)}' — not in the live Yahoo taxonomy`,
      );
      return null;
    }
    if (resolved.mappedFrom) {
      warnings.push(
        `mapped ${condition.field} '${resolved.mappedFrom}' → '${resolved.value}'`,
      );
    }
    return resolved.value;
  };

  if (condition.operator === "in") {
    if (!Array.isArray(condition.value)) {
      return { condition: null, warnings };
    }
    const next: string[] = [];
    const seen = new Set<string>();
    for (const item of condition.value) {
      const mapped = resolveOne(item);
      if (!mapped || seen.has(mapped)) continue;
      seen.add(mapped);
      next.push(mapped);
    }
    if (next.length === 0) {
      warnings.push(
        `dropped ${condition.field} filter — no values matched the live taxonomy`,
      );
      return { condition: null, warnings };
    }
    return {
      condition: { ...condition, value: next },
      warnings,
    };
  }

  const mapped = resolveOne(condition.value);
  if (!mapped) {
    return { condition: null, warnings };
  }
  return {
    condition: { ...condition, value: mapped },
    warnings,
  };
}

export function canonicalizeScreenSpec(
  spec: ScreenSpec,
  taxonomy: NlTaxonomy,
): { spec: ScreenSpec; warnings: string[] } {
  const warnings: string[] = [];
  const conditions: FilterCondition[] = [];
  for (const cond of spec.conditions) {
    const result = canonicalizeCondition(cond, taxonomy);
    warnings.push(...result.warnings);
    if (result.condition) conditions.push(result.condition);
  }
  return { spec: { ...spec, conditions }, warnings };
}

export function canonicalizeRefineChanges(
  changes: NlRefineChange[],
  taxonomy: NlTaxonomy,
): { changes: NlRefineChange[]; warnings: string[] } {
  const out: NlRefineChange[] = [];
  const warnings: string[] = [];

  for (const change of changes) {
    if (change.op === "remove") {
      out.push(change);
      continue;
    }
    if (change.op === "add") {
      const result = canonicalizeCondition(change.condition, taxonomy);
      warnings.push(...result.warnings);
      if (!result.condition) continue;
      out.push({ op: "add", condition: result.condition });
      continue;
    }
    const result = canonicalizeCondition(change.to, taxonomy);
    warnings.push(...result.warnings);
    if (!result.condition) continue;
    out.push({ op: "modify", from: change.from, to: result.condition });
  }

  return { changes: out, warnings };
}
