import { prisma } from "@/lib/database/prisma";
import {
  buildCommandCentrePriorities,
  mapFreshnessToStaleProviders,
} from "@/lib/command-centre/priorities";
import { buildFunnelStages } from "@/lib/command-centre/metrics";
import { summarizeProviderConnectionHealthCounts } from "@/lib/providers/connection-health";
import type {
  CommandCentreActivity,
  CommandCentreFunnelStage,
  CommandCentrePriority,
} from "@/lib/command-centre/types";
import type { DataFreshnessState } from "@/lib/marketing-intelligence/types";
import { auditService } from "@/server/services/audit-service";
import { operationalAlertService } from "@/server/services/operational-alert-service";
import { hasPermission, PERMISSIONS } from "@/lib/tenancy/permissions";
import type { TenantContext } from "@/lib/tenancy/context";

function startOfToday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfToday(): Date {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date;
}

function mapAuditActionToActivityType(action: string, resourceType: string): string {
  if (resourceType.includes("Campaign") || action.includes("campaign")) return "campaign";
  if (resourceType.includes("Publication") || action.includes("publish")) return "content";
  if (resourceType.includes("Automation")) return "automation";
  if (resourceType.includes("Experiment")) return "experiment";
  if (resourceType.includes("Connector") || resourceType.includes("Integration")) return "integration";
  if (action.includes("recommendation")) return "recommendation";
  return "default";
}

function formatAuditDescription(action: string, resourceType: string): string {
  const normalized = action.replace(/\./g, " ").replace(/_/g, " ");
  return `${normalized} · ${resourceType}`;
}

