import {
  FIELD_DEFS,
  type FilterCondition,
  type Operator,
  type ScreenSpec,
  type ScreenerField,
} from "screener-contract";
import { formatMarketCap, formatPercent, formatSgd } from "./format";

const OP_LABELS: Record<Operator, string> = {
  gt: ">",
  gte: "≥",
  lt: "<",
  lte: "≤",
  eq: "=",
  between: "between",
  in: "in",
};

function formatConditionValue(cond: FilterCondition): string {
  const def = FIELD_DEFS[cond.field];

  if (cond.operator === "between" && Array.isArray(cond.value)) {
    const [min, max] = cond.value as [number, number];
    return `${formatFieldValue(def.field, min)} – ${formatFieldValue(def.field, max)}`;
  }

  if (cond.operator === "in" && Array.isArray(cond.value)) {
    return (cond.value as string[]).join(", ");
  }

  if (typeof cond.value === "number") {
    return formatFieldValue(cond.field, cond.value);
  }

  return String(cond.value);
}

function formatFieldValue(field: ScreenerField, value: number): string {
  const def = FIELD_DEFS[field];
  switch (def.kind) {
    case "currency":
      return field === "market_cap" ? formatMarketCap(value) : formatSgd(value);
    case "percent":
      return formatPercent(value);
    default:
      return value.toLocaleString("en-SG");
  }
}

/** Human-readable label for an active filter chip. */
export function conditionLabel(cond: FilterCondition): string {
  const def = FIELD_DEFS[cond.field];
  const op = OP_LABELS[cond.operator];
  return `${def.label} ${op} ${formatConditionValue(cond)}`;
}

/** Short summary of a screen's conditions for preset cards. */
export function specSummary(spec: ScreenSpec): string {
  if (spec.conditions.length === 0) return "No filters";
  return spec.conditions.map(conditionLabel).join(" · ");
}

export const DEFAULT_SCREEN_SPEC: ScreenSpec = {
  conditions: [],
  sort: { field: "market_cap", direction: "desc" },
  page: 1,
  pageSize: 50,
};
