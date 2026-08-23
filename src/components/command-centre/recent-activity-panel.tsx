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
      <div className="rounded-md border border-dashed border-border/70 px-4 py-4 text-center">
        <p className="text-xs font-medium text-foreground-muted">{emptyTitle}</p>
        <p className="mt-1 text-[11px] text-foreground-subtle">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border/60" role="list">
      {activities.map((activity) => {
        const Icon = TYPE_ICONS[activity.type] ?? TYPE_ICONS.default;
        const content = (
          <>
            <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground-subtle" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-foreground-muted">{activity.description}</p>
              <p className="mt-0.5 text-[10px] text-foreground-subtle">
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
                className="flex items-start gap-2.5 py-2 transition-colors hover:bg-surface-hover/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {content}
              </Link>
            ) : (
              <div className="flex items-start gap-2.5 py-2">{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
