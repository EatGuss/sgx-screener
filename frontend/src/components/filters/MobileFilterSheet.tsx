import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { FilterSidebar } from "@/components/filters/FilterSidebar";
import { AskNlPopover } from "@/components/nl/AskNlPopover";
import { LiveCountBadge } from "@/components/screener/LiveCountBadge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useScreenSpec } from "@/hooks/useScreenSpec";

interface MobileFilterSheetProps {
  count: number | null;
  countLoading: boolean;
  countError: string | null;
}

/**
 * Mobile-only filter entry: sticky Filters (N) opens a bottom sheet with all
 * FIELD_GROUPS controls. Desktop keeps FilterPillBar unchanged.
 */
export function MobileFilterSheet({
  count,
  countLoading,
  countError,
}: MobileFilterSheetProps) {
  const { spec, clearConditions } = useScreenSpec();
  const [open, setOpen] = useState(false);
  const activeCount = spec.conditions.length;

  return (
    <>
      <div className="sticky top-0 z-20 -mx-4 border-b bg-background/95 px-4 py-2 backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-2"
              onClick={() => setOpen(true)}
            >
              <SlidersHorizontal className="size-3.5" aria-hidden />
              Filters ({activeCount})
            </Button>
            <AskNlPopover />
          </div>
          <LiveCountBadge
            count={count}
            loading={countLoading}
            error={countError}
            className="shrink-0"
          />
        </div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden rounded-t-xl p-0"
        >
          <SheetHeader className="shrink-0 space-y-2 border-b px-4 py-3 text-left">
            <SheetTitle>Filters</SheetTitle>
            <LiveCountBadge
              count={count}
              loading={countLoading}
              error={countError}
            />
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
            <FilterSidebar />
          </div>

          <SheetFooter className="shrink-0 flex-row gap-2 border-t px-4 py-3 sm:flex-row">
            {activeCount > 0 && (
              <Button
                type="button"
                variant="ghost"
                className="shrink-0"
                onClick={clearConditions}
              >
                Clear all
              </Button>
            )}
            <Button
              type="button"
              className="flex-1"
              onClick={() => setOpen(false)}
            >
              Apply
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
