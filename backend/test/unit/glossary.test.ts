import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  conceptWarning,
  formatGlossaryForPrompt,
  getNlGlossary,
} from "../../src/services/nl/glossary";

describe("NL glossary", () => {
  it("includes high_yield calibrated near 5.4% (p75)", () => {
    const glossary = getNlGlossary();
    const highYield = glossary.concepts.find((c) => c.id === "high_yield");
    assert.ok(highYield);
    assert.equal(highYield.field, "dividend_yield");
    assert.equal(highYield.operator, "gte");
    assert.equal(highYield.percentile, 75);
    assert.equal(highYield.display, "5.4%");
    assert.ok(Math.abs(highYield.value - 0.0544) < 0.0002);
  });

  it("formats prompt block with authoritative rules", () => {
    const block = formatGlossaryForPrompt();
    assert.match(block, /Never invent your own numeric threshold/i);
    assert.match(block, /high_yield/);
    assert.match(block, /percentile_cont/);
  });

  it("builds interpretation warnings", () => {
    const highYield = getNlGlossary().concepts.find((c) => c.id === "high_yield")!;
    const w = conceptWarning(highYield, "high yield");
    assert.match(w, /Interpreted 'high yield'/);
    assert.match(w, /5\.4%/);
    assert.match(w, /top quartile on SGX/);
  });
});
