import type { Operator } from "screener-contract";

/** Numeric / currency / percent filter operators shown in the sidebar. */
export const NUMERIC_OPS = ["gte", "gt", "lte", "lt", "eq", "between"] as const;
export type NumericOp = (typeof NUMERIC_OPS)[number];

export const NUMERIC_OP_LABELS: Record<NumericOp, string> = {
  gte: "≥ (at least)",
  gt: "> (greater than)",
  lte: "≤ (at most)",
  lt: "< (less than)",
  eq: "= (exactly)",
  between: "between",
};

export function isNumericOp(op: Operator): op is NumericOp {
  return (NUMERIC_OPS as readonly Operator[]).includes(op);
}

/** Fields excluded from the sidebar (see FilterSidebar). */
export const HIDDEN_FILTER_FIELDS = new Set(["board"]);
