import type { ScreenerField } from "./dsl";

/** How a field is entered/displayed in the builder UI. */
export type FieldKind = "number" | "percent" | "currency" | "enum";

export interface FieldDef {
  field: ScreenerField;
  label: string;
  kind: FieldKind;
  group: string;
  /** Currency code for `currency` fields. SGX values are in SGD. */
  unit?: string;
  /** For enum fields, the allowed values. (sector/industry are populated from data.) */
  options?: string[];
  /** Sensible default slider bounds for numeric fields. */
  min?: number;
  max?: number;
}

/**
 * Metadata for every filterable field. Drives the sidebar controls,
 * grouping, labels, and value formatting.
 *
 * SGX launch notes:
 *  - Monetary fields are in SGD (the company's native currency).
 *  - `exchange` is effectively constant ('SGX') for now but retained for
 *    multi-market readiness; `board` is the useful SGX identity distinction.
 *  - Percent fields hold decimals (0.05 = 5%); the UI multiplies by 100.
 */
export const FIELD_DEFS: Record<ScreenerField, FieldDef> = {
  // identity
  exchange: { field: "exchange", label: "Exchange", kind: "enum", group: "Identity", options: ["SGX"] },
  board: { field: "board", label: "Board", kind: "enum", group: "Identity", options: ["Mainboard", "Catalist"] },
  sector: { field: "sector", label: "Sector", kind: "enum", group: "Identity" },
  industry: { field: "industry", label: "Industry", kind: "enum", group: "Identity" },
  market_cap: { field: "market_cap", label: "Market Cap", kind: "currency", group: "Identity", unit: "SGD" },
  country: { field: "country", label: "Country", kind: "enum", group: "Identity", options: ["SG"] },

  // valuation
  pe: { field: "pe", label: "P/E", kind: "number", group: "Valuation", min: 0, max: 100 },
  pb: { field: "pb", label: "P/B", kind: "number", group: "Valuation", min: 0, max: 50 },
  ps: { field: "ps", label: "P/S", kind: "number", group: "Valuation", min: 0, max: 50 },
  peg: { field: "peg", label: "PEG", kind: "number", group: "Valuation", min: 0, max: 10 },

  // profitability
  profit_margin: { field: "profit_margin", label: "Profit Margin", kind: "percent", group: "Profitability" },
  operating_margin: { field: "operating_margin", label: "Operating Margin", kind: "percent", group: "Profitability" },
  roe: { field: "roe", label: "ROE", kind: "percent", group: "Profitability" },
  roa: { field: "roa", label: "ROA", kind: "percent", group: "Profitability" },
  eps: { field: "eps", label: "EPS", kind: "currency", group: "Profitability", unit: "SGD" },

  // growth
  revenue_growth_yoy: { field: "revenue_growth_yoy", label: "Revenue Growth YoY", kind: "percent", group: "Growth" },
  earnings_growth_yoy: { field: "earnings_growth_yoy", label: "Earnings Growth YoY", kind: "percent", group: "Growth" },

  // financial health
  debt_to_equity: { field: "debt_to_equity", label: "Debt / Equity", kind: "number", group: "Financial Health", min: 0, max: 5 },
  free_cash_flow: { field: "free_cash_flow", label: "Free Cash Flow", kind: "currency", group: "Financial Health", unit: "SGD" },
  fcf_margin: { field: "fcf_margin", label: "FCF Margin", kind: "percent", group: "Financial Health" },

  // dividends
  dividend_yield: { field: "dividend_yield", label: "Dividend Yield", kind: "percent", group: "Dividends" },
  payout_ratio: { field: "payout_ratio", label: "Payout Ratio", kind: "percent", group: "Dividends" },

  // price & technicals
  price: { field: "price", label: "Current Price", kind: "currency", group: "Price & Technicals", unit: "SGD" },
  pct_from_52w_high: { field: "pct_from_52w_high", label: "% from 52W High", kind: "percent", group: "Price & Technicals" },
  pct_from_52w_low: { field: "pct_from_52w_low", label: "% from 52W Low", kind: "percent", group: "Price & Technicals" },
  price_vs_50ma: { field: "price_vs_50ma", label: "Price vs 50-day MA", kind: "percent", group: "Price & Technicals" },
  price_vs_200ma: { field: "price_vs_200ma", label: "Price vs 200-day MA", kind: "percent", group: "Price & Technicals" },
  rsi_14: { field: "rsi_14", label: "RSI (14)", kind: "number", group: "Price & Technicals", min: 0, max: 100 },

  // volume & momentum
  avg_volume_30d: { field: "avg_volume_30d", label: "Avg Daily Volume (30d)", kind: "number", group: "Volume & Momentum", min: 0 },
  perf_1d: { field: "perf_1d", label: "Performance 1D", kind: "percent", group: "Volume & Momentum" },
  perf_1w: { field: "perf_1w", label: "Performance 1W", kind: "percent", group: "Volume & Momentum" },
  perf_1m: { field: "perf_1m", label: "Performance 1M", kind: "percent", group: "Volume & Momentum" },
  perf_ytd: { field: "perf_ytd", label: "Performance YTD", kind: "percent", group: "Volume & Momentum" },
  perf_1y: { field: "perf_1y", label: "Performance 1Y", kind: "percent", group: "Volume & Momentum" },
};

/** Convenience: field defs grouped by their `group`, for rendering sidebar sections. */
export const FIELD_GROUPS: Record<string, FieldDef[]> = Object.values(FIELD_DEFS).reduce(
  (acc, def) => {
    (acc[def.group] ??= []).push(def);
    return acc;
  },
  {} as Record<string, FieldDef[]>,
);
