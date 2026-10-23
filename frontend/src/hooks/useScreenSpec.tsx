import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { FilterCondition, ScreenSpec, ScreenerField } from "screener-contract";
import { isColumnableField } from "@/lib/screener/column-presets";
import { DEFAULT_SCREEN_SPEC } from "@/lib/screener/spec";
import { loadScreenerSettings } from "@/lib/screener/settings";
import { screenIdentityKey } from "@/lib/screener/url-spec";

export const UNTITLED_SCREEN_NAME = "Untitled screen";

export type ScreenSource = "untitled" | "preset" | "saved" | "url" | "nl";

export interface ScreenMeta {
  /** Persisted DB id when this is a saved screen. */
  screenId: number | null;
  /** Display name in the builder header. */
  screenName: string;
  source: ScreenSource;
}

interface LoadSpecOptions {
  /**
   * Client-only: hide this ticker from results (e.g. source of "Find similar").
   * Not part of ScreenSpec / the API — cleared when filters change.
   */
  excludeTicker?: string | null;
  screenId?: number | null;
  screenName?: string;
  source?: ScreenSource;
  /** Restore custom results columns (from a saved screen / preset). */
  columns?: ScreenerField[] | null;
}

interface ScreenSpecContextValue {
  spec: ScreenSpec;
  /** Ticker to omit from the results table after "Find similar". */
  excludeTicker: string | null;
  /** User-defined Custom tab columns (ticker + name stay pinned in the UI). */
  customColumns: ScreenerField[];
  screenId: number | null;
  screenName: string;
  source: ScreenSource;
  /** True when filters/sort or custom columns differ from the last loaded baseline. */
  isDirty: boolean;
  setSpec: (spec: ScreenSpec) => void;
  loadSpec: (spec: ScreenSpec, options?: LoadSpecOptions) => void;
  /** Reset to empty untitled screen. */
  createNewScreen: () => void;
  /** Update display name without marking dirty relative to baseline... */
  setScreenName: (name: string) => void;
  /** After save: attach id and reset dirty baseline. */
  markSaved: (screen: {
    id: number;
    name: string;
    spec: ScreenSpec;
    columns?: ScreenerField[];
  }) => void;
  /** Duplicate locally: clears id, appends (copy), keeps filters + columns. */
  makeLocalCopy: () => void;
  setCustomColumns: (columns: ScreenerField[]) => void;
  toggleCustomColumn: (field: ScreenerField) => void;
  removeCustomColumn: (field: ScreenerField) => void;
  moveCustomColumn: (field: ScreenerField, direction: "left" | "right") => void;
  clearConditions: () => void;
  upsertCondition: (condition: FilterCondition) => void;
  removeCondition: (field: ScreenerField) => void;
  setSort: (field: ScreenerField) => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
}

const ScreenSpecContext = createContext<ScreenSpecContextValue | null>(null);

function emptySpecFromSettings(): ScreenSpec {
  const { pageSize } = loadScreenerSettings();
  return { ...DEFAULT_SCREEN_SPEC, pageSize };
}

function withDefaults(next: ScreenSpec): ScreenSpec {
  const preferredPageSize = loadScreenerSettings().pageSize;
  return {
    ...DEFAULT_SCREEN_SPEC,
    ...next,
    page: next.page ?? 1,
    pageSize: next.pageSize ?? preferredPageSize,
  };
}

function columnsKey(columns: ScreenerField[]): string {
  return columns.join(",");
}

function normalizeColumns(columns?: ScreenerField[] | null): ScreenerField[] {
  if (!columns?.length) return [];
  const seen = new Set<ScreenerField>();
  const out: ScreenerField[] = [];
  for (const field of columns) {
    if (!isColumnableField(field) || seen.has(field)) continue;
    seen.add(field);
    out.push(field);
  }
  return out;
}

function identitySnapshot(
  spec: ScreenSpec,
  columns: ScreenerField[],
): string {
  return `${screenIdentityKey(spec)}|cols:${columnsKey(columns)}`;
}

