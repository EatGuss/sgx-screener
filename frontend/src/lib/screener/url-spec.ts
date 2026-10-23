import type { ScreenSpec } from "screener-contract";
import { ScreenSpec as ScreenSpecSchema } from "screener-contract";

/** Encode a ScreenSpec for the `?spec=` query param (URL-safe base64 JSON). */
export function encodeScreenSpecParam(spec: ScreenSpec): string {
  const json = JSON.stringify({
    conditions: spec.conditions,
    sort: spec.sort,
    page: spec.page ?? 1,
    pageSize: spec.pageSize ?? 50,
  });
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Decode `?spec=` — treat as untrusted input.
 * Returns null if missing, malformed, or fails Zod validation (never throws).
 */
export function decodeScreenSpecParam(raw: string | null): ScreenSpec | null {
  if (!raw?.trim()) return null;
  try {
    const padded = raw.replace(/-/g, "+").replace(/_/g, "/");
    const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
    const binary = atob(padded + pad);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    return ScreenSpecSchema.parse(JSON.parse(json));
  } catch {
    return null;
  }
}

/**
 * Full shareable screener URL for the current origin (dev or deployed).
 * Uses `window.location.origin` — never a hardcoded host.
 */
export function buildScreenShareUrl(
  spec: ScreenSpec,
  options?: {
    /** Included as `?name=` when non-empty. */
    name?: string | null;
    /** Defaults to the current path (e.g. `/screener`). */
    pathname?: string;
  },
): string {
  const pathname = options?.pathname ?? window.location.pathname;
  const url = new URL(pathname, window.location.origin);
  url.searchParams.set("spec", encodeScreenSpecParam(spec));
  const name = options?.name?.trim();
  if (name) {
    url.searchParams.set("name", name);
  }
  return url.toString();
}

/** Compare filter identity (ignore pagination alone for dirty checks). */
export function screenIdentityKey(spec: ScreenSpec): string {
  return JSON.stringify({
    conditions: spec.conditions,
    sort: spec.sort ?? null,
  });
}

export function slugifyScreenName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "screen";
}
