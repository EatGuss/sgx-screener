import type { ScreenerField, StockRow } from "screener-contract";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { SparklineCell } from "@/components/results/SparklineCell";
import { MetricValue } from "@/components/results/MetricValue";
import {
  columnLabel,
  getRowMetric,
  type ColumnPreset,
} from "@/lib/screener/column-presets";
import { cn } from "@/lib/utils";

type SortDirection = "asc" | "desc";

interface SortState {
  field: ScreenerField;
  direction: SortDirection;
}

export interface CustomColumnActions {
  onRemove: (field: ScreenerField) => void;
  onMove: (field: ScreenerField, direction: "left" | "right") => void;
}

interface ResultsTableProps {
  rows: StockRow[];
  loading?: boolean;
  /** When true, empty-state is suppressed (parent shows the error UI). */
  hasError?: boolean;
  sort?: SortState;
  onSort?: (field: ScreenerField) => void;
  /** Visible metric columns for the active column preset / custom set. */
  columns: ColumnPreset["fields"];
  onRowClick?: (row: StockRow) => void;
  onClearFilters?: () => void;
  /** Narrow sticky pin widths + optional sparkline hide for ~375px. */
  compact?: boolean;
  /** Hide the 30D sparkline column (mobile overview). */
  hideSparkline?: boolean;
  /** When set, each metric header gets reorder / remove controls. */
  customColumnActions?: CustomColumnActions;
}

function SortIcon({
  active,
  direction,
}: {
  active: boolean;
  direction?: SortDirection;
}) {
  if (!active) {
    return <ArrowUpDown className="size-3 opacity-40" aria-hidden />;
  }
  return direction === "asc" ? (
    <ArrowUp className="size-3" aria-hidden />
  ) : (
    <ArrowDown className="size-3" aria-hidden />
  );
}

function SortableHead({
  field,
  label,
  sort,
  onSort,
  columnIndex,
  columnCount,
  customColumnActions,
}: {
  field: ScreenerField;
  label: string;
  sort?: SortState;
  onSort?: (field: ScreenerField) => void;
  columnIndex: number;
  columnCount: number;
  customColumnActions?: CustomColumnActions;
}) {
  const active = sort?.field === field;
  const canMoveLeft = columnIndex > 0;
  const canMoveRight = columnIndex < columnCount - 1;

  return (
    <TableHead
      className={cn("text-right", onSort && "cursor-pointer select-none")}
      aria-sort={
        active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"
      }
      onClick={onSort ? () => onSort(field) : undefined}
    >
      <span className="inline-flex w-full items-center justify-end gap-0.5">
        {customColumnActions ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6 shrink-0 opacity-60 hover:opacity-100"
                aria-label={`${label} column options`}
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenuItem
                disabled={!canMoveLeft}
                onSelect={() => customColumnActions.onMove(field, "left")}
              >
                <ChevronLeft className="size-3.5" />
                Move left
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!canMoveRight}
                onSelect={() => customColumnActions.onMove(field, "right")}
              >
                <ChevronRight className="size-3.5" />
                Move right
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => customColumnActions.onRemove(field)}
              >
                <Trash2 className="size-3.5" />
                Remove column
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        {label}
        {onSort && <SortIcon active={!!active} direction={sort?.direction} />}
      </span>
    </TableHead>
  );
}

function metricCellClass(field: ScreenerField, value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "text-right tabular-nums";
  if (
    field.startsWith("perf_") ||
    field.startsWith("pct_") ||
    field.startsWith("price_vs_")
  ) {
    return cn(
      "text-right tabular-nums",
      value >= 0 ? "text-up" : "text-down",
    );
  }
  return "text-right tabular-nums";
}

/**
 * Opaque sticky cells that share the row hover tint instantly.
 * `transition-none` is required — TableRow's default transition-colors makes
 * scrolling cells lag behind pinned cells at the seam.
 */
