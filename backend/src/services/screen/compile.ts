import {
  and,
  asc,
  between,
  desc,
  eq,
  gt,
  gte,
  inArray,
  lt,
  lte,
  SQL,
} from "drizzle-orm";
import type { AnyColumn } from "drizzle-orm/column";
import type { FilterCondition, ScreenSpec, ScreenerField } from "screener-contract";
import { companies } from "../../models/screener/companies";
import { screenerMetrics } from "../../models/screener/screenerMetrics";

const NUMERIC_OPERATORS = new Set([
  "gt",
  "gte",
  "lt",
  "lte",
  "eq",
  "between",
]);

const ENUM_OPERATORS = new Set(["eq", "in"]);

/** Fields stored on `companies` and filtered with string/`in` operators. */
const ENUM_FIELDS = new Set<ScreenerField>([
  "exchange",
  "board",
  "sector",
  "industry",
  "country",
]);

/** Maps every contract field to its Drizzle column (companies or screener_metrics). */
export const FIELD_COLUMN: Record<ScreenerField, AnyColumn> = {
  exchange: companies.exchange,
  board: companies.board,
  sector: companies.sector,
  industry: companies.industry,
  country: companies.country,
  market_cap: screenerMetrics.marketCap,

  pe: screenerMetrics.pe,
  pb: screenerMetrics.pb,
  ps: screenerMetrics.ps,
  peg: screenerMetrics.peg,

  profit_margin: screenerMetrics.profitMargin,
  operating_margin: screenerMetrics.operatingMargin,
  roe: screenerMetrics.roe,
  roa: screenerMetrics.roa,
  eps: screenerMetrics.eps,

  revenue_growth_yoy: screenerMetrics.revenueGrowthYoy,
  earnings_growth_yoy: screenerMetrics.earningsGrowthYoy,

  debt_to_equity: screenerMetrics.debtToEquity,
  free_cash_flow: screenerMetrics.freeCashFlow,
  fcf_margin: screenerMetrics.fcfMargin,

  dividend_yield: screenerMetrics.dividendYield,
  payout_ratio: screenerMetrics.payoutRatio,

  price: screenerMetrics.price,
  pct_from_52w_high: screenerMetrics.pctFrom52wHigh,
  pct_from_52w_low: screenerMetrics.pctFrom52wLow,
  price_vs_50ma: screenerMetrics.priceVs50ma,
  price_vs_200ma: screenerMetrics.priceVs200ma,
  rsi_14: screenerMetrics.rsi14,

  avg_volume_30d: screenerMetrics.avgVolume30d,
  perf_1d: screenerMetrics.perf1d,
  perf_1w: screenerMetrics.perf1w,
  perf_1m: screenerMetrics.perf1m,
  perf_ytd: screenerMetrics.perfYtd,
  perf_1y: screenerMetrics.perf1y,
};

export interface CompiledPagination {
  page: number;
  pageSize: number;
  limit: number;
  offset: number;
}

function assertNumericOperator(field: ScreenerField, operator: string): void {
  if (!NUMERIC_OPERATORS.has(operator)) {
    throw new Error(
      `Operator "${operator}" is not supported for numeric field ${field}`,
    );
  }
}

function assertEnumOperator(field: ScreenerField, operator: string): void {
  if (!ENUM_OPERATORS.has(operator)) {
    throw new Error(
      `Operator "${operator}" is not supported for enum field ${field}`,
    );
  }
}

/** Bigint metrics column — bind as JS number, not numeric string. */
const BIGINT_FIELDS = new Set<ScreenerField>(["avg_volume_30d"]);

function bindNumeric(field: ScreenerField, value: number): string | number {
  return BIGINT_FIELDS.has(field) ? value : String(value);
}

function compileNumericCondition(
  field: ScreenerField,
  col: AnyColumn,
  cond: FilterCondition,
): SQL {
  assertNumericOperator(field, cond.operator);

  switch (cond.operator) {
    case "gt":
      return gt(col, bindNumeric(field, cond.value as number));
    case "gte":
      return gte(col, bindNumeric(field, cond.value as number));
    case "lt":
      return lt(col, bindNumeric(field, cond.value as number));
    case "lte":
      return lte(col, bindNumeric(field, cond.value as number));
    case "eq":
      return eq(col, bindNumeric(field, cond.value as number));
    case "between": {
      const [min, max] = cond.value as [number, number];
      if (min > max) {
        throw new Error(
          `Invalid between range for ${field}: min (${min}) > max (${max})`,
        );
      }
      return between(
        col,
        bindNumeric(field, min),
        bindNumeric(field, max),
      );
    }
    default:
      throw new Error(`Unsupported operator for ${field}: ${cond.operator}`);
  }
}

function compileEnumCondition(
  field: ScreenerField,
  col: AnyColumn,
  cond: FilterCondition,
): SQL {
  assertEnumOperator(field, cond.operator);

  switch (cond.operator) {
    case "eq":
      if (typeof cond.value !== "string") {
        throw new Error(`Operator "eq" on ${field} requires a string value`);
      }
      return eq(col, cond.value);
    case "in": {
      const values = cond.value as string[];
      if (values.length === 0) {
        throw new Error(`Operator "in" on ${field} requires a non-empty array`);
      }
      return inArray(col, values);
    }
    default:
      throw new Error(`Unsupported operator for ${field}: ${cond.operator}`);
  }
}

export function compileCondition(cond: FilterCondition): SQL {
  const col = FIELD_COLUMN[cond.field];
  if (ENUM_FIELDS.has(cond.field)) {
    return compileEnumCondition(cond.field, col, cond);
  }
  return compileNumericCondition(cond.field, col, cond);
}

export function compileWhere(spec: ScreenSpec): SQL | undefined {
  if (spec.conditions.length === 0) return undefined;
  const parts = spec.conditions.map(compileCondition);
  return parts.length === 1 ? parts[0] : and(...parts);
}

export function compileOrderBy(
  spec: ScreenSpec,
): ReturnType<typeof asc> | ReturnType<typeof desc> | undefined {
  if (!spec.sort) return undefined;

  const { field, direction } = spec.sort;
  const col = FIELD_COLUMN[field];
  return direction === "asc" ? asc(col) : desc(col);
}

/** Parameterized limit/offset derived from the validated ScreenSpec pagination. */
export function compilePagination(spec: ScreenSpec): CompiledPagination {
  const page = spec.page ?? 1;
  const pageSize = spec.pageSize ?? 50;
  return {
    page,
    pageSize,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  };
}
