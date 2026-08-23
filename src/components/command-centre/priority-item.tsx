import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Beaker,
  CheckCircle2,
  Database,
  Megaphone,
  Plug,
  Zap,
} from "lucide-react";
import type { CommandCentrePriority } from "@/lib/command-centre/types";
import { cn } from "@/lib/utils";

const TYPE_ICONS = {
  approval: CheckCircle2,
  integration: Plug,
  publication: Megaphone,
  content: Megaphone,
  automation: Zap,
  experiment: Beaker,
  anomaly: AlertTriangle,
  data: Database,
} as const;

const URGENCY_LABELS = {
  critical: "Critical",
  high: "High",
  normal: "Normal",
} as const;

const URGENCY_STYLES = {
  critical: "border-l-danger bg-danger-muted/10",
  high: "border-l-warning bg-warning-muted/5",
  normal: "border-l-border bg-surface",
} as const;

const URGENCY_BADGE_STYLES = {
  critical: "bg-danger-muted text-danger",
  high: "bg-warning-muted text-warning",
  normal: "bg-surface-hover text-foreground-muted",
} as const;

export function PriorityItem({ priority }: { priority: CommandCentrePriority }) {
  const Icon = TYPE_ICONS[priority.type];

  return (
    <div
      className={cn(
        "flex items-start gap-3 border-l-2 px-3 py-2.5",
        URGENCY_STYLES[priority.urgency],
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-foreground-muted" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              URGENCY_BADGE_STYLES[priority.urgency],
            )}
          >
            {URGENCY_LABELS[priority.urgency]}
          </span>
          {priority.targetLabel ? (
            <span className="text-[10px] text-foreground-subtle">{priority.targetLabel}</span>
          ) : null}
        </div>
        <p className="mt-1 text-sm font-medium text-foreground">{priority.title}</p>
        <p className="mt-0.5 text-xs text-foreground-muted">{priority.context}</p>
      </div>
      <Link
        href={priority.action.href}
        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-surface-elevated px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {priority.action.label}
        <ArrowRight className="h-3 w-3" aria-hidden="true" />
      </Link>
    </div>
  );
}

export function TodaysPrioritiesPanel({
  priorities,
  limit = 5,
  emptyTitle = "No urgent priorities",
  emptyDescription = "Your marketing operations look clear for now. Check back as campaigns and content move through your workflow.",
}: {
  priorities: CommandCentrePriority[];
  limit?: number;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (priorities.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface-subtle px-4 py-5 text-center">
        <p className="text-sm font-medium text-foreground">{emptyTitle}</p>
        <p className="mt-1 text-xs text-foreground-muted">{emptyDescription}</p>
      </div>
    );
  }

  const visible = priorities.slice(0, limit);
  const remaining = priorities.length - visible.length;

  return (
    <div className="space-y-1.5">
      {visible.map((priority) => (
        <PriorityItem key={priority.id} priority={priority} />
      ))}
      {remaining > 0 ? (
        <Link
          href="/operations"
          className="inline-flex px-3 pt-1 text-xs font-medium text-foreground-muted hover:text-foreground hover:underline"
        >
          View {remaining} more in Operations
        </Link>
      ) : null}
    </div>
  );
}
