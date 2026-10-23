import { PRESETS, type ScreenSpec, type ScreenerField, type StockRow } from "screener-contract";
import type { ScreenerApi } from "./api";

const NULL_METRICS = {
  marketCap: null,
  pe: null,
  pb: null,
  ps: null,
  peg: null,
  profitMargin: null,
  operatingMargin: null,
  roe: null,
  roa: null,
  eps: null,
  revenueGrowthYoy: null,
  earningsGrowthYoy: null,
  debtToEquity: null,
  freeCashFlow: null,
  fcfMargin: null,
  dividendYield: null,
  payoutRatio: null,
  price: null,
  pctFrom52wHigh: null,
  pctFrom52wLow: null,
  priceVs50ma: null,
  priceVs200ma: null,
  rsi14: null,
  avgVolume30d: null,
  perf1d: null,
  perf1w: null,
  perf1m: null,
  perfYtd: null,
  perf1y: null,
  sparkline: [] as number[],
} satisfies Omit<StockRow, "ticker" | "name" | "currency">;

const MOCK_ROWS: StockRow[] = [
  {
    ticker: "D05.SI",
    name: "DBS Group Holdings Ltd",
    currency: "SGD",
    ...NULL_METRICS,
    marketCap: 95_000_000_000,
  },
  {
    ticker: "O39.SI",
    name: "Oversea-Chinese Banking Corp Ltd",
    currency: "SGD",
    ...NULL_METRICS,
    marketCap: 62_000_000_000,
  },
];

function matchesMarketCap(spec: ScreenSpec, cap: number | null): boolean {
  const cond = spec.conditions.find((c) => c.field === "market_cap");
  if (!cond || cap == null) return cond == null;
  if (typeof cond.value !== "number") return true;

  switch (cond.operator) {
    case "gte":
      return cap >= cond.value;
    case "gt":
      return cap > cond.value;
    case "lte":
      return cap <= cond.value;
    case "lt":
      return cap < cond.value;
    case "eq":
      return cap === cond.value;
    default:
      return true;
  }
}

const MOCK_DETAILS: Record<string, { sector: string | null; industry: string | null }> = {
  "D05.SI": { sector: "Financial Services", industry: "Banks" },
  "O39.SI": { sector: "Financial Services", industry: "Banks" },
};

