import { useCallback, useEffect, useState } from "react";
import type { ScreenSpec } from "screener-contract";
import { getScreenerApi, screenerRequestErrorMessage } from "@/lib/screener/api";

interface LiveCountState {
  count: number | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

const INITIAL = {
  count: null as number | null,
  loading: false,
  error: null as string | null,
};

/** Debounced POST /api/screen/count — cancels stale in-flight requests. */
export function useDebouncedScreenCount(
  spec: ScreenSpec,
  debounceMs = 300,
): LiveCountState {
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
        .count(spec, controller.signal)
        .then((res) => {
          if (!cancelled) {
            setState({ count: res.count, loading: false, error: null });
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
            "Count request failed",
          );
          setState((prev) => ({
            count: prev.count,
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
