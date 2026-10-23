import type { ReactNode } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";

interface ChartErrorBoundaryProps {
  children: ReactNode;
  /** Optional label for the fallback message. */
  fallbackLabel?: string;
  /** Reset when ticker / data identity changes so a new chart can mount. */
  resetKey?: string | number | null;
}

/** Catches chart/drawer render failures so the rest of the UI stays usable. */
export function ChartErrorBoundary({
  children,
  fallbackLabel = "Couldn't load chart",
  resetKey,
}: ChartErrorBoundaryProps) {
  return (
    <ErrorBoundary
      fallbackLabel={fallbackLabel}
      resetKey={resetKey}
      variant="inline"
      resetLabel="Try again"
      onReset={() => {
        /* ErrorBoundary clears hasError; remount attempts render again */
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
