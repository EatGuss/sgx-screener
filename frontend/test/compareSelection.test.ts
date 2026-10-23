import { describe, expect, it } from "vitest";
import { toModdTicker } from "@/lib/ticker";
import {
  buildCompareUrl,
  SCREENER_COMPARE_MAX,
  SCREENER_COMPARE_MIN,
} from "@/lib/screener/compareSelection";

describe("compareSelection", () => {
  it("exposes the same 2–5 bounds as Compare.tsx", () => {
    expect(SCREENER_COMPARE_MIN).toBe(2);
    expect(SCREENER_COMPARE_MAX).toBe(5);
  });

  it("builds /compare?tickers= with bare MOD-D codes", () => {
    const url = buildCompareUrl([
      { ticker: toModdTicker("D05.SI"), name: "DBS" },
      { ticker: toModdTicker("O39.SI"), name: "OCBC" },
    ]);
    expect(url).toBe("/compare?tickers=D05%2CO39");
    expect(url).not.toContain(".SI");
  });
});
