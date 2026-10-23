/**
 * generate-nl-glossary.ts
 *
 * Computes percentile thresholds from live screener_metrics (active companies,
 * non-null only via percentile_cont) and writes:
 *   1. backend/src/services/nl/glossary.generated.ts  — NL concept thresholds
 *   2. packages/contract/src/filterBands.generated.ts — filter quick-option bands
 *
 * Usage (from backend/):
 *   npm run nl:glossary
 *
 * Regenerate whenever the liquid-core universe or nightly metrics change.
 * Commit both generated files so threshold drift is reviewable.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import type { Operator, ScreenerField } from "screener-contract";

type FieldKind = "percent" | "ratio" | "rsi" | "currency";

/** Which end of the distribution users usually care about first. */
type Prefer = "high" | "low";

interface ConceptDef {
  id: string;
  phrases: string[];
  /** Which tail: high = p75 + gte, low = p25 + lte. */
  tail: "high" | "low";
}

interface FieldSpec {
  column: string;
  field: ScreenerField;
  kind: FieldKind;
  prefer: Prefer;
  /**
   * Labels for the three quick bands (in display order).
   * prefer=high → Above p75 / p50–p75 / p25–p50
   * prefer=low  → Below p25 / p25–p50 / p50–p75
   */
  quickLabels: [string, string, string];
  concepts: ConceptDef[];
}

