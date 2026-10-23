import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { UNTITLED_SCREEN_NAME, useScreenSpec } from "@/hooks/useScreenSpec";
import {
  decodeScreenSpecParam,
  encodeScreenSpecParam,
} from "@/lib/screener/url-spec";
import { useSearchParams } from "react-router-dom";

const INVALID_SPEC_TOAST = "Couldn't load shared screen";

/**
 * Hydrate the builder from `?spec=` on first load, and keep the query string
 * in sync so any screen is shareable.
 *
 * `?spec=` is untrusted: Zod-validate via decodeScreenSpecParam; on failure
 * (bad base64 / JSON, or Zod reject) keep the default empty screen and show a
 * non-blocking notice. The toast is deferred so `<Toaster />` is mounted, and
 * the timer is not cleared on effect cleanup (StrictMode / URL rewrite must
 * not cancel it — same idea as fetchCompanyFacets).
 */
export function useScreenUrlSync(): void {
  const [searchParams, setSearchParams] = useSearchParams();
  const { spec, screenName, loadSpec } = useScreenSpec();
  const hydrated = useRef(false);
  const skipNextWrite = useRef(false);
  /**
   * Encoded `?spec=` value we already toasted for. Set inside the deferred
   * callback so StrictMode's first-pass cleanup cannot swallow the notice.
   */
  const invalidSpecNotified = useRef<string | null>(null);

  // Hydrate once from URL.
  useEffect(() => {
    const encoded = searchParams.get("spec");

    // No share param — mark hydrated so the write effect can sync.
    if (!encoded?.trim()) {
      hydrated.current = true;
      return;
    }

    // decodeScreenSpecParam returns null for both failure modes:
    // malformed/truncated base64 and Zod validation rejects.
    const decoded = decodeScreenSpecParam(encoded);
    if (!decoded) {
      hydrated.current = true;
      // Defer so sonner's <Toaster /> (sibling under App) is subscribed.
      // Do NOT clearTimeout on effect cleanup — StrictMode remount + the
      // write-effect replacing ?spec= would cancel the only toast otherwise.
      window.setTimeout(() => {
        if (invalidSpecNotified.current === encoded) return;
        invalidSpecNotified.current = encoded;
        toast.message(INVALID_SPEC_TOAST);
      }, 0);
      return;
    }

    if (hydrated.current) return;
    hydrated.current = true;

    const name = searchParams.get("name")?.trim() || undefined;
    skipNextWrite.current = true;
    loadSpec(decoded, {
      screenName: name,
      source: "url",
      screenId: null,
    });
  }, [searchParams, loadSpec]);

  // Push spec (+ optional name) into the URL.
  useEffect(() => {
    if (skipNextWrite.current) {
      skipNextWrite.current = false;
      return;
    }
    if (!hydrated.current) return;

    const next = new URLSearchParams(searchParams);
    next.set("spec", encodeScreenSpecParam(spec));
    if (screenName && screenName !== UNTITLED_SCREEN_NAME) {
      next.set("name", screenName);
    } else {
      next.delete("name");
    }

    const curSpec = searchParams.get("spec");
    const curName = searchParams.get("name");
    if (curSpec === next.get("spec") && curName === next.get("name")) {
      return;
    }

    setSearchParams(next, { replace: true });
  }, [spec, screenName, searchParams, setSearchParams]);
}
