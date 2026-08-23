import type { DataFreshnessState } from "@/lib/marketing-intelligence/types";
import { cn } from "@/lib/utils";

const STATE_LABELS: Record<DataFreshnessState, string> = {
  fresh: "Up to date",
  delayed: "Syncing",
  stale: "Stale",
  unavailable: "Unavailable",
};

const STATE_STYLES: Record<DataFreshnessState, string> = {
  fresh: "text-success",
  delayed: "text-foreground-subtle",
  stale: "text-warning",
  unavailable: "text-danger",
};

type DataFreshnessProps = {
  label: string;
  state: DataFreshnessState;
  detail?: string;
  className?: string;
};

export function DataFreshness({ label, state, detail, className }: DataFreshnessProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2 text-xs", className)}>
      <span className="text-foreground-subtle">{label}</span>
      <span className={cn("font-medium", STATE_STYLES[state])}>{STATE_LABELS[state]}</span>
      {detail ? <span className="text-foreground-subtle">· {detail}</span> : null}
    </div>
  );
}
