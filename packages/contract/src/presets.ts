import type { ScreenSpec } from "./dsl";

export interface Preset {
  id: string;
  name: string;
  spec: ScreenSpec;
}

/**
 * The 12 curated screens for SGX. Each is a Filter DSL `ScreenSpec` that the
 * Home grid loads straight into the builder (and is therefore fully editable).
 *
 * Units: margins, yields, growth, and performance are decimal fractions
 * (0.04 = 4%); market_cap and free_cash_flow are raw SGD.
 *
 * Thresholds are calibrated to SGX scale, which differs from the US:
 *  - "Large cap" floor is ~S$5B (only the three local banks approach S$50B+).
 *  - Dividend yields run higher than the US (banks ~5%, S-REITs ~5-7%), so
 *    yield thresholds are higher.
 *  - Momentum/growth thresholds are more modest than US tech.
 * Tune against real data once ingestion is live.
 */
export const PRESETS: Preset[] = [
  {
    id: "high-yield-blue-chips",
    name: "High-Yield Blue Chips",
    spec: {
      conditions: [
        { field: "dividend_yield", operator: "gte", value: 0.04 },
        { field: "market_cap", operator: "gte", value: 5_000_000_000 },
      ],
      sort: { field: "dividend_yield", direction: "desc" },
      page: 1,
      pageSize: 50,
    },
  },
  {
    id: "undervalued-large-caps",
    name: "Undervalued Large Caps",
    spec: {
      conditions: [
        { field: "market_cap", operator: "gte", value: 5_000_000_000 },
        { field: "pe", operator: "lte", value: 15 },
        { field: "pb", operator: "lte", value: 1.5 },
      ],
      sort: { field: "pe", direction: "asc" },
      page: 1,
      pageSize: 50,
    },
  },
  {
    id: "garp",
    name: "Growth at a Reasonable Price",
    spec: {
      conditions: [
        { field: "peg", operator: "lte", value: 2.0 },
        { field: "revenue_growth_yoy", operator: "gte", value: 0.05 },
        { field: "pe", operator: "lte", value: 20 },
      ],
      sort: { field: "peg", direction: "asc" },
      page: 1,
      pageSize: 50,
    },
  },
  {
    id: "recent-earnings-beats",
    name: "Recent Earnings Beats",
    // Quality-over-base-effect: require healthy YoY growth (25–300%) plus a
    // 15% profit-margin floor. The 300% cap drops recovery artifacts (e.g.
    // SEB +930%, ZQM-class spikes) that dominate a raw top-quartile screen.
    spec: {
      conditions: [
        { field: "earnings_growth_yoy", operator: "gte", value: 0.25 },
        { field: "earnings_growth_yoy", operator: "lte", value: 3.0 },
        { field: "profit_margin", operator: "gte", value: 0.15 },
      ],
      sort: { field: "earnings_growth_yoy", direction: "desc" },
      page: 1,
      pageSize: 50,
    },
  },
  {
    id: "near-52w-lows",
    name: "Near 52-Week Lows",
    spec: {
      conditions: [
        { field: "pct_from_52w_low", operator: "lte", value: 0.05 },
        { field: "market_cap", operator: "gte", value: 500_000_000 },
      ],
      sort: { field: "pct_from_52w_low", direction: "asc" },
      page: 1,
      pageSize: 50,
    },
  },
  {
    id: "high-free-cash-flow",
    name: "High Free Cash Flow",
    spec: {
      conditions: [
        { field: "fcf_margin", operator: "gte", value: 0.15 },
        { field: "free_cash_flow", operator: "gte", value: 200_000_000 },
      ],
      sort: { field: "fcf_margin", direction: "desc" },
      page: 1,
      pageSize: 50,
    },
  },
  {
    id: "profitable-small-caps",
    name: "Profitable Small Caps",
    // Expected to return 0 on the liquid-core universe — no active names sit in
    // the S$300M–2B band. Will populate once the universe is widened beyond
    // the liquid core.
    spec: {
      conditions: [
        { field: "market_cap", operator: "between", value: [300_000_000, 2_000_000_000] },
        { field: "profit_margin", operator: "gte", value: 0.1 },
        { field: "roe", operator: "gte", value: 0.1 },
      ],
      sort: { field: "roe", direction: "desc" },
      page: 1,
      pageSize: 50,
    },
  },
  {
    id: "momentum-leaders",
    name: "Momentum Leaders",
    spec: {
      conditions: [
        { field: "perf_1y", operator: "gte", value: 0.2 },
        { field: "price_vs_50ma", operator: "gte", value: 0 },
        { field: "price_vs_200ma", operator: "gte", value: 0 },
      ],
      sort: { field: "perf_1y", direction: "desc" },
      page: 1,
      pageSize: 50,
    },
  },
  {
    id: "oversold-quality",
    name: "Oversold Quality",
    spec: {
      conditions: [
        { field: "rsi_14", operator: "lte", value: 35 },
        { field: "roe", operator: "gte", value: 0.12 },
        { field: "debt_to_equity", operator: "lte", value: 1 },
      ],
      sort: { field: "rsi_14", direction: "asc" },
      page: 1,
      pageSize: 50,
    },
  },
  {
    id: "cash-rich-companies",
    name: "Cash-Rich Companies",
    spec: {
      conditions: [
        { field: "free_cash_flow", operator: "gte", value: 300_000_000 },
        { field: "debt_to_equity", operator: "lte", value: 0.3 },
      ],
      sort: { field: "free_cash_flow", direction: "desc" },
      page: 1,
      pageSize: 50,
    },
  },
  {
    id: "dividend-growers",
    name: "Dividend Growers",
    spec: {
      conditions: [
        { field: "dividend_yield", operator: "gte", value: 0.02 },
        { field: "earnings_growth_yoy", operator: "gte", value: 0.05 },
        { field: "payout_ratio", operator: "lte", value: 0.6 },
      ],
      sort: { field: "earnings_growth_yoy", direction: "desc" },
      page: 1,
      pageSize: 50,
    },
  },
  {
    id: "high-roe-low-debt",
    name: "High ROE, Low Debt",
    spec: {
      conditions: [
        { field: "roe", operator: "gte", value: 0.15 },
        { field: "debt_to_equity", operator: "lte", value: 0.5 },
      ],
      sort: { field: "roe", direction: "desc" },
      page: 1,
      pageSize: 50,
    },
  },
];
