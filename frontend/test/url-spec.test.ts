import { afterEach, describe, expect, test, vi } from "vitest";
import type { ScreenSpec } from "screener-contract";
import {
  buildScreenShareUrl,
  decodeScreenSpecParam,
  encodeScreenSpecParam,
} from "@/lib/screener/url-spec";

const sampleSpec: ScreenSpec = {
  conditions: [
    { field: "market_cap", operator: "gte", value: 1_000_000_000 },
    { field: "pe", operator: "lt", value: 15 },
  ],
  sort: { field: "market_cap", direction: "desc" },
  page: 1,
  pageSize: 50,
};

describe("url-spec share link", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("encode → decode round-trips conditions, sort, and paging", () => {
    const encoded = encodeScreenSpecParam(sampleSpec);
    const decoded = decodeScreenSpecParam(encoded);
    expect(decoded).toEqual(sampleSpec);
  });

  test("malformed or tampered ?spec= returns null (never throws)", () => {
    expect(decodeScreenSpecParam("%%%not-base64%%%")).toBeNull();
    expect(decodeScreenSpecParam("aGVsbG8=")).toBeNull(); // "hello"
    // Valid base64 JSON that fails Zod (unknown field)
    const badJson = btoa(
      JSON.stringify({
        conditions: [{ field: "not_a_field", operator: "eq", value: 1 }],
        page: 1,
        pageSize: 50,
      }),
    );
    expect(decodeScreenSpecParam(badJson)).toBeNull();
    expect(decodeScreenSpecParam(null)).toBeNull();
    expect(decodeScreenSpecParam("")).toBeNull();
  });

  test("buildScreenShareUrl uses window.location.origin and encodes spec (+ optional name)", () => {
    vi.stubGlobal("location", {
      origin: "https://app.example.com",
      pathname: "/screener",
    });

    const withName = buildScreenShareUrl(sampleSpec, { name: "Value picks" });
    const url = new URL(withName);
    expect(url.origin).toBe("https://app.example.com");
    expect(url.pathname).toBe("/screener");
    expect(url.searchParams.get("name")).toBe("Value picks");
    expect(decodeScreenSpecParam(url.searchParams.get("spec"))).toEqual(
      sampleSpec,
    );

    const untitled = buildScreenShareUrl(sampleSpec);
    expect(new URL(untitled).searchParams.has("name")).toBe(false);
  });
});
