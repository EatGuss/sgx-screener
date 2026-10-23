import assert from "node:assert/strict";
import { test } from "vitest";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import type { FilterCondition, ScreenSpec, ScreenerField } from "screener-contract";
import { ScreenerField as ScreenerFieldSchema } from "screener-contract";
import { companies } from "../../src/models/screener/companies";
import { screenerMetrics } from "../../src/models/screener/screenerMetrics";
import {
  compileCondition,
  compileOrderBy,
  compilePagination,
  compileWhere,
  FIELD_COLUMN,
} from "../../src/services/screen/compile";

const ALL_FIELDS = ScreenerFieldSchema.options;

function spec(conditions: FilterCondition[], sort?: ScreenSpec["sort"]): ScreenSpec {
  return { conditions, sort, page: 1, pageSize: 50 };
}

/** Render compiled WHERE as parameterized SQL for assertion (no DB). */
function renderWhereSql(conditions: FilterCondition[]): {
  sql: string;
  params: unknown[];
} {
  const db = drizzle({} as never, {
    schema: { companies, screenerMetrics },
  });
  const compiled = compileWhere(spec(conditions));
  const where = compiled
    ? and(eq(companies.isActive, true), compiled)
    : eq(companies.isActive, true);
  const query = db
    .select({ id: companies.id })
    .from(companies)
    .innerJoin(screenerMetrics, eq(companies.id, screenerMetrics.companyId))
    .where(where);
  const result = query.toSQL();
  assert.ok(typeof result.sql === "string", "expected parameterized SQL string");
  return result;
}

function peCond(
  operator: FilterCondition["operator"],
  value: FilterCondition["value"],
): FilterCondition {
  return { field: "pe", operator, value };
}

test("FIELD_COLUMN maps every ScreenerField to a Drizzle column", () => {
  for (const field of ALL_FIELDS) {
    assert.ok(FIELD_COLUMN[field], `missing column mapping for ${field}`);
  }
  assert.equal(Object.keys(FIELD_COLUMN).length, ALL_FIELDS.length);
});

test("compileWhere — empty conditions returns undefined", () => {
  assert.equal(compileWhere(spec([])), undefined);
});

test("compileWhere — ANDs multiple conditions", () => {
  const sql = renderWhereSql([
    peCond("lt", 15),
    { field: "market_cap", operator: "gte", value: 1_000_000_000 },
  ]);
  assert.match(sql.sql, /pe.*market_cap|market_cap.*pe/s);
  assert.ok(sql.params.length >= 2);
});

test("numeric operators on pe — gt, gte, lt, lte, eq, between", () => {
  const cases: Array<[FilterCondition["operator"], FilterCondition["value"]]> = [
    ["gt", 10],
    ["gte", 10],
    ["lt", 20],
    ["lte", 20],
    ["eq", 15],
    ["between", [10, 20]],
  ];

  for (const [operator, value] of cases) {
    const result = renderWhereSql([peCond(operator, value)]);
    assert.match(result.sql, /pe/i);
    assert.ok(result.params.length >= 1, `expected params for ${operator}`);
    assert.doesNotThrow(() => compileCondition(peCond(operator, value)));
  }
});

test("enum operator eq on sector", () => {
  const result = renderWhereSql([
    { field: "sector", operator: "eq", value: "Financial Services" },
  ]);
  assert.match(result.sql, /sector/i);
  assert.ok(result.params.includes("Financial Services"));
});

test("enum operator in on sector", () => {
  const result = renderWhereSql([
    {
      field: "sector",
      operator: "in",
      value: ["Financial Services", "Real Estate"],
    },
  ]);
  assert.match(result.sql, /sector/i);
  assert.ok(
    result.params.some((p) => Array.isArray(p) || p === "Financial Services"),
  );
});

test("compileWhere — every field accepts a valid condition without throwing", () => {
  const enumFields = new Set<ScreenerField>([
    "exchange",
    "board",
    "sector",
    "industry",
    "country",
  ]);

  for (const field of ALL_FIELDS) {
    const cond: FilterCondition = enumFields.has(field)
      ? { field, operator: "eq", value: "SGX" }
      : field === "market_cap"
        ? { field, operator: "gte", value: 1_000_000_000 }
        : { field, operator: "gte", value: 0 };
    assert.doesNotThrow(() => compileCondition(cond), field);
    assert.doesNotThrow(() => compileWhere(spec([cond])), field);
  }
});

test("compileOrderBy — asc/desc for representative and enum fields", () => {
  const peAsc = compileOrderBy(
    spec([], { field: "pe", direction: "asc" }),
  );
  const sectorDesc = compileOrderBy(
    spec([], { field: "sector", direction: "desc" }),
  );
  assert.ok(peAsc);
  assert.ok(sectorDesc);
});

test("compileOrderBy — every field is sortable", () => {
  for (const field of ALL_FIELDS) {
    assert.doesNotThrow(() =>
      compileOrderBy(spec([], { field, direction: "asc" })),
    );
  }
});

test("compileOrderBy — undefined when sort omitted", () => {
  assert.equal(compileOrderBy(spec([])), undefined);
});

test("compilePagination — page 1 defaults", () => {
  assert.deepEqual(compilePagination(spec([])), {
    page: 1,
    pageSize: 50,
    limit: 50,
    offset: 0,
  });
});

test("compilePagination — page 3 pageSize 25", () => {
  assert.deepEqual(
    compilePagination({ conditions: [], page: 3, pageSize: 25 }),
    { page: 3, pageSize: 25, limit: 25, offset: 50 },
  );
});

test("invalid between ordering throws", () => {
  assert.throws(
    () => compileCondition(peCond("between", [20, 10])),
    /Invalid between range for pe: min \(20\) > max \(10\)/,
  );
});

test("numeric field rejects in operator", () => {
  assert.throws(
    () =>
      compileCondition({
        field: "pe",
        operator: "in",
        value: ["10", "15"],
      }),
    /not supported for numeric field pe/,
  );
});

test("enum field rejects gt operator", () => {
  assert.throws(
    () =>
      compileCondition({
        field: "sector",
        operator: "gt",
        value: "Financial Services",
      }),
    /not supported for enum field sector/,
  );
});

test("enum in operator rejects empty array", () => {
  assert.throws(
    () =>
      compileCondition({
        field: "sector",
        operator: "in",
        value: [],
      }),
    /non-empty array/,
  );
});

test("avg_volume_30d between compiles as bigint binding", () => {
  assert.doesNotThrow(() =>
    compileCondition({
      field: "avg_volume_30d",
      operator: "between",
      value: [100_000, 1_000_000],
    }),
  );
});
