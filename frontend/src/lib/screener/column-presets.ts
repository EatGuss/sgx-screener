import {
  FIELD_DEFS,
  FIELD_GROUPS,
  type ScreenerField,
  type StockRow,
} from "screener-contract";
import {
  formatMarketCap,
  formatNumber,
  formatPercent,
  formatSgd,
} from "./format";

export type ColumnPresetId =
  | "overview"
  | "valuation"
  | "profitability"
  | "growth"
  | "dividends"
  | "price_technicals";

/** Tab ids including the user-defined Custom set. */
export type ColumnTabId = ColumnPresetId | "custom";

export interface ColumnPreset {
  id: ColumnPresetId;
  label: string;
  /** ScreenerFields to show (plus pinned ticker/name and sparkline). */
  fields: ScreenerField[];
}

/**
 * Column tabs driven by FIELD_GROUPS. Overview keeps the current default set.
 */
export const COLUMN_PRESETS: ColumnPreset[] = [
  {
    id: "overview",
    label: "Overview",
    fields: ["market_cap", "price", "pe", "dividend_yield", "perf_1y"],
  },
  {
    id: "valuation",
    label: "Valuation",
    fields: ["pe", "pb", "ps", "peg"],
  },
  {
    id: "profitability",
    label: "Profitability",
    fields: ["profit_margin", "operating_margin", "roe", "roa", "eps"],
  },
  {
    id: "growth",
    label: "Growth",
    fields: ["revenue_growth_yoy", "earnings_growth_yoy"],
  },
  {
    id: "dividends",
    label: "Dividends",
    fields: ["dividend_yield", "payout_ratio"],
  },
  {
    id: "price_technicals",
    label: "Price & Technicals",
    fields: [
      "price",
      "pct_from_52w_high",
      "pct_from_52w_low",
      "price_vs_50ma",
      "price_vs_200ma",
      "rsi_14",
    ],
  },
];

/**
 * Compact Overview columns for narrow viewports (~375px).
 * Ticker + name stay pinned; column tabs still unlock fuller presets.
 */
export const MOBILE_OVERVIEW_FIELDS: ScreenerField[] = [
  "market_cap",
  "price",
  "perf_1y",
];

/** Resolve visible metric columns for the active preset / viewport. */
export function resolveColumnFields(
  presetId: ColumnPresetId,
  fields: ScreenerField[],
  isMobile: boolean,
): ScreenerField[] {
  if (isMobile && presetId === "overview") {
    return MOBILE_OVERVIEW_FIELDS;
  }
  return fields;
}

/** StockRow accessors for every ScreenerField the results API returns. */
export const ROW_VALUE: Partial<
  Record<ScreenerField, (row: StockRow) => number | null>
> = {
  market_cap: (r) => r.marketCap,
  pe: (r) => r.pe,
  pb: (r) => r.pb,
  ps: (r) => r.ps,
  peg: (r) => r.peg,
  profit_margin: (r) => r.profitMargin,
  operating_margin: (r) => r.operatingMargin,
  roe: (r) => r.roe,
  roa: (r) => r.roa,
  eps: (r) => r.eps,
  revenue_growth_yoy: (r) => r.revenueGrowthYoy,
  earnings_growth_yoy: (r) => r.earningsGrowthYoy,
  debt_to_equity: (r) => r.debtToEquity,
  free_cash_flow: (r) => r.freeCashFlow,
  fcf_margin: (r) => r.fcfMargin,
  dividend_yield: (r) => r.dividendYield,
  payout_ratio: (r) => r.payoutRatio,
  price: (r) => r.price,
  pct_from_52w_high: (r) => r.pctFrom52wHigh,
  pct_from_52w_low: (r) => r.pctFrom52wLow,
  price_vs_50ma: (r) => r.priceVs50ma,
  price_vs_200ma: (r) => r.priceVs200ma,
  rsi_14: (r) => r.rsi14,
  avg_volume_30d: (r) => r.avgVolume30d,
  perf_1d: (r) => r.perf1d,
  perf_1w: (r) => r.perf1w,
  perf_1m: (r) => r.perf1m,
  perf_ytd: (r) => r.perfYtd,
  perf_1y: (r) => r.perf1y,
};

/** Metrics that can appear as results columns (excludes identity enums). */
export const COLUMNABLE_FIELDS: ScreenerField[] = (
  Object.keys(ROW_VALUE) as ScreenerField[]
).filter((field) => ROW_VALUE[field] != null);

const COLUMNABLE_SET = new Set<ScreenerField>(COLUMNABLE_FIELDS);

export function isColumnableField(field: ScreenerField): boolean {
  return COLUMNABLE_SET.has(field);
}

/** FIELD_GROUPS narrowed to columnable metrics for the Custom column picker. */
export function columnPickerGroups(): {
  group: string;
  fields: ScreenerField[];
}[] {
  return Object.entries(FIELD_GROUPS)
    .map(([group, defs]) => ({
      group,
      fields: defs.map((d) => d.field).filter((f) => COLUMNABLE_SET.has(f)),
    }))
    .filter((g) => g.fields.length > 0);
}

export function getRowMetric(
  row: StockRow,
  field: ScreenerField,
): number | null {
  const value = ROW_VALUE[field]?.(row) ?? null;
  if (value == null || !Number.isFinite(value)) return null;
  return value;
}

export function formatRowMetric(
  field: ScreenerField,
  value: number | null | undefined,
): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const def = FIELD_DEFS[field];
  switch (def.kind) {
    case "currency":
      return field === "market_cap" ? formatMarketCap(value) : formatSgd(value);
    case "percent": {
      const formatted = formatPercent(value);
      if (
        (field.startsWith("perf_") ||
          field.startsWith("pct_") ||
          field.startsWith("price_vs_")) &&
        value > 0
      ) {
        return `+${formatted}`;
      }
      return formatted;
    }
    default:
      return formatNumber(value, field === "avg_volume_30d" ? 0 : 2);
  }
}

export function columnLabel(field: ScreenerField): string {
  return FIELD_DEFS[field].label;
}
