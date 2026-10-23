import { ChevronDown, X } from "lucide-react";
import { FIELD_DEFS, type ScreenerField } from "screener-contract";
import { FilterControl } from "@/components/filters/FilterControl";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useScreenSpec } from "@/hooks/useScreenSpec";
import { pillIdleLabel } from "@/lib/screener/filter-pills";
import { conditionLabel } from "@/lib/screener/spec";
import { cn } from "@/lib/utils";

interface FilterPillProps {
  field: ScreenerField;
  /** Controlled open state — used when opened from the More filters picker. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function FilterPill({ field, open, onOpenChange }: FilterPillProps) {
  const { spec, removeCondition } = useScreenSpec();
  const condition = spec.conditions.find((c) => c.field === field);
  const active = !!condition;
  const def = FIELD_DEFS[field];
  const controlled = open !== undefined;

  return (
    <Popover
      open={controlled ? open : undefined}
      onOpenChange={onOpenChange}
    >
      <div
        className={cn(
          "inline-flex h-8 max-w-full items-center rounded-full border text-xs transition-colors",
          active
            ? "border-primary/40 bg-primary/10 text-foreground"
            : "border-border bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground",
        )}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex h-full max-w-[16rem] items-center gap-1 truncate px-2.5 outline-none",
              "focus-visible:ring-2 focus-visible:ring-ring/50 rounded-full",
              active ? "pr-1" : "pr-2",
            )}
            aria-label={
              condition
                ? `Edit ${conditionLabel(condition)}`
                : `Filter by ${def.label}`
            }
          >
            <span className="truncate">
              {condition ? conditionLabel(condition) : pillIdleLabel(field)}
            </span>
            {!condition && <ChevronDown className="size-3 shrink-0 opacity-60" />}
          </button>
        </PopoverTrigger>
        {condition && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="mr-1 size-5 rounded-full"
            aria-label={`Clear ${def.label} filter`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              removeCondition(field);
            }}
          >
            <X className="size-3" />
          </Button>
        )}
      </div>
      <PopoverContent align="start" className="w-80 p-3">
        <FilterControl def={def} />
      </PopoverContent>
    </Popover>
  );
}
