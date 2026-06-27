"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional custom fallback. If omitted, the default themed fallback is shown. */
  fallback?: ReactNode;
  /** Optional label describing the section, used in the default message. */
  sectionName?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * React error boundary. Catches render-time errors in its subtree (for example
 * an "Invalid time value" thrown deep in a date format call) and shows a
 * graceful, themed fallback instead of unmounting the whole page.
 *
 * Error boundaries must be class components — there is no hook equivalent.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log for debugging; in production this could report to a monitoring service.
    if (typeof console !== "undefined") {
      console.error("ErrorBoundary caught an error:", error, errorInfo);
    }
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    const { sectionName } = this.props;
    const message = sectionName
      ? `Something went wrong displaying ${sectionName}`
      : "Something went wrong displaying this section";

    return (
      <div
        role="alert"
        className="flex flex-col items-center justify-center gap-4 rounded-2xl border p-8 text-center"
        style={{
          backgroundColor: "var(--surface)",
          borderColor: "var(--border)",
          color: "var(--text-primary)",
        }}
      >
        <div
          className="flex h-12 w-12 items-center justify-center rounded-xl"
          style={{ backgroundColor: "var(--bg-tertiary)" }}
        >
          <AlertTriangle
            size={24}
            strokeWidth={1.5}
            style={{ color: "var(--text-secondary)" }}
          />
        </div>
        <div className="space-y-1">
          <p
            className="text-sm font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {message}
          </p>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            You can retry, or refresh the page if the problem persists.
          </p>
        </div>
        <button
          type="button"
          onClick={this.handleRetry}
          className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
          style={{
            backgroundColor: "var(--surface)",
            borderColor: "var(--border)",
            color: "var(--text-primary)",
          }}
        >
          <RotateCcw size={14} strokeWidth={1.5} />
          Retry
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
