import type { DataFreshnessState } from "@/lib/marketing-intelligence/types";
import type { CommandCentrePriority } from "@/lib/command-centre/types";

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
};

const URGENCY_ORDER = { high: 3, medium: 2, low: 1 } as const;

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
      action: { label: "Review", href: "/publishing" },
    });
  }

  for (const alert of input.openAlerts.slice(0, 3)) {
    const isConnector =
      alert.alertType.includes("CONNECTOR") ||
      alert.alertType.includes("TOKEN") ||
      alert.alertType.includes("SYNC");
    priorities.push({
      id: `alert-${alert.id}`,
      type: isConnector ? "integration" : "automation",
      title: alert.title,
      urgency: alert.alertType === "TOKEN_REAUTH_REQUIRED" ? "high" : "medium",
      context: alert.safeErrorMessage,
      targetLabel: alert.provider ?? undefined,
      action: {
        label: isConnector ? "Fix connection" : "View alert",
        href: isConnector ? "/integrations" : "/operations",
      },
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
      urgency: "medium",
      context: "Due today",
      action: { label: "Review queue", href: "/publishing" },
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
      urgency: "high",
      context: "Past scheduled publish date",
      action: { label: "Review calendar", href: "/calendar" },
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
      urgency: "medium",
      context: "Requires attention",
      action: { label: "View operations", href: "/operations" },
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
      urgency: "low",
      context: "Results available",
      action: { label: "Review", href: "/experiments" },
    });
  }

  for (const provider of input.staleDataProviders.slice(0, 2)) {
    priorities.push({
      id: `stale-${provider}`,
      type: "data",
      title: `${provider} data is stale`,
      urgency: "medium",
      context: "Sync delayed — metrics may be incomplete",
      action: { label: "Check integrations", href: "/integrations" },
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