export function ScreenSpecProvider({
  children,
  initialSpec,
}: {
  children: ReactNode;
  initialSpec?: ScreenSpec;
}) {
  const [spec, setSpecState] = useState<ScreenSpec>(
    () => initialSpec ?? emptySpecFromSettings(),
  );
  const [excludeTicker, setExcludeTicker] = useState<string | null>(null);
  const [customColumns, setCustomColumnsState] = useState<ScreenerField[]>([]);
  const [screenId, setScreenId] = useState<number | null>(null);
  const [screenName, setScreenNameState] = useState(UNTITLED_SCREEN_NAME);
  const [source, setSource] = useState<ScreenSource>("untitled");
  const [baselineKey, setBaselineKey] = useState(() =>
    identitySnapshot(initialSpec ?? emptySpecFromSettings(), []),
  );

  const isDirty = identitySnapshot(spec, customColumns) !== baselineKey;

  const setSpec = useCallback((next: ScreenSpec) => {
    setExcludeTicker(null);
    setSpecState(withDefaults(next));
  }, []);

  const loadSpec = useCallback((next: ScreenSpec, options?: LoadSpecOptions) => {
    const merged = withDefaults({ ...next, page: 1 });
    const cols = normalizeColumns(options?.columns);
    setExcludeTicker(options?.excludeTicker ?? null);
    setSpecState(merged);
    setCustomColumnsState(cols);
    setBaselineKey(identitySnapshot(merged, cols));
    setScreenId(options?.screenId ?? null);
    setScreenNameState(options?.screenName?.trim() || UNTITLED_SCREEN_NAME);
    setSource(options?.source ?? (options?.screenId ? "saved" : "untitled"));
  }, []);

  const createNewScreen = useCallback(() => {
    const fresh = emptySpecFromSettings();
    setExcludeTicker(null);
    setSpecState(fresh);
    setCustomColumnsState([]);
    setBaselineKey(identitySnapshot(fresh, []));
    setScreenId(null);
    setScreenNameState(UNTITLED_SCREEN_NAME);
    setSource("untitled");
  }, []);

  const setScreenName = useCallback((name: string) => {
    setScreenNameState(name.trim() || UNTITLED_SCREEN_NAME);
  }, []);

  const markSaved = useCallback(
    (screen: {
      id: number;
      name: string;
      spec: ScreenSpec;
      columns?: ScreenerField[];
    }) => {
      const merged = withDefaults(screen.spec);
      const cols = normalizeColumns(screen.columns);
      setExcludeTicker(null);
      setSpecState(merged);
      setCustomColumnsState(cols);
      setBaselineKey(identitySnapshot(merged, cols));
      setScreenId(screen.id);
      setScreenNameState(screen.name);
      setSource("saved");
    },
    [],
  );

  const makeLocalCopy = useCallback(() => {
    setScreenId(null);
    setSource("untitled");
    setScreenNameState((prev) => {
      const base = prev.replace(/\s*\(copy\)\s*$/i, "").trim() || UNTITLED_SCREEN_NAME;
      return `${base} (copy)`;
    });
    setBaselineKey(""); // force dirty so Save prompts
  }, []);

  const setCustomColumns = useCallback((columns: ScreenerField[]) => {
    setCustomColumnsState(normalizeColumns(columns));
  }, []);

  const toggleCustomColumn = useCallback((field: ScreenerField) => {
    setCustomColumnsState((prev) => {
      if (prev.includes(field)) return prev.filter((f) => f !== field);
      return [...prev, field];
    });
  }, []);

  const removeCustomColumn = useCallback((field: ScreenerField) => {
    setCustomColumnsState((prev) => prev.filter((f) => f !== field));
  }, []);

  const moveCustomColumn = useCallback(
    (field: ScreenerField, direction: "left" | "right") => {
      setCustomColumnsState((prev) => {
        const index = prev.indexOf(field);
        if (index < 0) return prev;
        const swapWith = direction === "left" ? index - 1 : index + 1;
        if (swapWith < 0 || swapWith >= prev.length) return prev;
        const next = [...prev];
        const tmp = next[index]!;
        next[index] = next[swapWith]!;
        next[swapWith] = tmp;
        return next;
      });
    },
    [],
  );

  const clearConditions = useCallback(() => {
    setExcludeTicker(null);
    setSpecState((prev) => ({ ...prev, conditions: [], page: 1 }));
  }, []);

  const upsertCondition = useCallback((condition: FilterCondition) => {
    setExcludeTicker(null);
    setSpecState((prev) => ({
      ...prev,
      conditions: [
        ...prev.conditions.filter((c) => c.field !== condition.field),
        condition,
      ],
      page: 1,
    }));
  }, []);

  const removeCondition = useCallback((field: ScreenerField) => {
    setExcludeTicker(null);
    setSpecState((prev) => ({
      ...prev,
      conditions: prev.conditions.filter((c) => c.field !== field),
      page: 1,
    }));
  }, []);

  const setSort = useCallback((field: ScreenerField) => {
    setSpecState((prev) => {
      const same = prev.sort?.field === field;
      const direction =
        same && prev.sort?.direction === "desc" ? "asc" : "desc";
      return {
        ...prev,
        sort: { field, direction },
        page: 1,
      };
    });
  }, []);

  const setPage = useCallback((page: number) => {
    setSpecState((prev) => ({
      ...prev,
      page: Math.max(1, page),
    }));
  }, []);

  const setPageSize = useCallback((pageSize: number) => {
    const size = Math.max(1, Math.trunc(pageSize));
    setSpecState((prev) => {
      if (prev.pageSize === size) return prev;
      return { ...prev, pageSize: size, page: 1 };
    });
  }, []);

  const value = useMemo(
    () => ({
      spec,
      excludeTicker,
      customColumns,
      screenId,
      screenName,
      source,
      isDirty,
      setSpec,
      loadSpec,
      createNewScreen,
      setScreenName,
      markSaved,
      makeLocalCopy,
      setCustomColumns,
      toggleCustomColumn,
      removeCustomColumn,
      moveCustomColumn,
      clearConditions,
      upsertCondition,
      removeCondition,
      setSort,
      setPage,
      setPageSize,
    }),
    [
      spec,
      excludeTicker,
      customColumns,
      screenId,
      screenName,
      source,
      isDirty,
      setSpec,
      loadSpec,
      createNewScreen,
      setScreenName,
      markSaved,
      makeLocalCopy,
      setCustomColumns,
      toggleCustomColumn,
      removeCustomColumn,
      moveCustomColumn,
      clearConditions,
      upsertCondition,
      removeCondition,
      setSort,
      setPage,
      setPageSize,
    ],
  );

  return (
    <ScreenSpecContext.Provider value={value}>{children}</ScreenSpecContext.Provider>
  );
}

export function useScreenSpec(): ScreenSpecContextValue {
  const ctx = useContext(ScreenSpecContext);
  if (!ctx) {
    throw new Error("useScreenSpec must be used within ScreenSpecProvider");
  }
  return ctx;
}
