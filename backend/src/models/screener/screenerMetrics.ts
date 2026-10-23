import {
  bigint,
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { companies } from "./companies";

export const screenerMetrics = pgTable(
  "screener_metrics",
  {
  companyId: integer("company_id")
    .primaryKey()
    .references(() => companies.id, { onDelete: "cascade" }),
  asOf: date("as_of").notNull(),

  marketCap: numeric("market_cap", { precision: 20, scale: 2 }),
  marketCapBucket: text("market_cap_bucket"),

  pe: numeric("pe", { precision: 12, scale: 4 }),
  pb: numeric("pb", { precision: 12, scale: 4 }),
  ps: numeric("ps", { precision: 12, scale: 4 }),
  peg: numeric("peg", { precision: 12, scale: 4 }),

  profitMargin: numeric("profit_margin", { precision: 8, scale: 4 }),
  operatingMargin: numeric("operating_margin", { precision: 8, scale: 4 }),
  roe: numeric("roe", { precision: 8, scale: 4 }),
  roa: numeric("roa", { precision: 8, scale: 4 }),
  eps: numeric("eps", { precision: 12, scale: 4 }),

  revenueGrowthYoy: numeric("revenue_growth_yoy", { precision: 8, scale: 4 }),
  earningsGrowthYoy: numeric("earnings_growth_yoy", { precision: 8, scale: 4 }),

  debtToEquity: numeric("debt_to_equity", { precision: 10, scale: 4 }),
  freeCashFlow: numeric("free_cash_flow", { precision: 20, scale: 2 }),
  fcfMargin: numeric("fcf_margin", { precision: 8, scale: 4 }),

  dividendYield: numeric("dividend_yield", { precision: 8, scale: 4 }),
  payoutRatio: numeric("payout_ratio", { precision: 8, scale: 4 }),

  price: numeric("price", { precision: 14, scale: 4 }),
  pctFrom52wHigh: numeric("pct_from_52w_high", { precision: 8, scale: 4 }),
  pctFrom52wLow: numeric("pct_from_52w_low", { precision: 8, scale: 4 }),
  priceVs50ma: numeric("price_vs_50ma", { precision: 8, scale: 4 }),
  priceVs200ma: numeric("price_vs_200ma", { precision: 8, scale: 4 }),
  rsi14: numeric("rsi_14", { precision: 6, scale: 2 }),

  avgVolume30d: bigint("avg_volume_30d", { mode: "number" }),
  perf1d: numeric("perf_1d", { precision: 8, scale: 4 }),
  perf1w: numeric("perf_1w", { precision: 8, scale: 4 }),
  perf1m: numeric("perf_1m", { precision: 8, scale: 4 }),
  perfYtd: numeric("perf_ytd", { precision: 8, scale: 4 }),
  perf1y: numeric("perf_1y", { precision: 8, scale: 4 }),

  sparkline30d: numeric("sparkline_30d", { precision: 14, scale: 4 }).array(),

  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  },
  (table) => ({
    marketCapIdx: index("idx_metrics_market_cap").on(table.marketCap),
    peIdx: index("idx_metrics_pe").on(table.pe),
    dividendYieldIdx: index("idx_metrics_dividend_yield").on(table.dividendYield),
    roeIdx: index("idx_metrics_roe").on(table.roe),
    perf1yIdx: index("idx_metrics_perf_1y").on(table.perf1y),
  }),
);
