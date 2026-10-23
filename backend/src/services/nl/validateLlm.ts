import {
  NlParseResponse,
  ScreenSpec,
  type NlParseResponse as NlParseResponseType,
} from "screener-contract";

export class NlParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NlParseError";
  }
}

/** Strip optional ``` / ```json fences the model sometimes adds. */
export function stripMarkdownFences(raw: string): string {
  let text = raw.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/i, "");
    text = text.replace(/\s*```$/i, "");
  }
  return text.trim();
}

interface LlmPayload {
  conditions?: unknown;
  sort?: unknown;
  page?: unknown;
  pageSize?: unknown;
  warnings?: unknown;
  spec?: unknown;
}

function extractWarnings(payload: LlmPayload): string[] {
  if (!Array.isArray(payload.warnings)) return [];
  return payload.warnings.filter((w): w is string => typeof w === "string");
}

/**
 * Parse model JSON → ScreenSpec + warnings.
 * Accepts either a bare ScreenSpec-like object or `{ spec, warnings }`.
 */
export function parseAndValidateLlmJson(raw: string): NlParseResponseType {
  const stripped = stripMarkdownFences(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    throw new NlParseError("Model output was not valid JSON");
  }

  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new NlParseError("Model output must be a JSON object");
  }

  const payload = parsed as LlmPayload;
  const warnings = extractWarnings(payload);

  let candidate: unknown;
  if (
    payload.spec != null &&
    typeof payload.spec === "object" &&
    !Array.isArray(payload.spec)
  ) {
    candidate = payload.spec;
  } else {
    const { warnings: _w, spec: _s, ...rest } = payload;
    candidate = rest;
  }

  const result = ScreenSpec.safeParse(candidate);
  if (!result.success) {
    throw new NlParseError(result.error.message);
  }

  return NlParseResponse.parse({
    spec: result.data,
    warnings: warnings.length > 0 ? warnings : undefined,
  });
}
