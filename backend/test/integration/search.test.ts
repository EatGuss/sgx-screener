import "dotenv/config";
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { SearchResponse } from "screener-contract";
import { searchCompanies } from "../../src/services/stocks/search";
import { closeDrizzle } from "../../src/db/drizzleClient";

describe("searchCompanies", () => {
  it("matches ticker prefix case-insensitively (D05 → DBS)", async () => {
    const res = SearchResponse.parse(await searchCompanies("D05"));
    assert.ok(res.results.some((r) => r.ticker === "D05.SI"));
    assert.equal(res.results[0]?.ticker, "D05.SI");
  });

  it("matches name substring (dbs / DBS Group)", async () => {
    const byShort = SearchResponse.parse(await searchCompanies("dbs"));
    const byName = SearchResponse.parse(await searchCompanies("DBS Group"));
    assert.ok(byShort.results.some((r) => r.ticker === "D05.SI"));
    assert.ok(byName.results.some((r) => r.ticker === "D05.SI"));
  });

  it("empty query returns top names by market cap (≤8)", async () => {
    const blank = SearchResponse.parse(await searchCompanies(""));
    const spaces = SearchResponse.parse(await searchCompanies("   "));
    assert.ok(blank.results.length > 0 && blank.results.length <= 8);
    assert.deepEqual(blank.results, spaces.results);
    assert.equal(blank.results[0]?.ticker, "D05.SI");
  });

  it("typed search caps at 8", async () => {
    const many = SearchResponse.parse(await searchCompanies("a"));
    assert.ok(many.results.length <= 8);
  });
});

describe("searchCompanies teardown", () => {
  it("closes the pool", async () => {
    await closeDrizzle();
  });
});
