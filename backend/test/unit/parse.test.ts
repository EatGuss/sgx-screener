import assert from "node:assert/strict";
import { afterEach, describe, it } from "vitest";
import {
  buildNlParseStubResponse,
  resolveMissingOpenRouterKey,
} from "../../src/services/nl/nlParseStub";
import { NlConfigError } from "../../src/services/nl/openrouter";
import {
  parseAndValidateLlmJson,
  stripMarkdownFences,
} from "../../src/services/nl/validateLlm";

describe("stripMarkdownFences", () => {
  it("strips ```json fences", () => {
    const raw = '```json\n{"conditions":[]}\n```';
    assert.equal(stripMarkdownFences(raw), '{"conditions":[]}');
  });

  it("leaves bare JSON alone", () => {
    assert.equal(stripMarkdownFences('{"conditions":[]}'), '{"conditions":[]}');
  });
});

describe("parseAndValidateLlmJson", () => {
  it("accepts a ScreenSpec-shaped object with warnings", () => {
    const raw = JSON.stringify({
      conditions: [{ field: "pe", operator: "lt", value: 15 }],
      sort: { field: "market_cap", direction: "desc" },
      warnings: ["couldn't interpret 'cheap' — ignored"],
    });
    const res = parseAndValidateLlmJson(raw);
    assert.equal(res.spec.conditions.length, 1);
    assert.equal(res.spec.conditions[0]?.field, "pe");
    assert.deepEqual(res.warnings, ["couldn't interpret 'cheap' — ignored"]);
  });

  it("accepts fenced JSON and nested { spec }", () => {
    const raw = `\`\`\`json
${JSON.stringify({
  spec: {
    conditions: [
      { field: "dividend_yield", operator: "gt", value: 0.046 },
    ],
  },
})}
\`\`\``;
    const res = parseAndValidateLlmJson(raw);
    assert.equal(res.spec.conditions[0]?.field, "dividend_yield");
  });

  it("rejects invalid field names", () => {
    assert.throws(
      () =>
        parseAndValidateLlmJson(
          JSON.stringify({
            conditions: [{ field: "not_a_field", operator: "lt", value: 1 }],
          }),
        ),
      /NlParseError|invalid|Invalid/i,
    );
  });
});

describe("NL parse stub", () => {
  const prevKey = process.env.OPENROUTER_API_KEY;
  const prevStub = process.env.NL_PARSE_STUB;

  afterEach(() => {
    if (prevKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = prevKey;
    if (prevStub === undefined) delete process.env.NL_PARSE_STUB;
    else process.env.NL_PARSE_STUB = prevStub;
  });

  it("buildNlParseStubResponse returns dividend_yield + Real Estate with a stub warning", () => {
    const res = buildNlParseStubResponse();
    assert.equal(res.spec.conditions.length, 2);
    assert.equal(res.spec.conditions[0]?.field, "dividend_yield");
    assert.equal(res.spec.conditions[0]?.operator, "gte");
    assert.equal(res.spec.conditions[0]?.value, 0.054);
    assert.equal(res.spec.conditions[1]?.field, "sector");
    assert.equal(res.spec.conditions[1]?.value, "Real Estate");
    assert.ok(res.warnings?.some((w) => /stub/i.test(w)));
  });

  it("resolveMissingOpenRouterKey returns canned response when NL_PARSE_STUB=true", () => {
    delete process.env.OPENROUTER_API_KEY;
    process.env.NL_PARSE_STUB = "true";
    const res = resolveMissingOpenRouterKey();
    assert.equal(res.spec.conditions[0]?.field, "dividend_yield");
    assert.ok(res.warnings?.some((w) => /stub/i.test(w)));
  });

  it("resolveMissingOpenRouterKey throws when stub is not enabled", () => {
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.NL_PARSE_STUB;
    assert.throws(() => resolveMissingOpenRouterKey(), NlConfigError);
  });
});
