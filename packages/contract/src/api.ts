import { z } from "zod";
import { FilterCondition, ScreenSpec, ScreenerField } from "./dsl";

/**
 * A single row in the results table. Nullable metrics cover stocks missing data.
 * Identity enums (sector/industry/board) stay on filters/facets, not on the row.
 */
export const StockRow = z.object({
  ticker: z.string(),
  name: z.string(),
  currency: z.string(), // e.g. 'SGD' — for formatting monetary columns

  marketCap: z.number().nullable(),
  pe: z.number().nullable(),
  pb: z.number().nullable(),
  ps: z.number().nullable(),
  peg: z.number().nullable(),

  profitMargin: z.number().nullable(),
  operatingMargin: z.number().nullable(),
  roe: z.number().nullable(),
  roa: z.number().nullable(),
  eps: z.number().nullable(),

  revenueGrowthYoy: z.number().nullable(),
  earningsGrowthYoy: z.number().nullable(),

  debtToEquity: z.number().nullable(),
  freeCashFlow: z.number().nullable(),
  fcfMargin: z.number().nullable(),

  dividendYield: z.number().nullable(),
  payoutRatio: z.number().nullable(),

  price: z.number().nullable(),
  pctFrom52wHigh: z.number().nullable(),
  pctFrom52wLow: z.number().nullable(),
  priceVs50ma: z.number().nullable(),
  priceVs200ma: z.number().nullable(),
  rsi14: z.number().nullable(),

  avgVolume30d: z.number().nullable(),
  perf1d: z.number().nullable(),
  perf1w: z.number().nullable(),
  perf1m: z.number().nullable(),
  perfYtd: z.number().nullable(),
  perf1y: z.number().nullable(),

  sparkline: z.array(z.number()), // ~30 recent closes for the row sparkline
});
export type StockRow = z.infer<typeof StockRow>;

/* ----------------------------------------------------------------
 * POST /api/screen/count   — live result count for current filters
 * ---------------------------------------------------------------- */
export const CountRequest = ScreenSpec;
export const CountResponse = z.object({
  count: z.number().int().nonnegative(),
});
export type CountRequest = z.infer<typeof CountRequest>;
export type CountResponse = z.infer<typeof CountResponse>;

/* ----------------------------------------------------------------
 * POST /api/screen/results — paginated, sortable result rows
 * ---------------------------------------------------------------- */
export const ResultsRequest = ScreenSpec;
export const ResultsResponse = z.object({
  rows: z.array(StockRow),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  /** Ingest as-of date (YYYY-MM-DD) from screener_metrics; null if no metrics yet. */
  asOf: z.string().nullable(),
});
export type ResultsRequest = z.infer<typeof ResultsRequest>;
export type ResultsResponse = z.infer<typeof ResultsResponse>;

/* ----------------------------------------------------------------
 * GET /api/stocks/:ticker  — detail drawer payload
 * ---------------------------------------------------------------- */
export const StockDetailResponse = z.object({
  company: z.object({
    ticker: z.string(),
    name: z.string(),
    exchange: z.string(),
    board: z.string().nullable(),
    sector: z.string().nullable(),
    industry: z.string().nullable(),
    currency: z.string(),
  }),
  fundamentals: z.record(z.string(), z.number().nullable()), // metric -> value
  priceHistory: z.array(
    z.object({ date: z.string(), close: z.number() }),
  ),
});
export type StockDetailResponse = z.infer<typeof StockDetailResponse>;

/* ----------------------------------------------------------------
 * GET /api/stocks/search?q=  — ticker search for @ mentions
 * ---------------------------------------------------------------- */
export const SearchResponse = z.object({
  results: z.array(z.object({ ticker: z.string(), name: z.string() })),
});
export type SearchResponse = z.infer<typeof SearchResponse>;

/* ----------------------------------------------------------------
 * POST /api/nl/parse  — free text (+ @ refs) -> validated ScreenSpec
 * ---------------------------------------------------------------- */
export const NlParseRequest = z.object({
  text: z.string().min(1),
  references: z.array(z.string()).optional(), // @-mentioned tickers
});
export const NlParseResponse = z.object({
  spec: ScreenSpec,
  warnings: z.array(z.string()).optional(),
});
export type NlParseRequest = z.infer<typeof NlParseRequest>;
export type NlParseResponse = z.infer<typeof NlParseResponse>;

