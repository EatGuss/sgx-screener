import assert from "node:assert/strict";
import { describe, it } from "vitest";
import type { ScreenSpec } from "screener-contract";
import { buildSystemPrompt } from "../../src/services/nl/prompt";
import { parseAndValidateRefineJson } from "../../src/services/nl/refine";
import {
  canonicalizeScreenSpec,
  formatTaxonomyForPrompt,
  resolveTaxonomyValue,
  type NlTaxonomy,
} from "../../src/services/nl/taxonomy";

const TAXONOMY: NlTaxonomy = {
  sectors: [
    "Basic Materials",
    "Communication Services",
    "Consumer Cyclical",
    "Consumer Defensive",
    "Energy",
    "Financial Services",
    "Healthcare",
    "Industrials",
    "Real Estate",
    "Technology",
    "Utilities",
  ],
  industries: [
    "Banks - Diversified",
    "REIT - Industrial",
    "Semiconductors",
  ],
};

describe("resolveTaxonomyValue", () => {
  it("maps Financials / banks / tech / property onto Yahoo sectors", () => {
    assert.deepEqual(
      resolveTaxonomyValue("Financials", TAXONOMY.sectors, "sector"),
      { ok: true, value: "Financial Services", mappedFrom: "Financials" },
    );
    assert.deepEqual(
      resolveTaxonomyValue("banks", TAXONOMY.sectors, "sector"),
      { ok: true, value: "Financial Services", mappedFrom: "banks" },
    );
    assert.deepEqual(
      resolveTaxonomyValue("tech stocks", TAXONOMY.sectors, "sector"),
      { ok: true, value: "Technology", mappedFrom: "tech stocks" },
    );
    assert.deepEqual(
      resolveTaxonomyValue("property companies", TAXONOMY.sectors, "sector"),
      { ok: true, value: "Real Estate", mappedFrom: "property companies" },
    );
  });

  it("keeps exact Yahoo labels (case-insensitive)", () => {
    assert.deepEqual(
      resolveTaxonomyValue("financial services", TAXONOMY.sectors, "sector"),
      { ok: true, value: "Financial Services" },
    );
    assert.deepEqual(
      resolveTaxonomyValue("Technology", TAXONOMY.sectors, "sector"),
      { ok: true, value: "Technology" },
    );
  });

  it("drops invented labels that cannot be mapped", () => {
    assert.deepEqual(
      resolveTaxonomyValue("Quantum Computing", TAXONOMY.sectors, "sector"),
      { ok: false },
    );
  });

  it("fuzzy-matches industry Banks onto Banks - Diversified", () => {
    const result = resolveTaxonomyValue(
      "Banks",
      TAXONOMY.industries,
      "industry",
    );
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.value, "Banks - Diversified");
  });
});

describe("canonicalizeScreenSpec", () => {
  it("rewrites sector Financials and keeps the P/E ceiling", () => {
    const spec: ScreenSpec = {
      conditions: [
        { field: "pe", operator: "lte", value: 9.9 },
        { field: "sector", operator: "eq", value: "Financials" },
      ],
      page: 1,
      pageSize: 50,
    };
    const { spec: next, warnings } = canonicalizeScreenSpec(spec, TAXONOMY);
    assert.equal(next.conditions.length, 2);
    assert.deepEqual(next.conditions[0], {
      field: "pe",
      operator: "lte",
      value: 9.9,
    });
    assert.deepEqual(next.conditions[1], {
      field: "sector",
      operator: "eq",
      value: "Financial Services",
    });
    assert.ok(warnings.some((w) => /Financials/.test(w) && /Financial Services/.test(w)));
  });

  it("drops an unmatched sector instead of passing it through", () => {
    const spec: ScreenSpec = {
      conditions: [
        { field: "sector", operator: "eq", value: "Made Up Sector" },
        { field: "pe", operator: "lt", value: 12 },
      ],
      page: 1,
      pageSize: 50,
    };
    const { spec: next, warnings } = canonicalizeScreenSpec(spec, TAXONOMY);
    assert.equal(next.conditions.length, 1);
    assert.equal(next.conditions[0]?.field, "pe");
    assert.ok(warnings.some((w) => /Made Up Sector/.test(w)));
  });

  it("canonicalizes sector values inside an `in` list", () => {
    const spec: ScreenSpec = {
      conditions: [
        {
          field: "sector",
          operator: "in",
          value: ["Financials", "Tech", "Nope"],
        },
      ],
      page: 1,
      pageSize: 50,
    };
    const { spec: next, warnings } = canonicalizeScreenSpec(spec, TAXONOMY);
    assert.deepEqual(next.conditions[0]?.value, [
      "Financial Services",
      "Technology",
    ]);
    assert.ok(warnings.some((w) => /Nope/.test(w)));
  });
});

describe("NL prompt taxonomy block", () => {
  it("injects live sector labels into the parse system prompt", () => {
    const prompt = buildSystemPrompt(TAXONOMY);
    assert.match(prompt, /Yahoo taxonomy/i);
    assert.match(prompt, /Financial Services/);
    assert.match(prompt, /Never invent/i);
  });

  it("lists industries when present", () => {
    const block = formatTaxonomyForPrompt(TAXONOMY);
    assert.match(block, /Banks - Diversified/);
    assert.match(block, /### Sectors \(11\)/);
  });
});

describe("parseAndValidateRefineJson + taxonomy", () => {
  const currentSpec: ScreenSpec = {
    conditions: [{ field: "pe", operator: "lte", value: 20 }],
    page: 1,
    pageSize: 50,
  };

  it("maps an added Financials sector onto Financial Services", () => {
    const raw = JSON.stringify({
      changes: [
        {
          op: "add",
          condition: { field: "sector", operator: "eq", value: "Financials" },
        },
      ],
    });
    const res = parseAndValidateRefineJson(raw, currentSpec, TAXONOMY);
    assert.equal(res.changes.length, 1);
    assert.equal(res.changes[0]?.op, "add");
    if (res.changes[0]?.op === "add") {
      assert.equal(res.changes[0].condition.value, "Financial Services");
    }
    assert.ok(res.warnings?.some((w) => /Financials/.test(w)));
  });
});
