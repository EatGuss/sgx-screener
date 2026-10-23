/**
 * Data-derived NL qualitative glossary.
 *
 * Source of truth for thresholds is live `screener_metrics` (active SGX liquid-core).
 * Regenerate when the universe or metrics change:
 *
 *   cd backend && npm run nl:glossary
 *
 * The generated file (`glossary.generated.ts`) is committed so reviewers can see
 * the numeric thresholds without running the script.
 */
import type { Operator, ScreenerField } from "screener-contract";
import { NL_GLOSSARY } from "./glossary.generated";
import type { GeneratedGlossary } from "./glossary.generated";

export type { GeneratedGlossary };

export interface GlossaryConcept {
  /** Stable id, e.g. `high_yield`. */
  id: string;
  /** Example phrasings the model should map onto this concept. */
  phrases: string[];
  field: ScreenerField;
  operator: Extract<Operator, "gte" | "lte">;
  /** Raw Filter DSL value (decimals for %, SGD for market_cap). */
  value: number;
  /** Human-readable threshold for prompts/warnings, e.g. `6.1%`. */
  display: string;
  /** Which tail of the distribution this threshold comes from. */
  percentile: 25 | 75;
  /** Non-null sample size used for percentile_cont. */
  sampleSize: number;
  /** Quartile wording for warnings: "top quartile" | "bottom quartile". */
  quartileLabel: "top quartile" | "bottom quartile";
}

export interface NlGlossary {
  /** ISO date (YYYY-MM-DD) when the glossary was generated. */
  generatedAt: string;
  /** Metrics as-of date from screener_metrics (max), if available. */
  metricsAsOf: string | null;
  /** Active companies contributing to the sample. */
  activeCompanyCount: number;
  concepts: GlossaryConcept[];
}

export function getNlGlossary(): NlGlossary {
  return NL_GLOSSARY;
}

/** Warning text the model must emit when applying a concept. */
export function conceptWarning(
  concept: GlossaryConcept,
  userPhrase: string,
): string {
  const op = concept.operator === "gte" ? "≥" : "≤";
  const fieldLabel = concept.field.replace(/_/g, " ");
  return `Interpreted '${userPhrase}' as ${fieldLabel} ${op} ${concept.display} (${concept.quartileLabel} on SGX).`;
}

/** Markdown block injected into the NL system prompt. */
export function formatGlossaryForPrompt(
  glossary: NlGlossary = NL_GLOSSARY,
): string {
  const asOf = glossary.metricsAsOf ?? glossary.generatedAt;
  const lines: string[] = [
    "## Qualitative concept glossary (authoritative)",
    `Calibrated to the SGX liquid-core universe from live screener_metrics (as of ${asOf}, n≈${glossary.activeCompanyCount} active names).`,
    "Thresholds are percentile_cont over **non-null** values only (nulls do not skew).",
    "These definitions are authoritative — map any qualitative phrasing onto a concept below.",
    "**Never invent your own numeric threshold** for vague language.",
    "When you apply a concept, add a warning exactly in this form:",
    `  "Interpreted '<user phrase>' as <field> ≥|≤ <display> (top|bottom quartile on SGX)."`,
    "Example: \"Interpreted 'high yield' as dividend yield ≥ 6.1% (top quartile on SGX).\"",
    "If a phrase maps to **no** concept and the user gave no explicit number, apply **no** filter for that phrase and warn (e.g. \"couldn't interpret 'quality' — ignored\").",
    "Explicit numeric requests from the user still take precedence over the glossary.",
    "",
    "### Concepts",
  ];

  for (const c of glossary.concepts) {
    const op = c.operator === "gte" ? "gte" : "lte";
    const phraseList = c.phrases.map((p) => `"${p}"`).join(", ");
    lines.push(
      `- **${c.id}** (${phraseList}): \`${c.field}\` ${op} ${c.value} → filter value; display ${c.display}; p${c.percentile} (${c.quartileLabel}); n=${c.sampleSize}`,
    );
  }

  return lines.join("\n");
}
