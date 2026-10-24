import { describe, expect, it } from "vitest";
import { createLiveScreenerApi } from "@/lib/screener/api";

function apiReturning(status: number, body: string | null) {
  const fetchFn = (async () =>
    new Response(body, {
      status,
      headers: body ? { "Content-Type": "application/json" } : undefined,
    })) as typeof fetch;
  return createLiveScreenerApi({ fetchFn });
}

describe("API error messages", () => {
  it("surfaces the provider reason from an NL 502 instead of a generic network error", async () => {
    const api = apiReturning(502, JSON.stringify({ error: "No auth credentials found" }));
    await expect(api.parseNl({ text: "cheap banks" })).rejects.toThrow(
      "No auth credentials found",
    );
  });

  it("surfaces a 503 config error from the API", async () => {
    const api = apiReturning(503, JSON.stringify({ error: "OPENROUTER_MODEL is not set" }));
    await expect(api.parseNl({ text: "cheap banks" })).rejects.toThrow(
      "OPENROUTER_MODEL is not set",
    );
  });

  it("treats a bodiless 502 as the API being unreachable", async () => {
    const api = apiReturning(502, null);
    await expect(api.getPresets()).rejects.toThrow("Couldn't reach the server");
  });

  it("keeps the login prompt for 401", async () => {
    const api = apiReturning(401, JSON.stringify({ error: "Authentication required" }));
    await expect(api.listScreens()).rejects.toThrow("Log in to save screens");
  });

  it("falls back to the status code when there is no message", async () => {
    const api = apiReturning(500, null);
    await expect(api.getFacets()).rejects.toThrow("Request failed (500)");
  });
});
