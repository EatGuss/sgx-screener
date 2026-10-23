import { FIELD_DEFS, FIELD_GROUPS, type ScreenerField } from "screener-contract";
import { HIDDEN_FILTER_FIELDS } from "./filter-controls";

/**
 * Primary filter pills shown in the bar (up to two rows).
 * Remaining fields live under "+ More filters" until selected.
 */
export const PRIMARY_PILL_FIELDS: ScreenerField[] = [
  "market_cap",
  "sector",
  "price",
  "pe",
  "pb",
  "dividend_yield",
  "roe",
  "revenue_growth_yoy",
  "debt_to_equity",
  "rsi_14",
  "perf_1y",
  "avg_volume_30d",
];

const PRIMARY_SET = new Set<ScreenerField>(PRIMARY_PILL_FIELDS);

export function isPrimaryPillField(field: ScreenerField): boolean {
  return PRIMARY_SET.has(field);
}

/** All filterable fields except hidden (board). */
export function allFilterableFields(): ScreenerField[] {
  return (Object.keys(FIELD_DEFS) as ScreenerField[]).filter(
    (f) => !HIDDEN_FILTER_FIELDS.has(f),
  );
}

/** Fields that belong behind "+ More filters" until pinned. */
export function moreFilterFields(): ScreenerField[] {
  return allFilterableFields().filter((f) => !PRIMARY_SET.has(f));
}

/** FIELD_GROUPS for the More filters picker (all filterable fields). */
export function filterPickerGroups(): { group: string; fields: ScreenerField[] }[] {
  const allowed = new Set(allFilterableFields());
  return Object.entries(FIELD_GROUPS)
    .map(([group, defs]) => ({
      group,
      fields: defs.map((d) => d.field).filter((f) => allowed.has(f)),
    }))
    .filter((g) => g.fields.length > 0);
}

/** @deprecated Prefer filterPickerGroups — kept for any leftover callers. */
export function moreFilterGroups(): { group: string; fields: ScreenerField[] }[] {
  const more = new Set(moreFilterFields());
  return Object.entries(FIELD_GROUPS)
    .map(([group, defs]) => ({
      group,
      fields: defs.map((d) => d.field).filter((f) => more.has(f)),
    }))
    .filter((g) => g.fields.length > 0);
}

/** Compact inactive pill label, e.g. "P/E". */
export function pillIdleLabel(field: ScreenerField): string {
  return FIELD_DEFS[field].label;
}
