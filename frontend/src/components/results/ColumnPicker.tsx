import { useEffect, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import { FIELD_DEFS, type ScreenerField } from "screener-contract";
import { Input } from "@/components/ui/input";
import { fuzzyMatchLabel } from "@/components/filters/MoreFiltersPicker";
import { columnPickerGroups } from "@/lib/screener/column-presets";
import { cn } from "@/lib/utils";

interface ColumnPickerProps {
  selected: ScreenerField[];
  onToggle: (field: ScreenerField) => void;
  onClose: () => void;
}

interface FlatItem {
  field: ScreenerField;
  label: string;
  group: string;
}

/**
 * Command-palette column picker (same UX as "+ More filters").
 * Ticker + name stay pinned outside this list.
 */
export function ColumnPicker({ selected, onToggle, onClose }: ColumnPickerProps) {
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const groups = useMemo(() => {
    return columnPickerGroups()
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
    onToggle(item.field);
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
          placeholder="Search columns…"
          aria-label="Search columns"
          className="h-8"
          autoComplete="off"
        />
      </div>

      <div
        ref={listRef}
        className="max-h-[min(22rem,55vh)] overflow-y-auto py-1"
        role="listbox"
        aria-label="Column fields"
      >
        {flat.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">
            No matching columns
          </p>
        ) : (
          groups.map(({ group, fields }) => (
            <div key={group} className="py-1">
              <div className="px-3 py-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                {group}
              </div>
              {fields.map((field) => {
                const index = flat.findIndex((f) => f.field === field);
                const active = selectedSet.has(field);
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
                    onClick={() => onToggle(field)}
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
