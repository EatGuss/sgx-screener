import { useEffect, useState } from "react";
import type { FieldDef } from "screener-contract";
import { Label } from "@/components/ui/label";
import { useEnumFacets } from "@/hooks/useEnumFacets";
import { useFilterCondition } from "@/hooks/useFilterCondition";

interface FilterControlEnumProps {
  def: FieldDef;
}

export function FilterControlEnum({ def }: FilterControlEnumProps) {
  const { existing, upsertCondition, removeCondition } = useFilterCondition(def.field);
  const { facets, loading, error } = useEnumFacets();
  const [selected, setSelected] = useState<string[]>([]);

  const options =
    def.field === "sector"
      ? facets.sectors
      : def.field === "industry"
        ? facets.industries
        : (def.options ?? []);

  useEffect(() => {
    if (!existing) {
      setSelected([]);
      return;
    }

    if (existing.operator === "in" && Array.isArray(existing.value)) {
      setSelected(existing.value as string[]);
      return;
    }

    if (existing.operator === "eq" && typeof existing.value === "string") {
      setSelected([existing.value]);
    }
  }, [existing]);

  function applySelection(next: string[]) {
    setSelected(next);
    if (next.length === 0) {
      removeCondition(def.field);
      return;
    }

    if (next.length === 1) {
      upsertCondition({ field: def.field, operator: "eq", value: next[0] });
      return;
    }

    upsertCondition({ field: def.field, operator: "in", value: next });
  }

  function toggleOption(option: string) {
    const next = selected.includes(option)
      ? selected.filter((v) => v !== option)
      : [...selected, option];
    applySelection(next);
  }

  const needsFacets = def.field === "sector" || def.field === "industry";

  return (
    <div className="space-y-2">
      <Label className="text-xs">{def.label}</Label>

      {needsFacets && loading && options.length === 0 && (
        <p className="text-[11px] text-muted-foreground">Loading options…</p>
      )}
      {needsFacets && error && options.length === 0 && !loading && (
        <p className="text-[11px] text-muted-foreground">{error}</p>
      )}

      {options.length === 0 && !loading ? (
        !error && (
          <p className="text-[11px] text-muted-foreground">No options available.</p>
        )
      ) : options.length > 0 ? (
        <div className="max-h-36 space-y-1 overflow-y-auto rounded-md border border-input p-2">
          {options.map((option) => (
            <label
              key={option}
              className="flex cursor-pointer items-center gap-2 text-xs hover:text-foreground"
            >
              <input
                type="checkbox"
                checked={selected.includes(option)}
                onChange={() => toggleOption(option)}
                className="size-3.5 rounded border-input accent-primary"
              />
              <span className="leading-tight">{option}</span>
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}