const FIELD_SPECS: FieldSpec[] =
[
    {
      column: "dividend_yield",
      field: "dividend_yield",
      kind: "percent",
      prefer: "high",
      quickLabels: ["Very high (top quartile)", "High", "Moderate"],
      concepts: [
        { id: "high_yield", phrases: ["high yield", "high dividend", "income"], tail: "high" },
        { id: "low_yield", phrases: ["low yield", "low dividend"], tail: "low" },
      ],
    },
    {
      column: "pe",
      field: "pe",
      kind: "ratio",
      prefer: "low",
      quickLabels: ["Cheap (bottom quartile)", "Reasonable", "Elevated"],
      concepts: [
        { id: "cheap_pe", phrases: ["cheap", "inexpensive", "low pe", "cheap valuation"], tail: "low" },
        { id: "expensive_pe", phrases: ["expensive", "high pe", "rich valuation"], tail: "high" },
      ],
    },
    {
      column: "pb",
      field: "pb",
      kind: "ratio",
      prefer: "low",
      quickLabels: ["Cheap book (bottom quartile)", "Reasonable", "Elevated"],
      concepts: [
        { id: "cheap_pb", phrases: ["cheap book", "low pb", "low price to book"], tail: "low" },
        { id: "expensive_pb", phrases: ["expensive book", "high pb"], tail: "high" },
      ],
    },
    {
      column: "ps",
      field: "ps",
      kind: "ratio",
      prefer: "low",
      quickLabels: ["Cheap sales (bottom quartile)", "Reasonable", "Elevated"],
      concepts: [
        { id: "cheap_ps", phrases: ["cheap sales", "low ps", "low price to sales"], tail: "low" },
        { id: "expensive_ps", phrases: ["expensive sales", "high ps"], tail: "high" },
      ],
    },
    {
      column: "peg",
      field: "peg",
      kind: "ratio",
      prefer: "low",
      quickLabels: ["Cheap growth (bottom quartile)", "Reasonable", "Elevated"],
      concepts: [],
    },
    {
      column: "profit_margin",
      field: "profit_margin",
      kind: "percent",
      prefer: "high",
      quickLabels: ["Very high (top quartile)", "High", "Moderate"],
      concepts: [
        { id: "very_profitable", phrases: ["very profitable", "high profit margin", "high margin"], tail: "high" },
        { id: "not_profitable", phrases: ["not profitable", "low profit margin", "thin margin"], tail: "low" },
      ],
    },
    {
      column: "operating_margin",
      field: "operating_margin",
      kind: "percent",
      prefer: "high",
      quickLabels: ["Very high (top quartile)", "High", "Moderate"],
      concepts: [
        { id: "high_operating_margin", phrases: ["high operating margin", "strong operating margin"], tail: "high" },
        { id: "low_operating_margin", phrases: ["low operating margin", "weak operating margin"], tail: "low" },
      ],
    },
    {
      column: "roe",
      field: "roe",
      kind: "percent",
      prefer: "high",
      quickLabels: ["Very high (top quartile)", "High", "Moderate"],
      concepts: [
        { id: "high_roe", phrases: ["high roe", "high return on equity"], tail: "high" },
        { id: "low_roe", phrases: ["low roe", "low return on equity"], tail: "low" },
      ],
    },
    {
      column: "roa",
      field: "roa",
      kind: "percent",
      prefer: "high",
      quickLabels: ["Very high (top quartile)", "High", "Moderate"],
      concepts: [
        { id: "high_roa", phrases: ["high roa", "high return on assets"], tail: "high" },
        { id: "low_roa", phrases: ["low roa", "low return on assets"], tail: "low" },
      ],
    },
    {
      column: "eps",
      field: "eps",
      kind: "currency",
      prefer: "high",
      quickLabels: ["Very high (top quartile)", "High", "Moderate"],
      concepts: [],
    },
    {
      column: "revenue_growth_yoy",
      field: "revenue_growth_yoy",
      kind: "percent",
      prefer: "high",
      quickLabels: ["Strong (top quartile)", "Solid", "Modest"],
      concepts: [
        { id: "strong_revenue_growth", phrases: ["strong growth", "high revenue growth", "growing revenue"], tail: "high" },
        { id: "weak_revenue_growth", phrases: ["weak growth", "low revenue growth", "shrinking revenue"], tail: "low" },
      ],
    },
    {
      column: "earnings_growth_yoy",
      field: "earnings_growth_yoy",
      kind: "percent",
      prefer: "high",
      quickLabels: ["Strong (top quartile)", "Solid", "Modest"],
      concepts: [
        { id: "strong_earnings_growth", phrases: ["strong earnings growth", "high earnings growth"], tail: "high" },
        { id: "weak_earnings_growth", phrases: ["weak earnings growth", "low earnings growth"], tail: "low" },
      ],
    },
    {
      column: "debt_to_equity",
      field: "debt_to_equity",
      kind: "ratio",
      prefer: "low",
      quickLabels: ["Low (bottom quartile)", "Moderate", "Elevated"],
      concepts: [
        { id: "low_debt", phrases: ["low debt", "low leverage", "conservative balance sheet"], tail: "low" },
        { id: "high_debt", phrases: ["high debt", "high leverage", "levered"], tail: "high" },
      ],
    },
    {
      column: "free_cash_flow",
      field: "free_cash_flow",
      kind: "currency",
      prefer: "high",
      quickLabels: ["Very high (top quartile)", "High", "Moderate"],
      concepts: [],
    },
    {
      column: "fcf_margin",
      field: "fcf_margin",
      kind: "percent",
      prefer: "high",
      quickLabels: ["Very high (top quartile)", "High", "Moderate"],
      concepts: [
        { id: "strong_fcf", phrases: ["strong fcf", "high fcf margin", "strong free cash flow"], tail: "high" },
        { id: "weak_fcf", phrases: ["weak fcf", "low fcf margin", "weak free cash flow"], tail: "low" },
      ],
    },
    {
      column: "payout_ratio",
      field: "payout_ratio",
      kind: "percent",
      prefer: "high",
      quickLabels: ["Very high (top quartile)", "High", "Moderate"],
      concepts: [
        { id: "high_payout", phrases: ["high payout", "high payout ratio"], tail: "high" },
        { id: "low_payout", phrases: ["low payout", "low payout ratio"], tail: "low" },
      ],
    },
    {
      column: "price",
      field: "price",
      kind: "currency",
      prefer: "high",
      quickLabels: ["Very high (top quartile)", "High", "Moderate"],
      concepts: [],
    },
    {
      column: "pct_from_52w_high",
      field: "pct_from_52w_high",
      kind: "percent",
      prefer: "high",
      quickLabels: ["Near highs (top quartile)", "Elevated", "Moderate"],
      concepts: [],
    },
    {
      column: "pct_from_52w_low",
      field: "pct_from_52w_low",
      kind: "percent",
      prefer: "high",
      quickLabels: ["Far from lows (top quartile)", "Elevated", "Moderate"],
      concepts: [],
    },
    {
      column: "price_vs_50ma",
      field: "price_vs_50ma",
      kind: "percent",
      prefer: "high",
      quickLabels: ["Well above (top quartile)", "Above", "Near"],
      concepts: [],
    },
    {
      column: "price_vs_200ma",
      field: "price_vs_200ma",
      kind: "percent",
      prefer: "high",
      quickLabels: ["Well above (top quartile)", "Above", "Near"],
      concepts: [],
    },
    {
      column: "rsi_14",
      field: "rsi_14",
      kind: "rsi",
      prefer: "low",
      quickLabels: ["Oversold (bottom quartile)", "Neutral-low", "Elevated"],
      concepts: [
        { id: "oversold", phrases: ["oversold", "low rsi"], tail: "low" },
        { id: "overbought", phrases: ["overbought", "high rsi"], tail: "high" },
      ],
    },
    {
      column: "market_cap",
      field: "market_cap",
      kind: "currency",
      prefer: "high",
      quickLabels: ["Large (top quartile)", "Mid-large", "Smaller"],
      concepts: [
        { id: "large_cap", phrases: ["large cap", "big cap", "mega cap"], tail: "high" },
        { id: "small_cap", phrases: ["small cap", "smaller companies"], tail: "low" },
      ],
    },
    {
      column: "avg_volume_30d",
      field: "avg_volume_30d",
      kind: "ratio",
      prefer: "high",
      quickLabels: ["Very high (top quartile)", "High", "Moderate"],
      concepts: [],
    },
    {
      column: "perf_1d",
      field: "perf_1d",
      kind: "percent",
      prefer: "high",
      quickLabels: ["Strong (top quartile)", "Positive", "Soft"],
      concepts: [],
    },
    {
      column: "perf_1w",
      field: "perf_1w",
      kind: "percent",
      prefer: "high",
      quickLabels: ["Strong (top quartile)", "Positive", "Soft"],
      concepts: [],
    },
    {
      column: "perf_1m",
      field: "perf_1m",
      kind: "percent",
      prefer: "high",
      quickLabels: ["Strong (top quartile)", "Positive", "Soft"],
      concepts: [],
    },
    {
      column: "perf_ytd",
      field: "perf_ytd",
      kind: "percent",
      prefer: "high",
      quickLabels: ["Strong (top quartile)", "Positive", "Soft"],
      concepts: [],
    },
    {
      column: "perf_1y",
      field: "perf_1y",
      kind: "percent",
      prefer: "high",
      quickLabels: ["Strong (top quartile)", "Positive", "Soft"],
      concepts: [
        { id: "strong_perf_1y", phrases: ["strong performers", "winners", "up a lot this year", "high 1y return"], tail: "high" },
        { id: "weak_perf_1y", phrases: ["laggards", "losers", "weak performers", "down this year"], tail: "low" },
      ],
    },
  ];