const stickyPinBase = "sticky z-20 transition-none";
/** Header pinned cells stay opaque over scrolled content. */
const stickyPinHeader = cn(stickyPinBase, "bg-background");
/**
 * Body pinned cells mirror the row's hover background so the highlight spans
 * the full row (not only the scrolling columns).
 */
const stickyPinBody = cn(stickyPinBase, "bg-background group-hover:bg-muted");
/** Right edge of the pinned block — subtle divider, not a background split. */
const stickyPinEdge =
  "after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-border";

export function ResultsTable({
  rows,
  loading,
  hasError,
  sort,
  onSort,
  columns,
  onRowClick,
  onClearFilters,
  compact = false,
  hideSparkline = false,
  customColumnActions,
}: ResultsTableProps) {
  if (loading && rows.length === 0) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Loading results">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  // Failed request is handled by the parent — never pretend it is "no matches".
  if (hasError && rows.length === 0) {
    return null;
  }

  if (!loading && !hasError && rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <p className="text-sm text-muted-foreground">
          No stocks match these filters
        </p>
        {onClearFilters && (
          <Button type="button" variant="outline" size="sm" onClick={onClearFilters}>
            Clear all filters
          </Button>
        )}
      </div>
    );
  }

  const tickerW = compact ? "min-w-[4.5rem] left-0" : "min-w-[7rem] left-0";
  const nameLeft = compact ? "left-[4.5rem]" : "left-[7rem]";
  const nameW = compact
    ? "min-w-[7rem] max-w-[7rem]"
    : "min-w-[12rem] max-w-[12rem]";

  return (
    <div className="relative" aria-busy={loading || undefined}>
      {loading && rows.length > 0 && (
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span
            className="inline-block size-3 shrink-0 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground"
            aria-hidden
          />
          Updating results…
        </div>
      )}
      <div
        className={cn(
          loading &&
            rows.length > 0 &&
            "pointer-events-none opacity-60 transition-opacity",
        )}
      >
        <Table
          containerClassName={cn(
            "overflow-x-auto overflow-y-hidden overscroll-x-contain",
            compact
              ? "touch-pan-x [-webkit-overflow-scrolling:touch]"
              : // Desktop: no scrollbar chrome unless content truly overflows horizontally.
                "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          )}
        >
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={cn(stickyPinHeader, tickerW)}>
                Ticker
              </TableHead>
              <TableHead
                className={cn(stickyPinHeader, stickyPinEdge, nameLeft, nameW)}
              >
                Name
              </TableHead>
              {columns.map((field, index) => (
                <SortableHead
                  key={field}
                  field={field}
                  label={columnLabel(field)}
                  sort={sort}
                  onSort={onSort}
                  columnIndex={index}
                  columnCount={columns.length}
                  customColumnActions={customColumnActions}
                />
              ))}
              {!hideSparkline && (
                <TableHead className="text-right w-[5.5rem]">30D</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.ticker}
                className={cn(
                  // Kill TableRow's transition-colors so pinned + scrolling
                  // cells light/unlight together with no lag at the seam.
                  "group transition-none [&>td]:transition-none hover:bg-muted",
                  onRowClick && "cursor-pointer",
                )}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                <TableCell
                  className={cn(
                    stickyPinBody,
                    tickerW,
                    "font-medium tabular-nums",
                  )}
                >
                  {row.ticker}
                </TableCell>
                <TableCell
                  className={cn(
                    stickyPinBody,
                    stickyPinEdge,
                    nameLeft,
                    nameW,
                    "truncate",
                  )}
                >
                  {row.name}
                </TableCell>
                {columns.map((field) => {
                  const value = getRowMetric(row, field);
                  return (
                    <TableCell key={field} className={metricCellClass(field, value)}>
                      <MetricValue field={field} value={value} />
                    </TableCell>
                  );
                })}
                {!hideSparkline && (
                  <TableCell className="text-right">
                    <SparklineCell values={row.sparkline} perf1y={row.perf1y} />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
