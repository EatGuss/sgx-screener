import { useCallback, useEffect, useState } from "react";
import type { ResultsResponse, ScreenSpec } from "screener-contract";
import { getScreenerApi, screenerRequestErrorMessage } from "@/lib/screener/api";

interface ScreenResultsState {
  data: ResultsResponse | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

const INITIAL = {
  data: null as ResultsResponse | null,
  loading: false,
  error: null as string | null,
};

/**
 * Debounced POST /api/screen/results.
 *
 * On failure, previous successful data is kept and `error` stays set until a
 * later request succeeds — so a dead backend cannot look healthy.
 */
export function useDebouncedScreenResults(
  spec: ScreenSpec,
  debounceMs = 500,
): ScreenResultsState {
  const [state, setState] = useState(INITIAL);
  const [retryKey, setRetryKey] = useState(0);

  const retry = useCallback(() => {
    setRetryKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    // Keep any prior error visible while retrying — only clear on success.
    setState((prev) => ({ ...prev, loading: true }));

    const timer = window.setTimeout(() => {
      getScreenerApi()
        .results(spec, controller.signal)
        .then((res) => {
          if (!cancelled) {
            setState({ data: res, loading: false, error: null });
          }
        })
        .catch((err: unknown) => {
          if (
            cancelled ||
            (err instanceof DOMException && err.name === "AbortError")
          ) {
            return;
          }
          const message = screenerRequestErrorMessage(
            err,
            "Results request failed",
          );
          setState((prev) => ({
            data: prev.data,
            loading: false,
            error: message,
          }));
        });
    }, debounceMs);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [spec, debounceMs, retryKey]);

  return { ...state, retry };
}
