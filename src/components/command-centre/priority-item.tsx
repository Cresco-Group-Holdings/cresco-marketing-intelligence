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

const URGENCY_STYLES = {
  high: "border-danger/20 bg-danger-muted/20",
  medium: "border-warning/20 bg-warning-muted/10",
  low: "border-border bg-surface",
} as const;

export function PriorityItem({ priority }: { priority: CommandCentrePriority }) {
  const Icon = TYPE_ICONS[priority.type];

  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 rounded-lg border px-4 py-3",
        URGENCY_STYLES[priority.urgency],
      )}
    >
      <div className="flex min-w-0 gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-foreground-muted" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{priority.title}</p>
          <p className="mt-0.5 text-xs text-foreground-muted">{priority.context}</p>
          {priority.targetLabel ? (
            <p className="mt-1 text-xs text-foreground-subtle">{priority.targetLabel}</p>
          ) : null}
        </div>
      </div>
      <Link
        href={priority.action.href}
        className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {priority.action.label}
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </div>
  );
}

export function TodaysPrioritiesPanel({
  priorities,
  emptyTitle = "No urgent priorities",
  emptyDescription = "Your marketing operations look clear for now. Check back as campaigns and content move through your workflow.",
}: {
  priorities: CommandCentrePriority[];
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (priorities.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface-subtle p-6 text-center">
        <p className="text-sm font-semibold text-foreground">{emptyTitle}</p>
        <p className="mt-2 text-sm text-foreground-muted">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {priorities.map((priority) => (
        <PriorityItem key={priority.id} priority={priority} />
      ))}
    </div>
  );
}
