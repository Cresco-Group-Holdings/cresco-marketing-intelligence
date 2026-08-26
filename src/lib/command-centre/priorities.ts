import type {
  CommandCentrePriority,
  PriorityAction,
  PriorityUrgency,
} from "@/lib/command-centre/types";
import type {
  DataFreshnessState,
  MarketingSignalAction,
  MarketingSignalSeverity,
} from "@/lib/marketing-intelligence/types";

/** Maps marketing signal severity to the Command Centre priority urgency model. */
export function mapMarketingSignalSeverityToPriorityUrgency(
  severity: MarketingSignalSeverity,
): PriorityUrgency {
  switch (severity) {
    case "high":
      return "critical";
    case "medium":
      return "high";
    case "info":
    default:
      return "normal";
  }
}

/** Preserves label-only actions when no navigation target exists. */
export function resolvePriorityAction(
  action: MarketingSignalAction | undefined,
  fallbackLabel = "Review",
): PriorityAction {
  if (!action) {
    return { label: fallbackLabel };
  }

  if (action.href) {
    return { label: action.label, href: action.href };
  }

  return { label: action.label };
}

type BuildPrioritiesInput = {
  pendingApprovals: number;
  approvalBudget?: string | null;
  openAlerts: Array<{
    id: string;
    title: string;
    alertType: string;
    provider?: string | null;
    safeErrorMessage: string;
    updatedAt: Date;
  }>;
  dueTodayPublications: number;
  overdueContent: number;
  failedAutomations: number;
  experimentsReady: number;
  staleDataProviders: string[];
  organicReauthRequired?: number;
  publishingGap?: boolean;
  winningContentReady?: number;
  engagementDecline?: boolean;
  contentAwaitingApproval?: number;
};

const URGENCY_ORDER = { critical: 3, high: 2, normal: 1 } as const;

