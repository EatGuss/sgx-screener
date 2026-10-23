import { z } from "zod";
import {
  FilterCondition,
  NlRefineChange,
  NlRefineResponse,
  type FilterCondition as FilterConditionType,
  type NlRefineChange as NlRefineChangeType,
  type NlRefineRequest,
  type NlRefineResponse as NlRefineResponseType,
  type ScreenSpec,
} from "screener-contract";
import { formatGlossaryForPrompt } from "./glossary";
import {
  hasOpenRouterApiKey,
  isNlParseStubEnabled,
} from "./nlParseStub";
import { NlConfigError, openRouterChat, type ChatMessage } from "./openrouter";
import { formatFieldCatalogue } from "./prompt";
import {
  canonicalizeRefineChanges,
  formatTaxonomyForPrompt,
  loadNlTaxonomy,
  type NlTaxonomy,
} from "./taxonomy";
import { stripMarkdownFences } from "./validateLlm";

// context.ts pulls Drizzle — import lazily inside refineNaturalLanguage so unit
// tests for validation/stub stay DB-free (same pattern as parse.test.ts).

export class NlRefineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NlRefineError";
  }
}

/** Loose first pass so we can filter per-change rather than fail the whole payload. */
const LooseRefinePayload = z.object({
  changes: z.array(z.unknown()).default([]),
  warnings: z.array(z.string()).optional(),
});

export function buildRefineSystemPrompt(taxonomy?: NlTaxonomy): string {
  const taxonomyBlock = taxonomy
    ? `\n${formatTaxonomyForPrompt(taxonomy)}\n`
    : "";
  return `You refine an existing stock-screener Filter DSL for Singapore SGX equities.
The user already has a screen. Propose a DIFF of changes — do NOT return a full replacement ScreenSpec.

## Output rules (strict)
- Return ONLY a single JSON object. No prose, no markdown fences, no commentary.
- Shape:
  {
    "changes": [
      { "op": "add", "condition": { "field": "...", "operator": "...", "value": ... } },
      { "op": "modify", "from": { "field": "...", "operator": "...", "value": ... }, "to": { "field": "...", "operator": "...", "value": ... } },
      { "op": "remove", "condition": { "field": "...", "operator": "...", "value": ... } }
    ],
    "warnings": [ "<string>", ... ]  // optional
  }
- One condition per field on a screen (AND across conditions).
- "add": field must NOT already exist on the current screen.
- "modify": field MUST already exist; "from" should match the current condition; "to.field" must equal "from.field".
- "remove": field MUST already exist; "condition" should match the current condition for that field.
- If the request is already satisfied or unclear, return "changes": [] and explain in warnings.
- Do not invent fields. Only condition diffs (no page/pageSize/sort changes).

## Operators
- gt, gte, lt, lte, eq → value is a number or string
- between → value is [min, max] (two numbers)
- in → value is a string array (sector, industry, board, exchange, country)

## Unit conventions (critical)
- Percentages / ratios are DECIMAL FRACTIONS (4% → 0.04; ROE 15% → 0.15).
- Money (market_cap, price, eps, free_cash_flow) is raw SGD.
- RSI is 0–100. P/E, P/B, P/S, PEG, debt_to_equity are plain ratios.
- Glossary concept values are already in Filter DSL units — use them as-is.

${formatGlossaryForPrompt()}

## Available fields (from FIELD_DEFS — use only these field ids)
${formatFieldCatalogue()}
${taxonomyBlock}`;
}

export function buildRefineUserPrompt(args: {
  text: string;
  currentSpec: ScreenSpec;
  referenceBlock: string;
}): string {
  const parts = [
    "Current screen (Filter DSL JSON):",
    JSON.stringify(
      {
        conditions: args.currentSpec.conditions,
        ...(args.currentSpec.sort ? { sort: args.currentSpec.sort } : {}),
      },
      null,
      2,
    ),
    "",
    "User refinement request:",
    args.text.trim(),
  ];
  if (args.referenceBlock) {
    parts.push("", args.referenceBlock);
  }
  parts.push("", "Respond with the JSON diff object only.");
  return parts.join("\n");
}

function conditionsEqual(
  a: FilterConditionType,
  b: FilterConditionType,
): boolean {
  return (
    a.field === b.field &&
    a.operator === b.operator &&
    JSON.stringify(a.value) === JSON.stringify(b.value)
  );
}

function findByField(
  spec: ScreenSpec,
  field: string,
): FilterConditionType | undefined {
  return spec.conditions.find((c) => c.field === field);
}

