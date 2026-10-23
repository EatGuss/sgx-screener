import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { SavedScreen } from "screener-contract";
import { InlineError } from "@/components/screener/InlineError";
import { ClampedScreenSummary } from "@/components/screener/ClampedScreenSummary";
import {
  Card,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useScreenSpec } from "@/hooks/useScreenSpec";
import { getScreenerApi } from "@/lib/screener/api";
import { specSummary } from "@/lib/screener/spec";

/**
 * Grid of the signed-in user's saved screens for Screener Home.
 * Renders nothing when logged out (caller should omit the section).
 */
export function SavedScreensGrid() {
  const navigate = useNavigate();
  const { signedIn, loading: authLoading } = useAuth();
  const { loadSpec } = useScreenSpec();
  const [screens, setScreens] = useState<SavedScreen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const retry = useCallback(() => {
    setRetryKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!signedIn) {
      setScreens([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    getScreenerApi()
      .listScreens()
      .then((res) => {
        if (cancelled) return;
        setScreens(res.screens);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Failed to load saved screens";
        setError(message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [signedIn, authLoading, retryKey]);

  function handleClick(screen: SavedScreen) {
    loadSpec(screen.spec, {
      screenId: screen.id,
      screenName: screen.name,
      source: "saved",
      columns: screen.columns ?? null,
    });
    navigate("/screener");
  }

  if (!signedIn && !authLoading) {
    return null;
  }

  if (loading || authLoading) {
    return (
      <div
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
        aria-busy="true"
        aria-label="Loading saved screens"
      >
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return <InlineError message={error} onRetry={retry} />;
  }

  if (screens.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No saved screens yet.{" "}
        <Link
          to="/screener"
          className="underline underline-offset-2 hover:text-foreground"
        >
          Open the builder
        </Link>{" "}
        and save one from the name menu.
      </p>
    );
  }

  return (
    <div className="grid auto-rows-fr gap-4 md:grid-cols-2 lg:grid-cols-3">
      {screens.map((screen) => {
        const summary =
          screen.description?.trim() || specSummary(screen.spec);
        return (
          // div+role=button avoids nesting TooltipTrigger inside <button>, which
          // prevents hover tooltips from opening in Radix.
          <div
            key={screen.id}
            role="button"
            tabIndex={0}
            onClick={() => handleClick(screen)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleClick(screen);
              }
            }}
            className="flex h-full min-h-0 cursor-pointer rounded-xl text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Card
              size="sm"
              className="flex h-full w-full flex-col transition-colors hover:bg-muted/40"
            >
              <CardHeader className="flex flex-1 flex-col gap-1.5">
                <CardTitle className="line-clamp-2">{screen.name}</CardTitle>
                <ClampedScreenSummary text={summary} className="text-sm" />
              </CardHeader>
            </Card>
          </div>
        );
      })}
    </div>
  );
}
