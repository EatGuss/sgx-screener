import type {
  FilterCondition,
  NlRefineChange,
  ScreenSpec,
} from "screener-contract";

/** Apply accepted refine ops onto a screen (add / modify / remove by field). */
export function applyRefineChanges(
  spec: ScreenSpec,
  changes: NlRefineChange[],
): ScreenSpec {
  let conditions: FilterCondition[] = [...spec.conditions];

  for (const change of changes) {
    if (change.op === "add") {
      conditions = conditions.filter((c) => c.field !== change.condition.field);
      conditions = [...conditions, change.condition];
      continue;
    }
    if (change.op === "modify") {
      const field = change.to.field;
      const idx = conditions.findIndex((c) => c.field === field);
      if (idx >= 0) {
        conditions = conditions.map((c, i) => (i === idx ? change.to : c));
      } else {
        conditions = [...conditions, change.to];
      }
      continue;
    }
    conditions = conditions.filter((c) => c.field !== change.condition.field);
  }

  return {
    ...spec,
    conditions,
    page: 1,
  };
}