/** In-memory API for MSW or offline dev — same interface as live client. */
export function createMockScreenerApi(): ScreenerApi {
  return {
    async count(spec) {
      const rows = MOCK_ROWS.filter((r) => matchesMarketCap(spec, r.marketCap));
      return { count: rows.length };
    },

    async results(spec) {
      const rows = MOCK_ROWS.filter((r) => matchesMarketCap(spec, r.marketCap));
      return {
        rows,
        total: rows.length,
        page: spec.page ?? 1,
        asOf: "2026-07-11",
      };
    },

    async getFacets() {
      const sectors = new Set<string>();
      const industries = new Set<string>();
      for (const meta of Object.values(MOCK_DETAILS)) {
        if (meta.sector) sectors.add(meta.sector);
        if (meta.industry) industries.add(meta.industry);
      }
      return {
        sectors: [...sectors].sort((a, b) => a.localeCompare(b)),
        industries: [...industries].sort((a, b) => a.localeCompare(b)),
      };
    },

    async getPresets() {
      return { presets: PRESETS };
    },

    async getStockDetail(ticker) {
      const row = MOCK_ROWS.find((r) => r.ticker === ticker);
      const meta = MOCK_DETAILS[ticker];
      return {
        company: {
          ticker,
          name: row?.name ?? ticker,
          exchange: "SGX",
          board: "Mainboard",
          sector: meta?.sector ?? null,
          industry: meta?.industry ?? null,
          currency: "SGD",
        },
        fundamentals: {},
        priceHistory: [],
      };
    },

    async searchStocks(q) {
      const needle = q.trim().toLowerCase();
      if (!needle) {
        const results = [...MOCK_ROWS]
          .sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0))
          .slice(0, 8)
          .map((r) => ({ ticker: r.ticker, name: r.name }));
        return { results };
      }
      const results = MOCK_ROWS.filter(
        (r) =>
          r.ticker.toLowerCase().includes(needle) ||
          r.name.toLowerCase().includes(needle),
      )
        .map((r) => ({ ticker: r.ticker, name: r.name }))
        .slice(0, 8);
      return { results };
    },

    async parseNl(body) {
      const text = body.text.toLowerCase();
      const conditions = [];
      if (/dividend|yield/.test(text)) {
        conditions.push({
          field: "dividend_yield" as const,
          operator: "gt" as const,
          value: 0.04,
        });
      }
      if (/pe|valuation|cheap/.test(text)) {
        conditions.push({
          field: "pe" as const,
          operator: "lt" as const,
          value: 15,
        });
      }
      const warnings =
        /cheap/.test(text) && !/pe|valuation/.test(text)
          ? ["couldn't interpret 'cheap' — ignored"]
          : undefined;
      return {
        spec: {
          conditions,
          sort: { field: "market_cap" as const, direction: "desc" as const },
          page: 1,
          pageSize: 50,
        },
        warnings,
      };
    },

    async describeNl(body) {
      const n = body.spec.conditions.length;
      return {
        description:
          n === 0
            ? "All listed companies with no additional filters applied"
            : `Screen with ${n} filter${n === 1 ? "" : "s"} on SGX equities`,
        name: n > 0 ? "Custom screen" : "All stocks",
      };
    },

    async refineNl(body) {
      const text = body.text.toLowerCase();
      const current = body.currentSpec.conditions;
      const changes = [];
      const pe = current.find((c) => c.field === "pe");
      if (pe && /pe|cheaper|tighter|lower/.test(text)) {
        const nextVal =
          typeof pe.value === "number" ? Math.max(1, pe.value - 5) : 15;
        changes.push({
          op: "modify" as const,
          from: pe,
          to: { ...pe, value: nextVal },
        });
      } else if (!pe && /pe|valuation/.test(text)) {
        changes.push({
          op: "add" as const,
          condition: {
            field: "pe" as const,
            operator: "lte" as const,
            value: 15,
          },
        });
      }
      if (/roe/.test(text) && !current.some((c) => c.field === "roe")) {
        changes.push({
          op: "add" as const,
          condition: {
            field: "roe" as const,
            operator: "gte" as const,
            value: 0.12,
          },
        });
      }
      const mcap = current.find((c) => c.field === "market_cap");
      if (mcap && /remove.*cap|drop.*cap|no market cap/.test(text)) {
        changes.push({ op: "remove" as const, condition: mcap });
      }
      return {
        changes,
        warnings:
          changes.length === 0
            ? ["couldn't map that refinement — try being more specific"]
            : undefined,
      };
    },

    async listScreens() {
      return { screens: [...mockSavedScreens] };
    },

    async saveScreen(body) {
      const screen = {
        id: nextMockScreenId++,
        name: body.name,
        spec: body.spec,
        ...(body.columns?.length ? { columns: body.columns } : {}),
        ...(body.description?.trim()
          ? { description: body.description.trim() }
          : {}),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      mockSavedScreens = [screen, ...mockSavedScreens];
      return screen;
    },

    async updateScreen(id, body) {
      const idx = mockSavedScreens.findIndex((s) => s.id === id);
      if (idx < 0) throw new Error(`Screen not found: ${id}`);
      const prev = mockSavedScreens[idx]!;
      const next = {
        ...prev,
        name: body.name ?? prev.name,
        spec: body.spec ?? prev.spec,
        updatedAt: new Date().toISOString(),
      };
      if (body.columns !== undefined) {
        if (body.columns.length > 0) {
          next.columns = body.columns;
        } else {
          delete next.columns;
        }
      }
      if (body.description !== undefined) {
        if (body.description.trim()) {
          next.description = body.description.trim();
        } else {
          delete next.description;
        }
      }
      mockSavedScreens = [
        ...mockSavedScreens.slice(0, idx),
        next,
        ...mockSavedScreens.slice(idx + 1),
      ];
      return next;
    },

    async deleteScreen(id) {
      mockSavedScreens = mockSavedScreens.filter((s) => s.id !== id);
    },
  };
}

let nextMockScreenId = 1;
let mockSavedScreens: Array<{
  id: number;
  name: string;
  spec: ScreenSpec;
  columns?: ScreenerField[];
  description?: string;
  createdAt: string;
  updatedAt: string;
}> = [];
