import { FIELD_DEFS } from "screener-contract";
import { ChevronDown } from "lucide-react";
import { FilterControl } from "./FilterControl";
import { HIDDEN_FILTER_FIELDS } from "@/lib/screener/filter-controls";
import { cn } from "@/lib/utils";

const GROUP_ORDER = [
  "Identity",
  "Valuation",
  "Profitability",
  "Growth",
  "Financial Health",
  "Dividends",
  "Price & Technicals",
  "Volume & Momentum",
] as const;

const groupedFields = GROUP_ORDER.map((group) => ({
  group,
  fields: Object.values(FIELD_DEFS).filter(
    (def) => def.group === group && !HIDDEN_FILTER_FIELDS.has(def.field),
  ),
})).filter((g) => g.fields.length > 0);

export function FilterSidebar() {
  return (
    <div className="space-y-1">
      {/*
        board is hidden: the seeded universe is uniformly Mainboard (unverified in
        Yahoo ingest) so a board filter cannot discriminate between listings today.
      */}
      {groupedFields.map(({ group, fields }, index) => (
        <details
          key={group}
          className="group border-b border-border/60 pb-1"
          open={index === 0}
        >
          <summary
            className={cn(
              "flex cursor-pointer list-none items-center justify-between py-2 text-sm font-medium",
              "[&::-webkit-details-marker]:hidden",
            )}
          >
            {group}
            <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-4 pb-3 pt-1">
            {fields.map((def) => (
              <FilterControl key={def.field} def={def} />
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
