import { FIELD_DEFS, type FieldDef } from "screener-contract";
import { formatGlossaryForPrompt } from "./glossary";
import {
  formatTaxonomyForPrompt,
  type NlTaxonomy,
} from "./taxonomy";

/** Build the field catalogue from FIELD_DEFS so the prompt cannot drift. */
export function formatFieldCatalogue(): string {
  const lines: string[] = [];
  for (const def of Object.values(FIELD_DEFS) as FieldDef[]) {
    const bits = [`${def.field}`, `label="${def.label}"`, `kind=${def.kind}`];
    if (def.unit) bits.push(`unit=${def.unit}`);
    if (def.options?.length) bits.push(`options=[${def.options.join(", ")}]`);
    if (def.min != null) bits.push(`min≈${def.min}`);
    if (def.max != null) bits.push(`max≈${def.max}`);
    lines.push(`- ${bits.join(" | ")}`);
  }
  return lines.join("\n");
}

export function buildSystemPrompt(taxonomy?: NlTaxonomy): string {
  const taxonomyBlock = taxonomy
    ? `\n${formatTaxonomyForPrompt(taxonomy)}\n`
    : "";
  return `You are a stock-screener query compiler for Singapore SGX equities.
Translate the user's natural-language screen into our Filter DSL JSON.

## Output rules (strict)
- Return ONLY a single JSON object. No prose, no markdown fences, no commentary.
- Shape:
  {
    "conditions": [ { "field": "<ScreenerField>", "operator": "<op>", "value": <...> }, ... ],
    "sort": { "field": "<ScreenerField>", "direction": "asc" | "desc" },  // optional
    "warnings": [ "<string>", ... ]  // optional; phrases you could not map to filters
  }
- Do NOT include page or pageSize (the server sets defaults).
- AND logic across conditions. One condition per field (last wins if duplicates).

## Operators
- gt, gte, lt, lte, eq → value is a number or string
- between → value is [min, max] (two numbers)
- in → value is a string array (for enum fields: sector, industry, board, exchange, country)

## Unit conventions (critical)
- Percentages / ratios are DECIMAL FRACTIONS, not whole percents.
  Examples: 4% → 0.04; dividend yield 5% → 0.05; ROE 15% → 0.15; −10% from high → -0.10
- Money (market_cap, price, eps, free_cash_flow) is raw SGD (e.g. market_cap 1e9 = S$1 billion).
- RSI is 0–100 (not a fraction). P/E, P/B, P/S, PEG, debt_to_equity are plain ratios.
- When applying a glossary concept, use the concept's \`value\` exactly as the Filter DSL number (already in the correct unit).

${formatGlossaryForPrompt()}

## Explicit numbers vs glossary
- If the user gives an explicit number ("PE under 12", "yield above 5%"), use that number — do not substitute the glossary.
- For "@TICKER with better X" comparisons: use the referenced ticker's factual metric as the threshold (e.g. dividend_yield gt that ticker's yield).

## Available fields (from FIELD_DEFS — use only these field ids)
${formatFieldCatalogue()}
${taxonomyBlock}`;
}

export function buildUserPrompt(args: {
  text: string;
  referenceBlock: string;
}): string {
  const parts = [
    "User screen request:",
    args.text.trim(),
  ];
  if (args.referenceBlock) {
    parts.push("", args.referenceBlock);
  }
  parts.push(
    "",
    "Respond with the JSON object only.",
  );
  return parts.join("\n");
}

export function buildRepairPrompt(args: {
  previousRaw: string;
  validationError: string;
}): string {
  return [
    "Your previous JSON failed schema validation.",
    "Validation error:",
    args.validationError,
    "",
    "Previous output:",
    args.previousRaw,
    "",
    "Return a corrected JSON object only (same shape). No markdown fences.",
  ].join("\n");
}
