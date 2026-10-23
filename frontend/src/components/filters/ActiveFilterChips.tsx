import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { conditionLabel } from "@/lib/screener/spec";
import { useScreenSpec } from "@/hooks/useScreenSpec";
import { cn } from "@/lib/utils";

interface ActiveFilterChipsProps {
  className?: string;
  /** Horizontally scrollable row (mobile). Default wraps. */
  scrollable?: boolean;
  /** Hide the empty-state hint (mobile chips above results). */
  hideEmptyHint?: boolean;
}

export function ActiveFilterChips({
  className,
  scrollable = false,
  hideEmptyHint = false,
}: ActiveFilterChipsProps) {
  const { spec, removeCondition } = useScreenSpec();

  if (spec.conditions.length === 0) {
    if (hideEmptyHint) return null;
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        No active filters — showing all stocks.
      </p>
    );
  }

  return (
    <div
      className={cn(
        scrollable
          ? "flex gap-2 overflow-x-auto overscroll-x-contain pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          : "flex flex-wrap gap-2",
        className,
      )}
    >
      {spec.conditions.map((cond) => (
        <Badge
          key={cond.field}
          variant="secondary"
          className={cn("gap-1 pr-1", scrollable && "shrink-0")}
        >
          {conditionLabel(cond)}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-4 rounded-full p-0 hover:bg-muted"
            aria-label={`Remove ${cond.field} filter`}
            onClick={() => removeCondition(cond.field)}
          >
            <X className="size-3" />
          </Button>
        </Badge>
      ))}
    </div>
  );
}
