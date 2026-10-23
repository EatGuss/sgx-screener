import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackLabel?: string;
  /** Changing this value clears the error so the children can render again. */
  resetKey?: string | number | null;
  /** Called when the reset button is pressed; defaults to a full reload. */
  onReset?: () => void;
  resetLabel?: string;
  variant?: "inline" | "page";
}

interface ErrorBoundaryState {
  error: Error | null;
}

/** Render-time error fallback. Effects and event handlers need their own try/catch. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  componentDidUpdate(prev: ErrorBoundaryProps): void {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  private handleReset = (): void => {
    if (this.props.onReset) {
      this.props.onReset();
      this.setState({ error: null });
    } else {
      window.location.reload();
    }
  };

  render(): ReactNode {
    if (!this.state.error) return this.props.children;

    const {
      fallbackLabel = "Something went wrong.",
      resetLabel = "Try again",
      variant = "page",
    } = this.props;

    return (
      <div
        role="alert"
        className={
          variant === "page"
            ? "flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center"
            : "flex flex-col items-center justify-center gap-3 rounded-md border border-dashed p-6 text-center"
        }
      >
        <p className="text-sm text-muted-foreground">{fallbackLabel}</p>
        <Button type="button" variant="outline" size="sm" onClick={this.handleReset}>
          {resetLabel}
        </Button>
      </div>
    );
  }
}
