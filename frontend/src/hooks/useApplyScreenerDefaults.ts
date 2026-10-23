import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useScreenSpec } from "@/hooks/useScreenSpec";
import { getScreenerApi } from "@/lib/screener/api";
import { loadScreenerSettings } from "@/lib/screener/settings";

/**
 * On builder open: if there is no share `?spec=`, apply the user's default
 * screen preference once (empty / preset / saved). URL shares always win.
 */
export function useApplyScreenerDefaults(): void {
  const [searchParams] = useSearchParams();
  const { loadSpec, source, spec } = useScreenSpec();
  const applied = useRef(false);

  useEffect(() => {
    if (applied.current) return;
    if (searchParams.get("spec")?.trim()) {
      applied.current = true;
      return;
    }
    // Don't clobber an in-progress untitled edit from a prior navigation.
    if (source !== "untitled" || spec.conditions.length > 0) {
      applied.current = true;
      return;
    }

    applied.current = true;
    const settings = loadScreenerSettings();
    const pref = settings.defaultScreen;

    if (pref.type === "none") return;

    let cancelled = false;

    void (async () => {
      try {
        if (pref.type === "preset") {
          const res = await getScreenerApi().getPresets();
          if (cancelled) return;
          const preset = res.presets.find((p) => p.id === pref.presetId);
          if (!preset) return;
          loadSpec(
            { ...preset.spec, pageSize: settings.pageSize },
            {
              source: "preset",
              screenName: preset.name,
              screenId: null,
              columns: preset.columns ?? null,
            },
          );
          return;
        }

        if (pref.type === "saved") {
          const res = await getScreenerApi().listScreens();
          if (cancelled) return;
          const screen = res.screens.find((s) => s.id === pref.screenId);
          if (!screen) return;
          loadSpec(
            { ...screen.spec, pageSize: settings.pageSize },
            {
              source: "saved",
              screenId: screen.id,
              screenName: screen.name,
              columns: screen.columns ?? null,
            },
          );
        }
      } catch (err) {
        console.error("[screener] failed to apply default screen:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, loadSpec, source, spec.conditions.length]);
}