export async function buildDashboardPriorities(input: {
  brandId: string;
  organisationId: string;
  tenant: TenantContext;
  paidFreshness: DataFreshnessState;
  organicFreshness: DataFreshnessState;
  paidLabels: string[];
  organicLabels: string[];
  organicReauthRequired?: number;
  publishingGap?: boolean;
  winningContentReady?: number;
  engagementDecline?: boolean;
}): Promise<CommandCentrePriority[]> {
  const todayStart = startOfToday();
  const todayEnd = endOfToday();

  const [
    pendingApprovals,
    dueTodayPublications,
    overdueContent,
    openAlertsResult,
    readyPlans,
    completedExperiments,
    contentAwaitingApproval,
    providerConnections,
    activeInitialImportRuns,
  ] = await Promise.all([
    prisma.publication.count({
      where: {
        brandId: input.brandId,
        organisationId: input.organisationId,
        status: "PENDING_APPROVAL",
      },
    }),
    prisma.publication.count({
      where: {
        brandId: input.brandId,
        organisationId: input.organisationId,
        status: { in: ["APPROVED", "SCHEDULED"] },
        scheduledFor: { gte: todayStart, lte: todayEnd },
      },
    }),
    prisma.publication.count({
      where: {
        brandId: input.brandId,
        organisationId: input.organisationId,
        status: { in: ["SCHEDULED", "APPROVED"] },
        scheduledFor: { lt: todayStart },
      },
    }),
    operationalAlertService
      .list(
        input.organisationId,
        { brandId: input.brandId, limit: 5, status: "OPEN" },
        input.tenant,
      )
      .catch(() => ({ items: [], nextCursor: null })),
    prisma.advertisingCampaignPlan.count({
      where: {
        brandId: input.brandId,
        organisationId: input.organisationId,
        status: "READY_FOR_REVIEW",
      },
    }),
    prisma.socialExperiment.count({
      where: {
        brandId: input.brandId,
        organisationId: input.organisationId,
        status: "COMPLETED",
      },
    }),
    prisma.contentItem.count({
      where: {
        brandId: input.brandId,
        organisationId: input.organisationId,
        archivedAt: null,
        studioType: { not: null },
        status: "IN_REVIEW",
      },
    }),
    prisma.providerConnection.findMany({
      where: {
        organisationId: input.organisationId,
        status: { notIn: ["REVOKED", "ARCHIVED"] },
      },
      select: {
        id: true,
        status: true,
        tokenExpiresAt: true,
        lastErrorAt: true,
        lastSuccessfulAt: true,
        accounts: {
          where: { selected: true },
          select: { id: true },
          take: 1,
        },
      },
    }),
    prisma.providerSyncRun.findMany({
      where: {
        organisationId: input.organisationId,
        triggerType: "INITIAL_IMPORT",
        status: { in: ["PENDING", "QUEUED", "RUNNING", "RETRYING"] },
      },
      select: { connectionId: true },
    }),
  ]);

  const activeInitialSyncConnectionIds = new Set(
    activeInitialImportRuns.map((run) => run.connectionId),
  );
  const now = Date.now();
  const { reauthRequired: providerReauthRequired, initialSyncInProgress: providerInitialSyncInProgress } =
    summarizeProviderConnectionHealthCounts(
      providerConnections.map((connection) => ({
        status: connection.status,
        hasSelectedAccount: connection.accounts.length > 0,
        initialSyncInProgress: activeInitialSyncConnectionIds.has(connection.id),
        tokenExpired:
          connection.tokenExpiresAt != null && connection.tokenExpiresAt.getTime() <= now,
        lastSyncFailed:
          connection.lastErrorAt != null &&
          (connection.lastSuccessfulAt == null ||
            connection.lastErrorAt > connection.lastSuccessfulAt),
      })),
    );

  const staleProviders = mapFreshnessToStaleProviders([
    { label: "Paid data", freshness: input.paidFreshness },
    { label: "Organic data", freshness: input.organicFreshness },
    ...input.paidLabels.map((label) => ({ label, freshness: input.paidFreshness })),
    ...input.organicLabels.map((label) => ({ label, freshness: input.organicFreshness })),
  ]);

  return buildCommandCentrePriorities({
    pendingApprovals: pendingApprovals + readyPlans,
    openAlerts: openAlertsResult.items.map((alert) => ({
      id: alert.id,
      title: alert.title,
      alertType: alert.alertType,
      provider: alert.provider,
      safeErrorMessage: alert.safeErrorMessage,
      updatedAt: alert.updatedAt,
    })),
    dueTodayPublications,
    overdueContent,
    failedAutomations: openAlertsResult.items.filter((alert) =>
      alert.alertType.includes("PUBLISHING"),
    ).length,
    experimentsReady: completedExperiments,
    staleDataProviders: [...new Set(staleProviders)],
    organicReauthRequired: input.organicReauthRequired,
    providerReauthRequired,
    providerInitialSyncInProgress,
    publishingGap: input.publishingGap,
    winningContentReady: input.winningContentReady,
    engagementDecline: input.engagementDecline,
    contentAwaitingApproval,
  });
}

export function buildDashboardFunnel(input: {
  impressions: number | null;
  clicks: number | null;
  visits: number | null;
  conversions: number | null;
  revenue: number | null;
}): CommandCentreFunnelStage[] {
  return buildFunnelStages(input);
}

export async function buildDashboardActivity(input: {
  organisationId: string;
  tenant?: TenantContext;
}): Promise<CommandCentreActivity[]> {
  const canViewAudit =
    input.tenant != null
      ? hasPermission(input.tenant.organisationRole, PERMISSIONS["auditLogs.read"])
      : false;

  const auditEvents = canViewAudit
    ? await auditService.list(input.organisationId, 10).catch(() => [])
    : [];

  const alertEvents = input.tenant
    ? (
        await operationalAlertService
          .list(input.organisationId, { limit: 5 }, input.tenant)
          .catch(() => ({ items: [] }))
      ).items
    : [];

  const auditActivities: CommandCentreActivity[] = auditEvents.map((event) => ({
    id: `audit-${event.id}`,
    type: mapAuditActionToActivityType(event.action, event.resourceType),
    description: formatAuditDescription(event.action, event.resourceType),
    timestamp: event.createdAt.toISOString(),
    href: undefined,
  }));

  const alertActivities: CommandCentreActivity[] = alertEvents.map((alert) => ({
    id: `alert-${alert.id}`,
    type: "alert",
    description: alert.title,
    timestamp: alert.updatedAt.toISOString(),
    href: "/operations",
  }));

  return [...alertActivities, ...auditActivities]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 8);
}
