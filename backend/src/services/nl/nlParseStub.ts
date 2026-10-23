import {
  NlParseResponse,
  type NlParseResponse as NlParseResponseType,
  type ScreenSpec,
} from "screener-contract";
import { NlConfigError } from "./openrouter";

/** Explicit opt-in — never leave this on in a real deployment. */
export function isNlParseStubEnabled(): boolean {
  return process.env.NL_PARSE_STUB?.trim().toLowerCase() === "true";
}

export function hasOpenRouterApiKey(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

/**
 * Canned response for local UI work without an LLM key.
 * Only returned when NL_PARSE_STUB=true AND OPENROUTER_API_KEY is unset.
 */
export function buildNlParseStubResponse(): NlParseResponseType {
  const spec: ScreenSpec = {
    conditions: [
      { field: "dividend_yield", operator: "gte", value: 0.054 },
      { field: "sector", operator: "eq", value: "Real Estate" },
    ],
    page: 1,
    pageSize: 50,
  };
  return NlParseResponse.parse({
    spec,
    warnings: [
      "NL parse stub (NL_PARSE_STUB=true, no OPENROUTER_API_KEY): returning a canned screen — dividend_yield ≥ 5.4% and sector = Real Estate. Not from the LLM.",
    ],
  });
}

/**
 * When the API key is missing: return the canned stub if NL_PARSE_STUB=true,
 * otherwise throw NlConfigError (same class openRouterChat would throw).
 */
export function resolveMissingOpenRouterKey(): NlParseResponseType {
  if (isNlParseStubEnabled()) {
    console.error(
      "[nl] ********************************************************************\n" +
        "[nl] STUB ACTIVE: NL_PARSE_STUB=true and OPENROUTER_API_KEY is unset.\n" +
        "[nl] Returning a canned NlParseResponse (not LLM-parsed).\n" +
        "[nl] Never enable NL_PARSE_STUB in a real deployment.\n" +
        "[nl] ********************************************************************",
    );
    return buildNlParseStubResponse();
  }
  throw new NlConfigError(
    "OPENROUTER_API_KEY is not set (set the key for real NL parse, or NL_PARSE_STUB=true for a local canned response)",
  );
}
