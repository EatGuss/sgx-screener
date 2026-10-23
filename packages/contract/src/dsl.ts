import { z } from "zod";

/**
 * Every metric a user can filter or sort on.
 * These map 1:1 to columns on the `screener_metrics` table in the backend.
 *
 * CONVENTION: ratios stored as decimal fractions (0.02 = 2%), not whole percents.
 */
export const ScreenerField = z.enum([
  // identity
  "exchange",
  "board",
  "sector",
  "industry",
  "market_cap",
  "country",
  // valuation
  "pe",
  "pb",
  "ps",
  "peg",
  // profitability
  "profit_margin",
  "operating_margin",
  "roe",
  "roa",
  "eps",
  // growth
  "revenue_growth_yoy",
  "earnings_growth_yoy",
  // financial health
  "debt_to_equity",
  "free_cash_flow",
  "fcf_margin",
  // dividends
  "dividend_yield",
  "payout_ratio",
  // price & technicals
  "price",
  "pct_from_52w_high",
  "pct_from_52w_low",
  "price_vs_50ma",
  "price_vs_200ma",
  "rsi_14",
  // volume & momentum
  "avg_volume_30d",
  "perf_1d",
  "perf_1w",
  "perf_1m",
  "perf_ytd",
  "perf_1y",
]);
export type ScreenerField = z.infer<typeof ScreenerField>;

/** Comparison operators a condition can use. */
export const Operator = z.enum(["gt", "gte", "lt", "lte", "eq", "between", "in"]);
export type Operator = z.infer<typeof Operator>;

/**
 * A single filter condition, e.g. { field: "pe", operator: "lt", value: 15 }.
 *
 * `value` shape depends on the operator:
 *   - between → [min, max]   (two numbers)
 *   - in      → string[]     (e.g. a set of sectors or exchanges)
 *   - others  → number | string
 *
 * The superRefine enforces that operator/value combinations are coherent,
 * so the LLM (or a buggy client) cannot emit a malformed condition.
 */
export const FilterCondition = z
  .object({
    field: ScreenerField,
    operator: Operator,
    value: z.union([
      z.number(),
      z.string(),
      z.tuple([z.number(), z.number()]),
      z.array(z.string()),
    ]),
  })
  .superRefine((cond, ctx) => {
    const isNumberPair =
      Array.isArray(cond.value) &&
      cond.value.length === 2 &&
      typeof cond.value[0] === "number" &&
      typeof cond.value[1] === "number";
    const isStringArray =
      Array.isArray(cond.value) && cond.value.every((v) => typeof v === "string");

    if (cond.operator === "between" && !isNumberPair) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "`between` requires value to be [min, max] numbers",
      });
    }
    if (cond.operator === "in" && !isStringArray) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "`in` requires value to be a string array",
      });
    }
  });
export type FilterCondition = z.infer<typeof FilterCondition>;

/**
 * The canonical representation of a screen — the "Filter DSL".
 * Produced by the manual builder, the presets, and the NL parser;
 * consumed by the backend SQL compiler. AND logic across conditions.
 */
export const ScreenSpec = z.object({
  conditions: z.array(FilterCondition),
  sort: z
    .object({
      field: ScreenerField,
      direction: z.enum(["asc", "desc"]),
    })
    .optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(200).default(50),
});
export type ScreenSpec = z.infer<typeof ScreenSpec>;
