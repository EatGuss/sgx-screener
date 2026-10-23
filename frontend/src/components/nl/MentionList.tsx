import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import type { SearchResponse } from "screener-contract";
import { cn } from "@/lib/utils";

export type MentionItem = SearchResponse["results"][number];

export interface MentionListHandle {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

interface MentionListProps {
  items: MentionItem[];
  query: string;
  /** True while debounce is pending or a search request is in flight. */
  loading: boolean;
  command: (item: { id: string; label: string }) => void;
}

export const MentionList = forwardRef<MentionListHandle, MentionListProps>(
  function MentionList({ items, query, loading, command }, ref) {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const isDefaultList = query.trim() === "";
    const showEmpty = !loading && items.length === 0;

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (items.length === 0) return false;
        if (event.key === "ArrowUp") {
          setSelectedIndex((i) => (i + items.length - 1) % items.length);
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelectedIndex((i) => (i + 1) % items.length);
          return true;
        }
        if (event.key === "Enter") {
          const item = items[selectedIndex];
          if (item) {
            command({ id: item.ticker, label: item.ticker });
          }
          return true;
        }
        return false;
      },
    }));

    if (showEmpty) {
      return (
        <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs text-muted-foreground shadow-md">
          No stocks found
        </div>
      );
    }

    if (loading && items.length === 0) {
      return (
        <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs text-muted-foreground shadow-md">
          Searching…
        </div>
      );
    }

    return (
      <div
        className="max-h-64 min-w-[14rem] overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md"
        role="listbox"
        aria-busy={loading || undefined}
      >
        {loading ? (
          <p className="px-2 py-1.5 text-[11px] text-muted-foreground">
            Searching…
          </p>
        ) : isDefaultList ? (
          <p className="px-2 py-1.5 text-[11px] text-muted-foreground">
            Type to search all 57 stocks.
          </p>
        ) : null}
        <div className={cn(loading && items.length > 0 && "opacity-50")}>
          {items.map((item, index) => (
            <button
              key={item.ticker}
              type="button"
              role="option"
              aria-selected={index === selectedIndex}
              disabled={loading}
              className={cn(
                "flex w-full flex-col items-start gap-0.5 rounded-sm px-2 py-1.5 text-left text-sm outline-none",
                index === selectedIndex
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-muted",
                loading && "pointer-events-none",
              )}
              onClick={() => command({ id: item.ticker, label: item.ticker })}
            >
              <span className="font-mono text-xs font-medium tabular-nums">
                {item.ticker}
              </span>
              <span className="line-clamp-1 text-[11px] text-muted-foreground">
                {item.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  },
);