export function buildCommandCentrePriorities(input: BuildPrioritiesInput): CommandCentrePriority[] {
  const priorities: CommandCentrePriority[] = [];

  if (input.pendingApprovals > 0) {
    priorities.push({
      id: "pending-approvals",
      type: "approval",
      title:
        input.pendingApprovals === 1
          ? "1 campaign needs approval"
          : `${input.pendingApprovals} campaigns need approval`,
      urgency: "high",
      context: input.approvalBudget ?? "Awaiting review before launch",
      action: { label: "Review queue", href: "/organic-social/publishing" },
    });
  }

  if ((input.organicReauthRequired ?? 0) > 0) {
    priorities.push({
      id: "organic-reauth-required",
      type: "integration",
      title:
        input.organicReauthRequired === 1
          ? "1 organic account needs reauthentication"
          : `${input.organicReauthRequired} organic accounts need reauthentication`,
      urgency: "critical",
      context: "Publishing and analytics may be interrupted until reconnected",
      action: { label: "Reconnect", href: "/social/connections" },
    });
  }

  if (input.publishingGap) {
    priorities.push({
      id: "organic-publishing-gap",
      type: "content",
      title: "No organic content scheduled soon",
      urgency: "high",
      context: "Publishing cadence gap detected across connected organic channels",
      action: { label: "Schedule content", href: "/organic-social/publishing" },
    });
  }

  if ((input.winningContentReady ?? 0) > 0) {
    priorities.push({
      id: "organic-winning-content",
      type: "content",
      title:
        input.winningContentReady === 1
          ? "1 winning post ready to repurpose"
          : `${input.winningContentReady} winning posts ready to repurpose`,
      urgency: "normal",
      context: "High-performing content can be adapted to additional channels",
      action: { label: "Review content", href: "/organic-social/content" },
    });
  }

  if (input.engagementDecline) {
    priorities.push({
      id: "organic-engagement-decline",
      type: "anomaly",
      title: "Organic engagement declined",
      urgency: "high",
      context: "Engagement fell materially compared with the previous period",
      action: { label: "View growth", href: "/organic-social/growth" },
    });
  }

  for (const alert of input.openAlerts.slice(0, 3)) {
    const isConnector =
      alert.alertType.includes("CONNECTOR") ||
      alert.alertType.includes("TOKEN") ||
      alert.alertType.includes("SYNC");
    const isCritical =
      alert.alertType === "TOKEN_REAUTH_REQUIRED" ||
      alert.alertType.includes("DEAD_LETTER") ||
      alert.alertType === "CONNECTOR_SYNC_FAILURE";
    priorities.push({
      id: `alert-${alert.id}`,
      type: isConnector ? "integration" : "automation",
      title: alert.title,
      urgency: isCritical ? "critical" : "high",
      context: alert.safeErrorMessage,
      targetLabel: alert.provider ?? undefined,
      action: {
        label: isConnector ? "Fix connection" : "View alert",
        href: isConnector
          ? alert.provider?.match(/LINKEDIN|INSTAGRAM|FACEBOOK|X|TIKTOK|YOUTUBE/i)
            ? "/social/connections"
            : "/integrations"
          : "/operations",
      },
    });
  }

  if ((input.contentAwaitingApproval ?? 0) > 0) {
    priorities.push({
      id: "content-studio-approval",
      type: "content",
      title:
        input.contentAwaitingApproval === 1
          ? "1 content item awaiting approval"
          : `${input.contentAwaitingApproval} content items awaiting approval`,
      urgency: "high",
      context: "Studio content requires review before publishing.",
      action: { label: "Review content", href: "/content/studio/workflow" },
    });
  }

  if (input.overdueContent > 0) {
    priorities.push({
      id: "overdue-content",
      type: "content",
      title:
        input.overdueContent === 1
          ? "1 overdue content item"
          : `${input.overdueContent} overdue content items`,
      urgency: "critical",
      context: "Past scheduled publish date — audience reach may be impacted",
      action: { label: "Review calendar", href: "/calendar" },
    });
  }

  if (input.dueTodayPublications > 0) {
    priorities.push({
      id: "due-today-publications",
      type: "publication",
      title:
        input.dueTodayPublications === 1
          ? "1 content item ready to publish"
          : `${input.dueTodayPublications} content items ready to publish`,
      urgency: "high",
      context: "Due today",
      action: { label: "Review queue", href: "/organic-social/publishing" },
    });
  }

  if (input.failedAutomations > 0) {
    priorities.push({
      id: "failed-automations",
      type: "automation",
      title:
        input.failedAutomations === 1
          ? "1 automation failure"
          : `${input.failedAutomations} automation failures`,
      urgency: "high",
      context: "Automated workflows require attention",
      action: { label: "View operations", href: "/operations" },
    });
  }

  for (const provider of input.staleDataProviders.slice(0, 2)) {
    priorities.push({
      id: `stale-${provider}`,
      type: "data",
      title: `${provider} is stale`,
      urgency: "high",
      context: "Sync delayed — dashboard metrics may be incomplete",
      action: { label: "Check integrations", href: "/organic-social/accounts" },
    });
  }

  if (input.experimentsReady > 0) {
    priorities.push({
      id: "experiments-ready",
      type: "experiment",
      title:
        input.experimentsReady === 1
          ? "1 experiment ready for review"
          : `${input.experimentsReady} experiments ready for review`,
      urgency: "normal",
      context: "Results available for review",
      action: { label: "Review", href: "/experiments" },
    });
  }

  return priorities.sort((a, b) => URGENCY_ORDER[b.urgency] - URGENCY_ORDER[a.urgency]);
}

export function mapFreshnessToStaleProviders(
  channels: Array<{ label: string; freshness: DataFreshnessState }>,
): string[] {
  return channels
    .filter((channel) => channel.freshness === "stale" || channel.freshness === "unavailable")
    .map((channel) => channel.label);
}
