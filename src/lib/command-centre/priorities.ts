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
      action: { label: "Review", href: "/publishing" },
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
        href: isConnector ? "/integrations" : "/operations",
      },
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
      action: { label: "Review queue", href: "/publishing" },
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
      action: { label: "Check integrations", href: "/integrations" },
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