/**
 * Drop / rewrite changes that don't apply to currentSpec; collect warnings.
 * Zod already ensures field/operator/value shape on accepted items.
 */
export function validateChangesAgainstSpec(
  currentSpec: ScreenSpec,
  changes: NlRefineChangeType[],
): { changes: NlRefineChangeType[]; warnings: string[] } {
  const out: NlRefineChangeType[] = [];
  const warnings: string[] = [];
  const seenFields = new Set<string>();

  for (const change of changes) {
    if (change.op === "add") {
      const field = change.condition.field;
      if (findByField(currentSpec, field)) {
        warnings.push(
          `ignored add for '${field}' — already on the screen (use modify)`,
        );
        continue;
      }
      if (seenFields.has(field)) {
        warnings.push(`ignored duplicate add for '${field}'`);
        continue;
      }
      const parsed = FilterCondition.safeParse(change.condition);
      if (!parsed.success) {
        warnings.push(`ignored invalid add for '${field}'`);
        continue;
      }
      seenFields.add(field);
      out.push({ op: "add", condition: parsed.data });
      continue;
    }

    if (change.op === "remove") {
      const field = change.condition.field;
      const existing = findByField(currentSpec, field);
      if (!existing) {
        warnings.push(
          `ignored remove for '${field}' — not on the current screen`,
        );
        continue;
      }
      if (seenFields.has(field)) {
        warnings.push(`ignored duplicate change for '${field}'`);
        continue;
      }
      seenFields.add(field);
      out.push({ op: "remove", condition: existing });
      continue;
    }

    const field = change.to.field;
    if (change.from.field !== change.to.field) {
      warnings.push(
        `ignored modify — from.field (${change.from.field}) ≠ to.field (${change.to.field})`,
      );
      continue;
    }
    const existing = findByField(currentSpec, field);
    if (!existing) {
      warnings.push(
        `ignored modify for '${field}' — not on the current screen (use add)`,
      );
      continue;
    }
    const toParsed = FilterCondition.safeParse(change.to);
    if (!toParsed.success) {
      warnings.push(`ignored invalid modify for '${field}'`);
      continue;
    }
    if (conditionsEqual(existing, toParsed.data)) {
      warnings.push(`ignored modify for '${field}' — no change`);
      continue;
    }
    if (seenFields.has(field)) {
      warnings.push(`ignored duplicate change for '${field}'`);
      continue;
    }
    seenFields.add(field);
    out.push({
      op: "modify",
      from: existing,
      to: toParsed.data,
    });
  }

  return { changes: out, warnings };
}

export function parseAndValidateRefineJson(
  raw: string,
  currentSpec: ScreenSpec,
  taxonomy?: NlTaxonomy,
): NlRefineResponseType {
  const stripped = stripMarkdownFences(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    throw new NlRefineError("Model output was not valid JSON");
  }

  const shape = LooseRefinePayload.safeParse(parsed);
  if (!shape.success) {
    throw new NlRefineError(shape.error.message);
  }

  const validatedChanges: NlRefineChangeType[] = [];
  let droppedInvalid = 0;
  for (const ch of shape.data.changes) {
    const one = NlRefineChange.safeParse(ch);
    if (!one.success) {
      droppedInvalid += 1;
      continue;
    }
    validatedChanges.push(one.data);
  }

  const canonical = taxonomy
    ? canonicalizeRefineChanges(validatedChanges, taxonomy)
    : { changes: validatedChanges, warnings: [] as string[] };
  const { changes, warnings: applyWarnings } = validateChangesAgainstSpec(
    currentSpec,
    canonical.changes,
  );
  const warnings = [
    ...(shape.data.warnings ?? []),
    ...canonical.warnings,
    ...applyWarnings,
    ...(droppedInvalid > 0
      ? [
          `${droppedInvalid} proposed change${droppedInvalid === 1 ? "" : "s"} failed schema validation and ${droppedInvalid === 1 ? "was" : "were"} dropped`,
        ]
      : []),
  ];

  return NlRefineResponse.parse({
    changes,
    warnings: warnings.length > 0 ? warnings : undefined,
  });
}

