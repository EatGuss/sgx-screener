import {
  FIELD_DEFS,
  NlDescribeResponse,
  type FilterCondition,
  type NlDescribeRequest,
  type NlDescribeResponse as NlDescribeResponseType,
  type ScreenSpec,
} from "screener-contract";
import {
  hasOpenRouterApiKey,
  isNlParseStubEnabled,
} from "./nlParseStub";
import { NlConfigError, openRouterChat, type ChatMessage } from "./openrouter";
import { formatFieldCatalogue } from "./prompt";
import { stripMarkdownFences } from "./validateLlm";

export class NlDescribeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NlDescribeError";
  }
}

/** Human-readable condition lines for the LLM (labels + units from FIELD_DEFS). */
export function formatConditionsForDescribe(spec: ScreenSpec): string {
  if (spec.conditions.length === 0) {
    return "(no filter conditions — broad universe)";
  }
  return spec.conditions.map(formatOneCondition).join("\n");
}

function formatOneCondition(cond: FilterCondition): string {
  const def = FIELD_DEFS[cond.field];
  const unitBits = [
    def.unit ? `unit=${def.unit}` : null,
    def.kind === "percent" ? "kind=percent (decimal fraction, e.g. 0.05 = 5%)" : null,
  ].filter(Boolean);
  const meta = unitBits.length > 0 ? ` ${unitBits.join("; ")}` : "";
  const value = JSON.stringify(cond.value);
  return `- ${cond.field} (${def.label}${meta}) ${cond.operator} ${value}`;
}

export function buildDescribeSystemPrompt(): string {
  return `You describe stock-screener filter sets in plain English for Singapore SGX equities.

## Output rules (strict)
- Return ONLY a single JSON object. No prose, no markdown fences, no commentary.
- Shape:
  {
    "description": "<one sentence>",
    "name": "<optional short title, max ~6 words>"
  }
- description: exactly one descriptive sentence (about 8–28 words). Summarize what the filters select.
- Be descriptive, never prescriptive. Do NOT recommend, rate, or advise ("good buy", "attractive", "should buy", "undervalued opportunity", etc.).
- Prefer phrasing like: "Large-cap companies trading below 15× earnings with above-average dividend yield"
- Never invent filters that are not listed. Omit sort/page unless it clarifies the screen.
- Use FIELD_DEFS labels in natural language; convert decimal fractions to percents when unit=percent (0.05 → 5%).
- Money is SGD. market_cap uses ordinary language (e.g. "large-cap" when market_cap is high, or state the threshold).

## Available fields (labels / units)
${formatFieldCatalogue()}
`;
}

export function buildDescribeUserPrompt(spec: ScreenSpec): string {
  return [
    "Describe this screen:",
    formatConditionsForDescribe(spec),
    spec.sort
      ? `Sort: ${spec.sort.field} ${spec.sort.direction}`
      : "Sort: (default)",
    "",
    "Respond with the JSON object only.",
  ].join("\n");
}

/** Offline canned describe when NL_PARSE_STUB=true and no API key. */
export function buildNlDescribeStubResponse(
  spec: ScreenSpec,
): NlDescribeResponseType {
  const description =
    spec.conditions.length === 0
      ? "All listed companies with no additional filters applied"
      : `Companies matching: ${spec.conditions
          .map((c) => {
            const def = FIELD_DEFS[c.field];
            return `${def.label} ${c.operator} ${JSON.stringify(c.value)}`;
          })
          .join("; ")}`;
  return NlDescribeResponse.parse({
    description: description.slice(0, 280),
    name:
      spec.conditions.length > 0
        ? spec.conditions
            .slice(0, 2)
            .map((c) => FIELD_DEFS[c.field].label)
            .join(" · ")
            .slice(0, 80)
        : "Untitled screen",
  });
}

/**
 * When the API key is missing: return a canned describe if NL_PARSE_STUB=true,
 * otherwise throw NlConfigError (same gating as /api/nl/parse).
 */
export function resolveMissingOpenRouterKeyForDescribe(
  spec: ScreenSpec,
): NlDescribeResponseType {
  if (isNlParseStubEnabled()) {
    console.error(
      "[nl] ********************************************************************\n" +
        "[nl] STUB ACTIVE: NL_PARSE_STUB=true and OPENROUTER_API_KEY is unset.\n" +
        "[nl] Returning a canned NlDescribeResponse (not LLM-generated).\n" +
        "[nl] Never enable NL_PARSE_STUB in a real deployment.\n" +
        "[nl] ********************************************************************",
    );
    return buildNlDescribeStubResponse(spec);
  }
  throw new NlConfigError(
    "OPENROUTER_API_KEY is not set (set the key for real NL describe, or NL_PARSE_STUB=true for a local canned response)",
  );
}

export function parseAndValidateDescribeJson(raw: string): NlDescribeResponseType {
  const stripped = stripMarkdownFences(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    throw new NlDescribeError("Model output was not valid JSON");
  }
  const result = NlDescribeResponse.safeParse(parsed);
  if (!result.success) {
    throw new NlDescribeError(result.error.message);
  }
  // Soft guard: reject clearly prescriptive copy even if schema-valid.
  if (/\b(good buy|should buy|must buy|strong buy|recommend(ed|ation)?)\b/i.test(
    result.data.description,
  )) {
    throw new NlDescribeError(
      "Description looked like a recommendation — rejected",
    );
  }
  return result.data;
}

/**
 * ScreenSpec → plain-English description (+ optional name).
 * Same OpenRouter client / model / stub gating as parseNaturalLanguage.
 */
export async function describeScreenSpec(
  request: NlDescribeRequest,
): Promise<NlDescribeResponseType> {
  const spec = request.spec;

  if (!hasOpenRouterApiKey()) {
    return resolveMissingOpenRouterKeyForDescribe(spec);
  }

  const messages: ChatMessage[] = [
    { role: "system", content: buildDescribeSystemPrompt() },
    { role: "user", content: buildDescribeUserPrompt(spec) },
  ];

  const raw = await openRouterChat(messages);
  try {
    return parseAndValidateDescribeJson(raw);
  } catch (firstErr) {
    const validationError =
      firstErr instanceof Error ? firstErr.message : String(firstErr);
    messages.push({ role: "assistant", content: raw });
    messages.push({
      role: "user",
      content: [
        "Your previous JSON failed validation.",
        `Error: ${validationError}`,
        'Return ONLY valid JSON: { "description": "<one descriptive sentence>", "name": "<optional short title>" }',
        "No recommendations. No markdown fences.",
      ].join("\n"),
    });
    try {
      const repaired = await openRouterChat(messages);
      return parseAndValidateDescribeJson(repaired);
    } catch (repairErr) {
      const detail =
        repairErr instanceof Error ? repairErr.message : String(repairErr);
      throw new NlDescribeError(
        `Couldn't describe that screen — output failed validation even after repair (${detail})`,
      );
    }
  }
}
