import assert from "node:assert/strict";
import { afterEach, describe, it } from "vitest";
import type { ScreenSpec } from "screener-contract";
import {
  buildNlDescribeStubResponse,
  formatConditionsForDescribe,
  parseAndValidateDescribeJson,
  resolveMissingOpenRouterKeyForDescribe,
} from "../../src/services/nl/describe";
import { NlConfigError } from "../../src/services/nl/openrouter";

const sampleSpec: ScreenSpec = {
  conditions: [
    { field: "pe", operator: "lt", value: 15 },
    { field: "dividend_yield", operator: "gte", value: 0.04 },
    { field: "market_cap", operator: "gte", value: 1_000_000_000 },
  ],
  page: 1,
  pageSize: 50,
};

describe("formatConditionsForDescribe", () => {
  it("includes FIELD_DEFS labels and units", () => {
    const text = formatConditionsForDescribe(sampleSpec);
    assert.match(text, /P\/E/);
    assert.match(text, /Dividend Yield/);
    assert.match(text, /unit=SGD/);
    assert.match(text, /lt 15/);
  });

  it("notes empty condition sets", () => {
    assert.match(
      formatConditionsForDescribe({ conditions: [], page: 1, pageSize: 50 }),
      /no filter/i,
    );
  });
});

describe("parseAndValidateDescribeJson", () => {
  it("accepts a valid description + name", () => {
    const res = parseAndValidateDescribeJson(
      JSON.stringify({
        description:
          "Large-cap companies trading below 15× earnings with above-average dividend yield",
        name: "High-yield value",
      }),
    );
    assert.match(res.description, /Large-cap/);
    assert.equal(res.name, "High-yield value");
  });

  it("strips markdown fences", () => {
    const res = parseAndValidateDescribeJson(
      '```json\n{"description":"Companies with P/E below 15"}\n```',
    );
    assert.match(res.description, /P\/E/);
  });

  it("rejects recommendations", () => {
    assert.throws(
      () =>
        parseAndValidateDescribeJson(
          JSON.stringify({
            description: "A good buy among high-yield REITs",
          }),
        ),
      /recommend|NlDescribeError/i,
    );
  });

  it("rejects empty description", () => {
    assert.throws(
      () => parseAndValidateDescribeJson(JSON.stringify({ description: "" })),
      /NlDescribeError|too small|String/i,
    );
  });
});

describe("NL describe stub", () => {
  const prevKey = process.env.OPENROUTER_API_KEY;
  const prevStub = process.env.NL_PARSE_STUB;

  afterEach(() => {
    if (prevKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = prevKey;
    if (prevStub === undefined) delete process.env.NL_PARSE_STUB;
    else process.env.NL_PARSE_STUB = prevStub;
  });

  it("buildNlDescribeStubResponse returns a non-empty description", () => {
    const res = buildNlDescribeStubResponse(sampleSpec);
    assert.ok(res.description.length > 0);
    assert.ok(res.name);
  });

  it("resolveMissingOpenRouterKeyForDescribe returns stub when NL_PARSE_STUB=true", () => {
    delete process.env.OPENROUTER_API_KEY;
    process.env.NL_PARSE_STUB = "true";
    const res = resolveMissingOpenRouterKeyForDescribe(sampleSpec);
    assert.ok(res.description.length > 0);
  });

  it("resolveMissingOpenRouterKeyForDescribe throws when stub is not enabled", () => {
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.NL_PARSE_STUB;
    assert.throws(
      () => resolveMissingOpenRouterKeyForDescribe(sampleSpec),
      NlConfigError,
    );
  });
});
