import {
  NlParseResponse,
  type NlParseRequest,
  type NlParseResponse as NlParseResponseType,
} from "screener-contract";
import {
  formatReferenceContextBlock,
  loadReferenceContext,
} from "./context";
import {
  hasOpenRouterApiKey,
  resolveMissingOpenRouterKey,
} from "./nlParseStub";
import { openRouterChat, type ChatMessage } from "./openrouter";
import {
  buildRepairPrompt,
  buildSystemPrompt,
  buildUserPrompt,
} from "./prompt";
import {
  canonicalizeScreenSpec,
  loadNlTaxonomy,
} from "./taxonomy";
import {
  NlParseError,
  parseAndValidateLlmJson,
} from "./validateLlm";

export { NlParseError, parseAndValidateLlmJson, stripMarkdownFences } from "./validateLlm";
export {
  buildNlParseStubResponse,
  isNlParseStubEnabled,
} from "./nlParseStub";

/**
 * NL → validated ScreenSpec. Never returns unvalidated LLM output.
 * One repair attempt on validation failure, then reject.
 *
 * Without OPENROUTER_API_KEY: returns a canned stub only when NL_PARSE_STUB=true;
 * otherwise throws NlConfigError (never stubs in production by accident).
 */
export async function parseNaturalLanguage(
  request: NlParseRequest,
): Promise<NlParseResponseType> {
  const text = request.text.trim();
  if (!text) {
    throw new NlParseError("Text is required");
  }

  if (!hasOpenRouterApiKey()) {
    return resolveMissingOpenRouterKey();
  }

  const refs = await loadReferenceContext(request.references ?? []);
  const missing = (request.references ?? []).filter(
    (t) => !refs.some((r) => r.ticker === t),
  );
  const referenceBlock = formatReferenceContextBlock(refs);
  const taxonomy = await loadNlTaxonomy();

  const system = buildSystemPrompt(taxonomy);
  const user = buildUserPrompt({ text, referenceBlock });

  const messages: ChatMessage[] = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];

  let raw = await openRouterChat(messages);

  try {
    const validated = parseAndValidateLlmJson(raw);
    const canonical = canonicalizeScreenSpec(validated.spec, taxonomy);
    const extraWarnings = [
      ...(validated.warnings ?? []),
      ...canonical.warnings,
      ...missing.map((t) => `referenced ticker '${t}' not found — ignored`),
    ];
    return NlParseResponse.parse({
      spec: canonical.spec,
      warnings: extraWarnings.length > 0 ? extraWarnings : undefined,
    });
  } catch (firstErr) {
    const validationError =
      firstErr instanceof Error ? firstErr.message : String(firstErr);

    messages.push({ role: "assistant", content: raw });
    messages.push({
      role: "user",
      content: buildRepairPrompt({ previousRaw: raw, validationError }),
    });

    try {
      raw = await openRouterChat(messages);
      const repaired = parseAndValidateLlmJson(raw);
      const canonical = canonicalizeScreenSpec(repaired.spec, taxonomy);
      const extraWarnings = [
        ...(repaired.warnings ?? []),
        ...canonical.warnings,
        ...missing.map((t) => `referenced ticker '${t}' not found — ignored`),
        "model output required a repair pass",
      ];
      return NlParseResponse.parse({
        spec: canonical.spec,
        warnings: extraWarnings,
      });
    } catch (repairErr) {
      const detail =
        repairErr instanceof Error ? repairErr.message : String(repairErr);
      throw new NlParseError(
        `Couldn't understand that — output failed validation even after repair (${detail})`,
      );
    }
  }
}