/** Offline canned refine when NL_PARSE_STUB=true and no API key. */
export function buildNlRefineStubResponse(
  currentSpec: ScreenSpec,
): NlRefineResponseType {
  const pe = findByField(currentSpec, "pe");
  let changes: NlRefineChangeType[];
  if (pe && typeof pe.value === "number") {
    changes = [
      {
        op: "modify",
        from: pe,
        to: {
          field: "pe",
          operator: pe.operator === "eq" ? "lte" : pe.operator,
          value: Math.max(1, Number(pe.value) - 5),
        },
      },
    ];
  } else if (!pe) {
    changes = [
      {
        op: "add",
        condition: { field: "pe", operator: "lte", value: 15 },
      },
    ];
  } else {
    const roe = findByField(currentSpec, "roe");
    changes = roe
      ? [{ op: "remove", condition: roe }]
      : [
          {
            op: "add",
            condition: { field: "roe", operator: "gte", value: 0.12 },
          },
        ];
  }

  const { changes: validated, warnings } = validateChangesAgainstSpec(
    currentSpec,
    changes,
  );
  return NlRefineResponse.parse({
    changes: validated,
    warnings: [
      "NL refine stub (NL_PARSE_STUB=true, no OPENROUTER_API_KEY): returning canned refinements — not from the LLM.",
      ...warnings,
    ],
  });
}

export function resolveMissingOpenRouterKeyForRefine(
  currentSpec: ScreenSpec,
): NlRefineResponseType {
  if (isNlParseStubEnabled()) {
    console.error(
      "[nl] ********************************************************************\n" +
        "[nl] STUB ACTIVE: NL_PARSE_STUB=true and OPENROUTER_API_KEY is unset.\n" +
        "[nl] Returning a canned NlRefineResponse (not LLM-refined).\n" +
        "[nl] Never enable NL_PARSE_STUB in a real deployment.\n" +
        "[nl] ********************************************************************",
    );
    return buildNlRefineStubResponse(currentSpec);
  }
  throw new NlConfigError(
    "OPENROUTER_API_KEY is not set (set the key for real NL refine, or NL_PARSE_STUB=true for a local canned response)",
  );
}

/**
 * Conversational refine: propose add/modify/remove against currentSpec.
 * Same OpenRouter client / model / stub gating as parseNaturalLanguage.
 */
export async function refineNaturalLanguage(
  request: NlRefineRequest,
): Promise<NlRefineResponseType> {
  const text = request.text.trim();
  if (!text) {
    throw new NlRefineError("Text is required");
  }

  const currentSpec = request.currentSpec;

  if (!hasOpenRouterApiKey()) {
    return resolveMissingOpenRouterKeyForRefine(currentSpec);
  }

  const { formatReferenceContextBlock, loadReferenceContext } = await import(
    "./context"
  );
  const refs = await loadReferenceContext(request.references ?? []);
  const missing = (request.references ?? []).filter(
    (t) => !refs.some((r) => r.ticker === t),
  );
  const referenceBlock = formatReferenceContextBlock(refs);
  const taxonomy = await loadNlTaxonomy();

  const messages: ChatMessage[] = [
    { role: "system", content: buildRefineSystemPrompt(taxonomy) },
    {
      role: "user",
      content: buildRefineUserPrompt({ text, currentSpec, referenceBlock }),
    },
  ];

  let raw = await openRouterChat(messages);

  try {
    const validated = parseAndValidateRefineJson(raw, currentSpec, taxonomy);
    const extra = [
      ...(validated.warnings ?? []),
      ...missing.map((t) => `referenced ticker '${t}' not found — ignored`),
    ];
    return NlRefineResponse.parse({
      changes: validated.changes,
      warnings: extra.length > 0 ? extra : undefined,
    });
  } catch (firstErr) {
    const validationError =
      firstErr instanceof Error ? firstErr.message : String(firstErr);
    messages.push({ role: "assistant", content: raw });
    messages.push({
      role: "user",
      content: [
        "Your previous JSON failed validation.",
        `Error: ${validationError}`,
        'Return ONLY valid JSON: { "changes": [ ... ], "warnings": [ ... ] }',
        "No markdown fences. Only add/modify/remove ops as specified.",
      ].join("\n"),
    });
    try {
      raw = await openRouterChat(messages);
      const repaired = parseAndValidateRefineJson(raw, currentSpec, taxonomy);
      const extra = [
        ...(repaired.warnings ?? []),
        ...missing.map((t) => `referenced ticker '${t}' not found — ignored`),
        "model output required a repair pass",
      ];
      return NlRefineResponse.parse({
        changes: repaired.changes,
        warnings: extra,
      });
    } catch (repairErr) {
      const detail =
        repairErr instanceof Error ? repairErr.message : String(repairErr);
      throw new NlRefineError(
        `Couldn't refine that — output failed validation even after repair (${detail})`,
      );
    }
  }
}
