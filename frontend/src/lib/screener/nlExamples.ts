/** Clickable example prompts for one-shot NL parse (Home / empty Ask). */
export const NL_EXAMPLE_PROMPTS = [
  "REITs yielding over 6%",
  "cheap banks",
  "profitable companies with low debt",
  "large caps near their 52-week low",
] as const;

/** Clickable example prompts when refining an existing screen in Ask. */
export const NL_REFINE_EXAMPLE_PROMPTS = [
  "loosen the P/E filter",
  "also require low debt",
  "drop the market cap filter",
  "make this more conservative",
] as const;

export const NL_EDITOR_PLACEHOLDER = "e.g. REITs yielding over 6%";

export const NL_REFINE_PLACEHOLDER = "e.g. loosen the P/E filter";

/** One-line hint under the Ask editor in refine mode. */
export const NL_REFINE_HINT =
  "Describe a change — we'll suggest edits you can accept or skip.";
