import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import type { ScreenerField } from "screener-contract";
import { FilterPill } from "@/components/filters/FilterPill";
import { MoreFiltersPicker } from "@/components/filters/MoreFiltersPicker";
import { AskNlPopover } from "@/components/nl/AskNlPopover";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useScreenSpec } from "@/hooks/useScreenSpec";
import {
  PRIMARY_PILL_FIELDS,
  isPrimaryPillField,
} from "@/lib/screener/filter-pills";

export function FilterPillBar() {
  const { spec, clearConditions } = useScreenSpec();
  const [pickerOpen, setPickerOpen] = useState(false);
  /** Extra fields pinned into the bar from the picker (even before a value). */
  const [pinnedExtra, setPinnedExtra] = useState<ScreenerField[]>([]);
  /** Which pill popover to open after a picker selection. */
  const [openField, setOpenField] = useState<ScreenerField | null>(null);

  const conditionFields = useMemo(
    () => new Set(spec.conditions.map((c) => c.field)),
    [spec.conditions],
  );

  // Drop pins once user clears the condition and closes any open popover.
  useEffect(() => {
    setPinnedExtra((prev) =>
      prev.filter(
        (f) => conditionFields.has(f) || openField === f,
      ),
    );
  }, [conditionFields, openField]);

  const extraFields = useMemo(() => {
    const fromConditions = spec.conditions
      .map((c) => c.field)
      .filter((f) => !isPrimaryPillField(f));
    const merged = new Set<ScreenerField>([...fromConditions, ...pinnedExtra]);
    return [...merged];
  }, [spec.conditions, pinnedExtra]);

  const activeForPicker = useMemo(() => {
    const s = new Set<ScreenerField>(conditionFields);
    for (const f of pinnedExtra) s.add(f);
    return s;
  }, [conditionFields, pinnedExtra]);

  const hasActive = spec.conditions.length > 0;

  function handlePick(field: ScreenerField) {
    if (!isPrimaryPillField(field)) {
      setPinnedExtra((prev) => (prev.includes(field) ? prev : [...prev, field]));
    }
    setPickerOpen(false);
    // Defer open until the pill is mounted in the bar.
    queueMicrotask(() => setOpenField(field));
  }

  function pillOpenProps(field: ScreenerField) {
    if (openField !== field) return {};
    return {
      open: true as const,
      onOpenChange: (next: boolean) => {
        if (!next) setOpenField(null);
      },
    };
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {PRIMARY_PILL_FIELDS.map((field) => (
          <FilterPill key={field} field={field} {...pillOpenProps(field)} />
        ))}
        {extraFields.map((field) => (
          <FilterPill key={field} field={field} {...pillOpenProps(field)} />
        ))}

        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-full px-3 text-xs"
            >
              <Plus className="size-3.5" />
              More filters
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-80 overflow-hidden p-0"
            onOpenAutoFocus={(e) => e.preventDefault()}
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <MoreFiltersPicker
              activeFields={activeForPicker}
              onSelect={handlePick}
              onClose={() => setPickerOpen(false)}
            />
          </PopoverContent>
        </Popover>

        <AskNlPopover />

        {hasActive && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs text-muted-foreground"
            onClick={clearConditions}
          >
            Clear all
          </Button>
        )}
      </div>
    </div>
  );
}
