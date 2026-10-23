import { useEffect, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import { FIELD_DEFS, type ScreenerField } from "screener-contract";
import { Input } from "@/components/ui/input";
import { filterPickerGroups } from "@/lib/screener/filter-pills";
import { cn } from "@/lib/utils";

interface MoreFiltersPickerProps {
  /** Fields that already have a condition (or are pinned in the bar). */
  activeFields: Set<ScreenerField>;
  onSelect: (field: ScreenerField) => void;
  onClose: () => void;
}

/** Fuzzy: substring match, or sequential character match on the label. */
export function fuzzyMatchLabel(query: string, label: string, field: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = `${label} ${field.replace(/_/g, " ")}`.toLowerCase();
  if (hay.includes(q)) return true;
  let i = 0;
  for (const ch of hay) {
    if (ch === q[i]) i += 1;
    if (i >= q.length) return true;
  }
  return false;
}

interface FlatItem {
  field: ScreenerField;
  label: string;
  group: string;
}

export function MoreFiltersPicker({
  activeFields,
  onSelect,
  onClose,
}: MoreFiltersPickerProps) {
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const groups = useMemo(() => {
    return filterPickerGroups()
      .map(({ group, fields }) => ({
        group,
        fields: fields.filter((field) =>
          fuzzyMatchLabel(query, FIELD_DEFS[field].label, field),
        ),
      }))
      .filter((g) => g.fields.length > 0);
  }, [query]);

  const flat: FlatItem[] = useMemo(
    () =>
      groups.flatMap(({ group, fields }) =>
        fields.map((field) => ({
          field,
          group,
          label: FIELD_DEFS[field].label,
        })),
      ),
    [groups],
  );

  useEffect(() => {
    setHighlight(0);
  }, [query, flat.length]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-picker-index="${highlight}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [highlight]);

  function selectAt(index: number) {
    const item = flat[index];
    if (!item) return;
    onSelect(item.field);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((i) => (flat.length === 0 ? 0 : (i + 1) % flat.length));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((i) =>
        flat.length === 0 ? 0 : (i - 1 + flat.length) % flat.length,
      );
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      selectAt(highlight);
    }
  }

  return (
    <div className="flex flex-col" onKeyDown={onKeyDown}>
      <div className="border-b px-2 pb-2">
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search filters…"
          aria-label="Search filters"
          className="h-8"
          autoComplete="off"
        />
      </div>

      <div
        ref={listRef}
        className="max-h-[min(22rem,55vh)] overflow-y-auto py-1"
        role="listbox"
        aria-label="Filter fields"
      >
        {flat.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">
            No matching filters
          </p>
        ) : (
          groups.map(({ group, fields }) => (
            <div key={group} className="py-1">
              <div className="px-3 py-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                {group}
              </div>
              {fields.map((field) => {
                const index = flat.findIndex((f) => f.field === field);
                const active = activeFields.has(field);
                const focused = index === highlight;
                return (
                  <button
                    key={field}
                    type="button"
                    role="option"
                    aria-selected={focused}
                    data-picker-index={index}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm outline-none",
                      focused ? "bg-accent text-accent-foreground" : "hover:bg-muted/60",
                    )}
                    onMouseEnter={() => setHighlight(index)}
                    onClick={() => onSelect(field)}
                  >
                    <span
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center",
                        active ? "text-foreground" : "text-transparent",
                      )}
                      aria-hidden
                    >
                      <Check className="size-3.5" />
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {FIELD_DEFS[field].label}
                    </span>
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
