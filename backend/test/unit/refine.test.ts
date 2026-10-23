import assert from "node:assert/strict";
import { afterEach, describe, it } from "vitest";
import type { ScreenSpec } from "screener-contract";
import {
  buildNlRefineStubResponse,
  parseAndValidateRefineJson,
  resolveMissingOpenRouterKeyForRefine,
  validateChangesAgainstSpec,
} from "../../src/services/nl/refine";
import { NlConfigError } from "../../src/services/nl/openrouter";

const currentSpec: ScreenSpec = {
  conditions: [
    { field: "pe", operator: "lte", value: 20 },
    { field: "market_cap", operator: "gte", value: 5_000_000_000 },
  ],
  page: 1,
  pageSize: 50,
};

describe("validateChangesAgainstSpec", () => {
  it("accepts add/modify/remove that apply to the current screen", () => {
    const { changes, warnings } = validateChangesAgainstSpec(currentSpec, [
      {
        op: "modify",
        from: { field: "pe", operator: "lte", value: 20 },
        to: { field: "pe", operator: "lte", value: 15 },
      },
      {
        op: "add",
        condition: { field: "roe", operator: "gte", value: 0.12 },
      },
      {
        op: "remove",
        condition: { field: "market_cap", operator: "gte", value: 5_000_000_000 },
      },
    ]);
    assert.equal(changes.length, 3);
    assert.equal(warnings.length, 0);
    assert.equal(changes[0]?.op, "modify");
    assert.equal(changes[1]?.op, "add");
    assert.equal(changes[2]?.op, "remove");
  });

  it("rejects modify/remove for fields not on the screen", () => {
    const { changes, warnings } = validateChangesAgainstSpec(currentSpec, [
      {
        op: "modify",
        from: { field: "roe", operator: "gte", value: 0.1 },
        to: { field: "roe", operator: "gte", value: 0.12 },
      },
      {
        op: "remove",
        condition: { field: "pb", operator: "lte", value: 2 },
      },
      {
        op: "add",
        condition: { field: "pe", operator: "lte", value: 10 },
      },
    ]);
    assert.equal(changes.length, 0);
    assert.ok(warnings.some((w) => /roe/i.test(w)));
    assert.ok(warnings.some((w) => /pb/i.test(w)));
    assert.ok(warnings.some((w) => /pe/i.test(w) && /add/i.test(w)));
  });
});

describe("parseAndValidateRefineJson", () => {
  it("accepts fenced JSON and rewrites modify.from from the live spec", () => {
    const raw = `\`\`\`json
${JSON.stringify({
  changes: [
    {
      op: "modify",
      from: { field: "pe", operator: "lt", value: 99 },
      to: { field: "pe", operator: "lte", value: 15 },
    },
  ],
})}
\`\`\``;
    const res = parseAndValidateRefineJson(raw, currentSpec);
    assert.equal(res.changes.length, 1);
    assert.equal(res.changes[0]?.op, "modify");
    if (res.changes[0]?.op === "modify") {
      assert.equal(res.changes[0].from.value, 20);
      assert.equal(res.changes[0].to.value, 15);
    }
  });
});

describe("NL refine stub", () => {
  const prevKey = process.env.OPENROUTER_API_KEY;
  const prevStub = process.env.NL_PARSE_STUB;

  afterEach(() => {
    if (prevKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = prevKey;
    if (prevStub === undefined) delete process.env.NL_PARSE_STUB;
    else process.env.NL_PARSE_STUB = prevStub;
  });

  it("buildNlRefineStubResponse returns at least one change", () => {
    const res = buildNlRefineStubResponse(currentSpec);
    assert.ok(res.changes.length >= 1);
    assert.ok(res.warnings?.some((w) => /stub/i.test(w)));
  });

  it("resolveMissingOpenRouterKeyForRefine returns stub when enabled", () => {
    delete process.env.OPENROUTER_API_KEY;
    process.env.NL_PARSE_STUB = "true";
    const res = resolveMissingOpenRouterKeyForRefine(currentSpec);
    assert.ok(res.changes.length >= 1);
  });

  it("resolveMissingOpenRouterKeyForRefine throws when stub is off", () => {
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.NL_PARSE_STUB;
    assert.throws(
      () => resolveMissingOpenRouterKeyForRefine(currentSpec),
      NlConfigError,
    );
  });
});
