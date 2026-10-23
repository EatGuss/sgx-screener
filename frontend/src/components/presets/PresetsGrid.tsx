import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { PresetsResponse } from "screener-contract";
import { InlineError } from "@/components/screener/InlineError";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useScreenSpec } from "@/hooks/useScreenSpec";
import { getScreenerApi } from "@/lib/screener/api";
import { specSummary } from "@/lib/screener/spec";

export function PresetsGrid() {
  const navigate = useNavigate();
  const { loadSpec } = useScreenSpec();
  const [presets, setPresets] = useState<PresetsResponse["presets"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const retry = useCallback(() => {
    setRetryKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getScreenerApi()
      .getPresets()
      .then((res) => {
        if (cancelled) return;
        setPresets(res.presets);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Failed to load presets";
        setError(message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [retryKey]);

  function handlePresetClick(preset: PresetsResponse["presets"][number]) {
    loadSpec(preset.spec, {
      screenName: preset.name,
      source: "preset",
      screenId: null,
      columns: preset.columns ?? null,
    });
    navigate("/screener");
  }

  if (loading) {
    return (
      <div
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
        aria-busy="true"
        aria-label="Loading presets"
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return <InlineError message={error} onRetry={retry} />;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {presets.map((preset) => (
        <button
          key={preset.id}
          type="button"
          onClick={() => handlePresetClick(preset)}
          className="text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 rounded-xl"
        >
          <Card
            size="sm"
            className="h-full transition-colors hover:bg-muted/40 cursor-pointer"
          >
            <CardHeader>
              <CardTitle>{preset.name}</CardTitle>
              <CardDescription className="line-clamp-3 leading-relaxed">
                {specSummary(preset.spec)}
              </CardDescription>
            </CardHeader>
          </Card>
        </button>
      ))}
    </div>
  );
}
