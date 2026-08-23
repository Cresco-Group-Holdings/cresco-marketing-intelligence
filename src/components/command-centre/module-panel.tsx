"use client";

import { Component, type ReactNode } from "react";
import { ErrorState } from "@/components/ui/empty-state";

type ModuleErrorBoundaryProps = {
  children: ReactNode;
  moduleName: string;
  onRetry?: () => void;
};

type ModuleErrorBoundaryState = {
  hasError: boolean;
  message?: string;
};

export class ModuleErrorBoundary extends Component<
  ModuleErrorBoundaryProps,
  ModuleErrorBoundaryState
> {
  state: ModuleErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): ModuleErrorBoundaryState {
    return { hasError: true, message: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorState
          title={`${this.props.moduleName} unavailable`}
          description={this.state.message}
          onRetry={() => {
            this.setState({ hasError: false, message: undefined });
            this.props.onRetry?.();
          }}
        />
      );
    }
    return this.props.children;
  }
}

export function ModulePanel({
  title,
  subtitle,
  actions,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-border bg-surface-elevated p-4 sm:p-5 ${className ?? ""}`}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {subtitle ? <p className="mt-1 text-xs text-foreground-muted">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}
