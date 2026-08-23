import Link from "next/link";
import {
  Activity,
  Beaker,
  Bot,
  Megaphone,
  Plug,
  Sparkles,
  Target,
  TriangleAlert,
} from "lucide-react";
import type { CommandCentreActivity } from "@/lib/command-centre/types";

const TYPE_ICONS: Record<string, typeof Activity> = {
  campaign: Target,
  recommendation: Sparkles,
  content: Megaphone,
  automation: Bot,
  experiment: Beaker,
  integration: Plug,
  competitor: Target,
  alert: TriangleAlert,
  default: Activity,
};

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function RecentActivityPanel({
  activities,
  emptyTitle = "No recent activity",
  emptyDescription = "Operational events, campaign changes, and publishing activity will appear here as your team works.",
}: {
  activities: CommandCentreActivity[];
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (activities.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface-subtle p-6 text-center">
        <p className="text-sm font-semibold text-foreground">{emptyTitle}</p>
        <p className="mt-2 text-sm text-foreground-muted">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2" role="list">
      {activities.map((activity) => {
        const Icon = TYPE_ICONS[activity.type] ?? TYPE_ICONS.default;
        const content = (
          <>
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-foreground-muted" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground">{activity.description}</p>
              <p className="mt-0.5 text-xs text-foreground-subtle">
                {formatRelativeTime(activity.timestamp)}
              </p>
            </div>
          </>
        );

        return (
          <li key={activity.id}>
            {activity.href ? (
              <Link
                href={activity.href}
                className="flex items-start gap-3 rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {content}
              </Link>
            ) : (
              <div className="flex items-start gap-3 rounded-lg border border-border bg-surface px-4 py-3">
                {content}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
