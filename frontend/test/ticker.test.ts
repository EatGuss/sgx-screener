import { describe, expect, test } from "vitest";
import { toModdTicker, toWatchlistTicker, toYahooTicker } from "@/lib/ticker";

describe("ticker dialects", () => {
  test("screener .SI tickers stay Yahoo/watchlist form", () => {
    expect(toYahooTicker("D05.SI")).toBe("D05.SI");
    expect(toWatchlistTicker("d05.si")).toBe("D05.SI");
  });

  test("bare SGX codes gain .SI for watchlist/Yahoo", () => {
    expect(toWatchlistTicker("D05")).toBe("D05.SI");
    expect(toYahooTicker("  o39  ")).toBe("O39.SI");
  });

  test("tickers that already have a Yahoo suffix/special form are unchanged", () => {
    expect(toYahooTicker("7203.T")).toBe("7203.T");
    expect(toYahooTicker("BTC-USD")).toBe("BTC-USD");
    expect(toYahooTicker("GC=F")).toBe("GC=F");
  });

  test("modd strips trailing .SI only", () => {
    expect(toModdTicker("D05.SI")).toBe("D05");
    expect(toModdTicker("D05")).toBe("D05");
    expect(toModdTicker("7203.T")).toBe("7203.T");
  });
});