/* ----------------------------------------------------------------
 * POST /api/nl/describe  — ScreenSpec → plain-English one-liner (+ optional name)
 * ---------------------------------------------------------------- */
export const NlDescribeRequest = z.object({
  spec: ScreenSpec,
});
export const NlDescribeResponse = z.object({
  /** One descriptive sentence; never a recommendation. */
  description: z.string().min(1).max(280),
  /** Optional short screen title suggestion. */
  name: z.string().min(1).max(80).optional(),
});
export type NlDescribeRequest = z.infer<typeof NlDescribeRequest>;
export type NlDescribeResponse = z.infer<typeof NlDescribeResponse>;

/* ----------------------------------------------------------------
 * POST /api/nl/refine  — free text + current ScreenSpec → proposed diff
 * ---------------------------------------------------------------- */
export const NlRefineChangeAdd = z.object({
  op: z.literal("add"),
  condition: FilterCondition,
});
export const NlRefineChangeModify = z.object({
  op: z.literal("modify"),
  /** Existing condition (must match a field already on the screen). */
  from: FilterCondition,
  /** Replacement condition (same field). */
  to: FilterCondition,
});
export const NlRefineChangeRemove = z.object({
  op: z.literal("remove"),
  condition: FilterCondition,
});
export const NlRefineChange = z.discriminatedUnion("op", [
  NlRefineChangeAdd,
  NlRefineChangeModify,
  NlRefineChangeRemove,
]);
export const NlRefineRequest = z.object({
  text: z.string().min(1),
  currentSpec: ScreenSpec,
  references: z.array(z.string()).optional(),
});
export const NlRefineResponse = z.object({
  changes: z.array(NlRefineChange),
  warnings: z.array(z.string()).optional(),
});
export type NlRefineChange = z.infer<typeof NlRefineChange>;
export type NlRefineRequest = z.infer<typeof NlRefineRequest>;
export type NlRefineResponse = z.infer<typeof NlRefineResponse>;

/* ----------------------------------------------------------------
 * GET /api/facets  — distinct sector / industry values for enum filters
 * ---------------------------------------------------------------- */
export const FacetsResponse = z.object({
  sectors: z.array(z.string()),
  industries: z.array(z.string()),
});
export type FacetsResponse = z.infer<typeof FacetsResponse>;

/* ----------------------------------------------------------------
 * GET /api/presets  — the 12 curated screens
 * ---------------------------------------------------------------- */
export const PresetSchema = z.object({
  id: z.string(),
  name: z.string(),
  spec: ScreenSpec,
  /** Optional default columns when opening this preset on the Custom tab. */
  columns: z.array(ScreenerField).optional(),
});
export const PresetsResponse = z.object({
  presets: z.array(PresetSchema),
});
export type PresetsResponse = z.infer<typeof PresetsResponse>;

/* ----------------------------------------------------------------
 * Saved screens — GET/POST/PUT/DELETE /api/screens (auth)
 * ---------------------------------------------------------------- */
/** User-defined results columns (ticker + name stay pinned in the UI). */
export const SavedScreenColumns = z.array(ScreenerField);

export const SavedScreen = z.object({
  id: z.number().int(),
  name: z.string().min(1),
  spec: ScreenSpec,
  /** Custom column set; omitted when empty / never customized. */
  columns: SavedScreenColumns.optional(),
  /** Plain-English summary (AI or user-edited); omitted when unset. */
  description: z.string().max(280).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export const SaveScreenRequest = z.object({
  name: z.string().min(1),
  spec: ScreenSpec,
  columns: SavedScreenColumns.optional(),
  description: z.string().max(280).optional(),
});
export const UpdateScreenRequest = z.object({
  name: z.string().min(1).optional(),
  spec: ScreenSpec.optional(),
  columns: SavedScreenColumns.optional(),
  description: z.string().max(280).optional(),
});
export const SavedScreensResponse = z.object({
  screens: z.array(SavedScreen),
});
export type SavedScreen = z.infer<typeof SavedScreen>;
export type SaveScreenRequest = z.infer<typeof SaveScreenRequest>;
export type UpdateScreenRequest = z.infer<typeof UpdateScreenRequest>;
export type SavedScreensResponse = z.infer<typeof SavedScreensResponse>;