interface PercentileRow {
  p25: number | null;
  p50: number | null;
  p75: number | null;
  n: number;
}

function roundValue(kind: FieldKind, raw: number): number {
  switch (kind) {
    case "percent":
      return Math.round(raw * 10_000) / 10_000;
    case "ratio":
      // avg_volume is large — special-case via column somehow; for volume round to int
      if (raw >= 1000) return Math.round(raw);
      return Math.round(raw * 10) / 10;
    case "rsi":
      return Math.round(raw * 10) / 10;
    case "currency": {
      if (Math.abs(raw) >= 1_000_000) {
        const step = 10_000_000;
        return Math.round(raw / step) * step;
      }
      return Math.round(raw * 100) / 100;
    }
    default:
      return raw;
  }
}

function formatDisplay(kind: FieldKind, value: number, field?: ScreenerField): string {
  switch (kind) {
    case "percent": {
      const pct = value * 100;
      const abs = Math.abs(pct);
      const digits = abs >= 10 ? 1 : abs >= 1 ? 1 : 2;
      return `${pct.toFixed(digits)}%`;
    }
    case "ratio":
      if (field === "avg_volume_30d") {
        return value.toLocaleString("en-SG", { maximumFractionDigits: 0 });
      }
      return value.toFixed(1);
    case "rsi":
      return value.toFixed(1);
    case "currency": {
      const abs = Math.abs(value);
      if (field === "market_cap" || abs >= 1_000_000_000) {
        return `S$${(value / 1_000_000_000).toFixed(1)}B`;
      }
      if (abs >= 1_000_000) return `S$${(value / 1_000_000).toFixed(0)}M`;
      return `S$${value.toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    default:
      return String(value);
  }
}

async function fetchPercentiles(
  pool: Pool,
  column: string,
): Promise<PercentileRow> {
  const sql = `
    SELECT
      percentile_cont(0.25) WITHIN GROUP (ORDER BY v) AS p25,
      percentile_cont(0.50) WITHIN GROUP (ORDER BY v) AS p50,
      percentile_cont(0.75) WITHIN GROUP (ORDER BY v) AS p75,
      COUNT(*)::int AS n
    FROM (
      SELECT m.${column}::float8 AS v
      FROM screener_metrics m
      INNER JOIN companies c ON c.id = m.company_id
      WHERE c.is_active = true
        AND m.${column} IS NOT NULL
    ) t
  `;

  const { rows } = await pool.query<{
    p25: string | number | null;
    p50: string | number | null;
    p75: string | number | null;
    n: number;
  }>(sql);

  const row = rows[0];
  if (!row) return { p25: null, p50: null, p75: null, n: 0 };

  const toNum = (v: string | number | null): number | null => {
    if (v == null) return null;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  };

  return {
    p25: toNum(row.p25),
    p50: toNum(row.p50),
    p75: toNum(row.p75),
    n: row.n,
  };
}

type BandOperator = Extract<Operator, "gte" | "lte" | "between">;

interface GeneratedBandOption {
  id: string;
  /** Primary line shown in the popover, e.g. "Above 9.8% — Very high (top quartile)". */
  label: string;
  /** Secondary line: e.g. "SGX liquid-core · p75 · n=52". */
  basis: string;
  operator: BandOperator;
  value: number | [number, number];
}

interface GeneratedFieldBands {
  field: ScreenerField;
  sampleSize: number;
  p25: number;
  p50: number;
  p75: number;
  options: GeneratedBandOption[];
}

function buildQuickBands(
  spec: FieldSpec,
  p25: number,
  p50: number,
  p75: number,
  n: number,
): GeneratedBandOption[] {
  const r25 = roundValue(spec.kind, p25);
  const r50 = roundValue(spec.kind, p50);
  const r75 = roundValue(spec.kind, p75);
  const d25 = formatDisplay(spec.kind, r25, spec.field);
  const d50 = formatDisplay(spec.kind, r50, spec.field);
  const d75 = formatDisplay(spec.kind, r75, spec.field);
  const [lab0, lab1, lab2] = spec.quickLabels;

  const basis = (pct: string) =>
    `SGX liquid-core · ${pct} · n=${n}`;

  if (spec.prefer === "high") {
    return [
      {
        id: `${spec.field}_above_p75`,
        label: `Above ${d75} — ${lab0}`,
        basis: basis("p75 (top quartile)"),
        operator: "gte",
        value: r75,
      },
      {
        id: `${spec.field}_p50_p75`,
        label: `${d50}–${d75} — ${lab1}`,
        basis: basis("p50–p75"),
        operator: "between",
        value: [r50, r75],
      },
      {
        id: `${spec.field}_p25_p50`,
        label: `${d25}–${d50} — ${lab2}`,
        basis: basis("p25–p50"),
        operator: "between",
        value: [r25, r50],
      },
    ];
  }

  // prefer === "low" (cheap PE, low debt, oversold RSI)
  return [
    {
      id: `${spec.field}_below_p25`,
      label: `Below ${d25} — ${lab0}`,
      basis: basis("p25 (bottom quartile)"),
      operator: "lte",
      value: r25,
    },
    {
      id: `${spec.field}_p25_p50`,
      label: `${d25}–${d50} — ${lab1}`,
      basis: basis("p25–p50"),
      operator: "between",
      value: [r25, r50],
    },
    {
      id: `${spec.field}_p50_p75`,
      label: `${d50}–${d75} — ${lab2}`,
      basis: basis("p50–p75"),
      operator: "between",
      value: [r50, r75],
    },
  ];
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const { rows: metaRows } = await pool.query<{
      active_count: number;
      metrics_as_of: string | null;
    }>(`
      SELECT
        (SELECT COUNT(*)::int FROM companies WHERE is_active = true) AS active_count,
        (SELECT MAX(as_of)::text FROM screener_metrics) AS metrics_as_of
    `);
    const meta = metaRows[0]!;
    const generatedAt = new Date().toISOString().slice(0, 10);

    const concepts: Array<{
      id: string;
      phrases: string[];
      field: ScreenerField;
      operator: Extract<Operator, "gte" | "lte">;
      value: number;
      display: string;
      percentile: 25 | 75;
      sampleSize: number;
      quartileLabel: "top quartile" | "bottom quartile";
    }> = [];

    const bandsByField: Record<string, GeneratedFieldBands> = {};

    console.log(
      "Computing percentile_cont (p25/p50/p75) for active companies, non-null only…\n",
    );

    for (const spec of FIELD_SPECS) {
      const { p25, p50, p75, n } = await fetchPercentiles(pool, spec.column);
      console.log(
        `${spec.field.padEnd(22)} n=${String(n).padStart(3)}  p25=${p25 ?? "null"}  p50=${p50 ?? "null"}  p75=${p75 ?? "null"}`,
      );

      if (p25 == null || p50 == null || p75 == null || n === 0) {
        console.warn(`  ⚠ skipping ${spec.field} — insufficient data`);
        continue;
      }

      for (const def of spec.concepts) {
        const percentile: 25 | 75 = def.tail === "high" ? 75 : 25;
        const raw = def.tail === "high" ? p75 : p25;
        const value = roundValue(spec.kind, raw);
        const display = formatDisplay(spec.kind, value, spec.field);
        const operator: Extract<Operator, "gte" | "lte"> =
          def.tail === "high" ? "gte" : "lte";
        const quartileLabel =
          def.tail === "high" ? "top quartile" : "bottom quartile";

        concepts.push({
          id: def.id,
          phrases: def.phrases,
          field: spec.field,
          operator,
          value,
          display,
          percentile,
          sampleSize: n,
          quartileLabel,
        });
      }

      const r25 = roundValue(spec.kind, p25);
      const r50 = roundValue(spec.kind, p50);
      const r75 = roundValue(spec.kind, p75);

      bandsByField[spec.field] = {
        field: spec.field,
        sampleSize: n,
        p25: r25,
        p50: r50,
        p75: r75,
        options: buildQuickBands(spec, p25, p50, p75, n),
      };
    }

    const glossaryPath = path.resolve(
      __dirname,
      "../src/services/nl/glossary.generated.ts",
    );
    const glossaryBody = `/**
 * AUTO-GENERATED — do not edit by hand.
 *
 * Regenerated by: npm run nl:glossary
 * (backend/scripts/generate-nl-glossary.ts)
 *
 * Thresholds are percentile_cont(0.25/0.75) over non-null screener_metrics
 * for active companies. Regenerate when the universe or nightly data changes;
 * commit this file so NL threshold drift is reviewable.
 *
 * generatedAt: ${generatedAt}
 * metricsAsOf: ${meta.metrics_as_of ?? "null"}
 * activeCompanyCount: ${meta.active_count}
 */
import type { Operator, ScreenerField } from "screener-contract";

export interface GeneratedGlossaryConcept {
  id: string;
  phrases: string[];
  field: ScreenerField;
  operator: Extract<Operator, "gte" | "lte">;
  value: number;
  display: string;
  percentile: 25 | 75;
  sampleSize: number;
  quartileLabel: "top quartile" | "bottom quartile";
}

export interface GeneratedGlossary {
  generatedAt: string;
  metricsAsOf: string | null;
  activeCompanyCount: number;
  concepts: GeneratedGlossaryConcept[];
}

export const NL_GLOSSARY: GeneratedGlossary = ${JSON.stringify(
      {
        generatedAt,
        metricsAsOf: meta.metrics_as_of,
        activeCompanyCount: meta.active_count,
        concepts,
      },
      null,
      2,
    )};
`;
    fs.writeFileSync(glossaryPath, `${glossaryBody}\n`, "utf8");
    console.log(`\nWrote ${concepts.length} concepts → ${glossaryPath}`);

    const bandsPath = path.resolve(
      __dirname,
      "../../packages/contract/src/filterBands.generated.ts",
    );
    const bandsBody = `/**
 * AUTO-GENERATED — do not edit by hand.
 *
 * Regenerated by: npm run nl:glossary
 * (backend/scripts/generate-nl-glossary.ts)
 *
 * Quick-option bands for numeric filter popovers. Values are
 * percentile_cont(0.25/0.50/0.75) over non-null screener_metrics for active
 * SGX liquid-core names. Never invent thresholds — regenerate from live data.
 *
 * generatedAt: ${generatedAt}
 * metricsAsOf: ${meta.metrics_as_of ?? "null"}
 * activeCompanyCount: ${meta.active_count}
 */
import type { Operator, ScreenerField } from "./dsl";

export interface FilterBandOption {
  id: string;
  label: string;
  basis: string;
  operator: Extract<Operator, "gte" | "lte" | "between">;
  value: number | [number, number];
}

export interface FieldFilterBands {
  field: ScreenerField;
  sampleSize: number;
  p25: number;
  p50: number;
  p75: number;
  options: FilterBandOption[];
}

export interface FilterBandsCatalog {
  generatedAt: string;
  metricsAsOf: string | null;
  activeCompanyCount: number;
  byField: Partial<Record<ScreenerField, FieldFilterBands>>;
}

export const FILTER_BANDS: FilterBandsCatalog = ${JSON.stringify(
      {
        generatedAt,
        metricsAsOf: meta.metrics_as_of,
        activeCompanyCount: meta.active_count,
        byField: bandsByField,
      },
      null,
      2,
    )};
`;
    fs.writeFileSync(bandsPath, `${bandsBody}\n`, "utf8");
    console.log(
      `Wrote ${Object.keys(bandsByField).length} field band sets → ${bandsPath}`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
