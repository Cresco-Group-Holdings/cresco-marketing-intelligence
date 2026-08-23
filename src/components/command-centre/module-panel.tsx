"use client";

import { Component, type ReactNode } from "react";
import { ErrorState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

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
          description="We couldn't load this module. Other dashboard sections remain available."
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

export type ModulePanelTier = "executive" | "actionable" | "analytical" | "history";

const TIER_STYLES: Record<ModulePanelTier, string> = {
  executive: "border-border bg-surface-elevated shadow-sm",
  actionable: "border-border bg-surface-elevated",
  analytical: "border-border/80 bg-surface",
  history: "border-border/60 bg-surface-subtle/50",
};

const TIER_TITLE_STYLES: Record<ModulePanelTier, string> = {
  executive: "text-sm font-semibold",
  actionable: "text-sm font-semibold",
  analytical: "text-sm font-medium",
  history: "text-xs font-medium uppercase tracking-wide text-foreground-subtle",
};

export function ModulePanel({
  title,
  subtitle,
  actions,
  children,
  className,
  tier = "actionable",
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  tier?: ModulePanelTier;
}) {
  return (
    <section className={cn("rounded-xl border p-4 sm:p-4", TIER_STYLES[tier], className)}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className={cn("text-foreground", TIER_TITLE_STYLES[tier])}>{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs text-foreground-muted">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}
