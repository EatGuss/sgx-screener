import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CompanyFacets } from "@/lib/screener/facets";
import { fetchCompanyFacets } from "@/lib/screener/facets";

interface EnumFacetsContextValue {
  facets: CompanyFacets;
  loading: boolean;
  error: string | null;
}

const EMPTY_FACETS: CompanyFacets = { sectors: [], industries: [] };

const EnumFacetsContext = createContext<EnumFacetsContextValue>({
  facets: EMPTY_FACETS,
  loading: true,
  error: null,
});

function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === "AbortError") ||
    (err instanceof Error && /aborted/i.test(err.message))
  );
}

export function EnumFacetsProvider({ children }: { children: ReactNode }) {
  const [facets, setFacets] = useState<CompanyFacets>(EMPTY_FACETS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load(attempt = 0): Promise<void> {
      setLoading(true);
      try {
        const loaded = await fetchCompanyFacets();
        if (cancelled) return;
        setFacets(loaded);
        setError(null);
      } catch (err: unknown) {
        if (cancelled) return;
        // Retry once — covers a race where an aborted in-flight promise
        // was shared before the no-signal fix, or a transient network blip.
        if (attempt < 1) {
          await load(attempt + 1);
          return;
        }
        if (isAbortError(err)) {
          setError("Failed to load facet options");
        } else {
          const message =
            err instanceof Error ? err.message : "Failed to load facet options";
          setError(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    // Do not abort the network request on cleanup — StrictMode remounts
    // would cancel a still-valid fetch. Only ignore stale setState.
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({ facets, loading, error }),
    [facets, loading, error],
  );

  return (
    <EnumFacetsContext.Provider value={value}>{children}</EnumFacetsContext.Provider>
  );
}

export function useEnumFacets(): EnumFacetsContextValue {
  return useContext(EnumFacetsContext);
}
