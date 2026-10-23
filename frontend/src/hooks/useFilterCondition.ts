import type { ScreenerField } from "screener-contract";
import { useScreenSpec } from "@/hooks/useScreenSpec";

/** Read/write a single field's condition in the shared ScreenSpec. */
export function useFilterCondition(field: ScreenerField) {
  const { spec, upsertCondition, removeCondition } = useScreenSpec();
  const existing = spec.conditions.find((c) => c.field === field);
  return { existing, upsertCondition, removeCondition };
}
