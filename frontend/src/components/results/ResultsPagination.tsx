import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ResultsPaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

export function ResultsPagination({
  page,
  pageSize,
  total,
  onPageChange,
  disabled,
}: ResultsPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
      <p className="tabular-nums">
        {total === 0
          ? "No results"
          : `Showing ${from}–${to} of ${total}`}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" />
          Prev
        </Button>
        <span className="tabular-nums min-w-[5.5rem] text-center">
          Page {page} / {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          Next
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
