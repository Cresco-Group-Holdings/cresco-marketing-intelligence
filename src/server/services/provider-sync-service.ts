import { randomUUID } from "node:crypto";
import type { ProviderSyncMode } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import {
  DEFAULT_BACKFILL_DAYS,
  DEFAULT_DATA_DELAY_DAYS,
  DEFAULT_RECONCILIATION_DAYS,
  type SyncResourceType,
} from "@/lib/integrations/sync/constants";
import { runProviderSyncEngine } from "@/lib/integrations/sync/engine";
import { computeFreshness } from "@/lib/integrations/sync/data-quality";
import type { CanonicalCampaignRecord, CanonicalMetricRecord, CanonicalSyncRecord } from "@/lib/integrations/sync/types";
import { providerSyncAdapterRegistry } from "@/server/providers/sync/sync-adapter-registry";
import { credentialVault } from "@/server/services/credential-vault";
import { credentialRefreshService } from "@/server/services/credential-refresh-service";
import { externalResourceMappingService } from "@/server/services/external-resource-mapping-service";
import { analyticsSyncBridgeService } from "@/server/services/analytics-sync-bridge-service";
import { campaignMappingService } from "@/server/services/campaign-mapping-service";
import { providerSyncPolicyService } from "@/server/services/provider-sync-policy-service";
import { providerAuditService } from "@/server/services/provider-audit-service";

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function resolveDateRange(syncMode: ProviderSyncMode, backfillDays: number) {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - DEFAULT_DATA_DELAY_DAYS);
  const start = new Date(end);

  if (syncMode === "FULL" || syncMode === "BACKFILL") {
    start.setUTCDate(start.getUTCDate() - (backfillDays - 1));
  } else {
    start.setUTCDate(start.getUTCDate() - (DEFAULT_RECONCILIATION_DAYS - 1));
  }

  return { start, end };
}

function isMetricRecord(record: CanonicalSyncRecord): record is CanonicalMetricRecord {
  return record.resourceType === "metric_daily";
}

function isCampaignRecord(record: CanonicalSyncRecord): record is CanonicalCampaignRecord {
  return record.resourceType === "campaign";
}

export const providerSyncService = {
  async getSyncConfig(context: TenantContext, connectionId: string) {
    const policy = await providerSyncPolicyService.getOrCreatePolicy(context, connectionId);
    return {
      schedule: policy.schedule,
      customIntervalMinutes: policy.customIntervalMinutes,
      resourceTypes: policy.resourceTypes,
      backfillDays: policy.backfillDays,
      timezone: policy.timezone,
      enabled: policy.enabled,
      lastScheduledAt: policy.lastScheduledAt?.toISOString() ?? null,
    };
  },

  async updateSyncConfig(
    context: TenantContext,
    connectionId: string,
    input: Parameters<typeof providerSyncPolicyService.updatePolicy>[2],
  ) {
    const policy = await providerSyncPolicyService.updatePolicy(context, connectionId, input);
    return {
      schedule: policy.schedule,
      customIntervalMinutes: policy.customIntervalMinutes,
      resourceTypes: policy.resourceTypes,
      backfillDays: policy.backfillDays,
      timezone: policy.timezone,
      enabled: policy.enabled,
    };
  },

  async listSyncRuns(context: TenantContext, connectionId: string, limit = 20) {
    const runs = await prisma.providerSyncRun.findMany({
      where: { organisationId: context.organisationId, connectionId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return runs.map((run) => ({
      id: run.id,
      status: run.status,
      syncMode: run.syncMode,
      resourceTypes: run.resourceTypes,
      recordsProcessed: run.recordsProcessed,
      recordsFailed: run.recordsFailed,
      partialFailure: run.partialFailure,
      startedAt: run.startedAt?.toISOString() ?? null,
      completedAt: run.completedAt?.toISOString() ?? null,
      errorMessage: run.errorMessage,
      createdAt: run.createdAt.toISOString(),
    }));
  },

  async getSyncRun(context: TenantContext, connectionId: string, runId: string) {
    const run = await prisma.providerSyncRun.findFirst({
      where: { id: runId, connectionId, organisationId: context.organisationId },
      include: { failures: true },
    });
    if (!run) throw new AppError("NOT_FOUND", "Sync run not found.");
    return run;
  },

  async listFailures(context: TenantContext, connectionId: string) {
    return prisma.providerSyncFailure.findMany({
      where: {
        organisationId: context.organisationId,
        connectionId,
        status: { in: ["PENDING_RETRY", "RETRYING"] },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  },

  async getFreshness(context: TenantContext, connectionId: string) {
    const connection = await prisma.providerConnection.findFirst({
      where: { id: connectionId, organisationId: context.organisationId },
    });
    if (!connection) throw new AppError("NOT_FOUND", "Provider connection not found.");

    const latestRun = await prisma.providerSyncRun.findFirst({
      where: { connectionId, status: { in: ["COMPLETED", "PARTIAL"] } },
      orderBy: { completedAt: "desc" },
    });

    const freshness = computeFreshness(latestRun?.completedAt ?? null);
    return {
      connectionStatus: connection.status,
      lastSuccessfulAt: connection.lastSuccessfulAt?.toISOString() ?? null,
      lastSyncRun: latestRun
        ? {
            id: latestRun.id,
            completedAt: latestRun.completedAt?.toISOString() ?? null,
            status: latestRun.status,
            partialFailure: latestRun.partialFailure,
          }
        : null,
      fresh: freshness.fresh,
      staleHours: freshness.staleHours,
    };
  },

  async getPerformanceOverview(context: TenantContext, connectionId: string) {
    const mappings = await externalResourceMappingService.listByConnection(
      context.organisationId,
      connectionId,
    );
    const metricMappings = mappings.filter((m) => m.externalResourceType === "metric_daily");
    const campaignMappings = mappings.filter((m) => m.externalResourceType === "campaign");

    const latestRun = await prisma.providerSyncRun.findFirst({
      where: { connectionId },
      orderBy: { createdAt: "desc" },
    });

    return {
      mappedCampaigns: campaignMappings.length,
      mappedMetrics: metricMappings.length,
      latestRunStatus: latestRun?.status ?? null,
      recordsProcessed: latestRun?.recordsProcessed ?? 0,
      partialFailure: latestRun?.partialFailure ?? false,
    };
  },

  async retryFailures(context: TenantContext, connectionId: string, failureIds?: string[]) {
    return this.runSync(context, connectionId, {
      syncMode: "RETRY",
      retryFailureIds: failureIds,
    });
  },

  async runSync(
    context: TenantContext,
    connectionId: string,
    input?: {
      syncMode?: ProviderSyncMode;
      resourceTypes?: SyncResourceType[];
      dateRange?: { start: Date; end: Date };
      retryFailureIds?: string[];
    },
  ) {
    const connection = await prisma.providerConnection.findFirst({
      where: { id: connectionId, organisationId: context.organisationId },
    });
    if (!connection) throw new AppError("NOT_FOUND", "Provider connection not found.");
    if (connection.status === "REVOKED" || connection.status === "ARCHIVED") {
      throw new AppError("VALIDATION_ERROR", "Cannot sync a revoked or archived connection.");
    }

    const policy = await providerSyncPolicyService.getOrCreatePolicy(context, connectionId);
    const syncMode = input?.syncMode ?? "MANUAL";
    const resourceTypes = (input?.resourceTypes ?? policy.resourceTypes) as SyncResourceType[];
    const dateRange = input?.dateRange ?? resolveDateRange(syncMode, policy.backfillDays ?? DEFAULT_BACKFILL_DAYS);
    const correlationId = randomUUID();

    let accessToken = await credentialVault.readForExecution(connectionId, "OAUTH_ACCESS_TOKEN", {
      organisationId: context.organisationId,
      actorUserId: context.userId,
      providerKey: connection.providerKey,
    });

    if (!accessToken) {
      try {
        await credentialRefreshService.refreshConnection(context, connectionId);
        accessToken = await credentialVault.readForExecution(connectionId, "OAUTH_ACCESS_TOKEN", {
          organisationId: context.organisationId,
          actorUserId: context.userId,
          providerKey: connection.providerKey,
        });
      } catch {
        throw new AppError("VALIDATION_ERROR", "Unable to obtain access token for sync.");
      }
    }

    const syncRun = await prisma.providerSyncRun.create({
      data: {
        organisationId: context.organisationId,
        connectionId,
        syncMode,
        status: "RUNNING",
        startedAt: new Date(),
        resourceTypes,
        triggeredByUserId: context.userId,
        dateRangeStart: dateRange.start,
        dateRangeEnd: dateRange.end,
        correlationId,
      },
    });

    await providerAuditService.recordEvent({
      organisationId: context.organisationId,
      providerKey: connection.providerKey,
      action: "SYNC_STARTED",
      connectionId,
      actorUserId: context.userId,
      result: "success",
      metadata: { syncRunId: syncRun.id, syncMode, resourceTypes },
    });

    const adapter = providerSyncAdapterRegistry.resolve(connection.providerKey);
    if (!adapter) {
      throw new AppError("VALIDATION_ERROR", "No sync adapter registered for provider.");
    }
    let totalProcessed = 0;
    let totalFailed = 0;
    let partialFailure = false;
    const allWarnings: string[] = [];

    for (const resourceType of resourceTypes) {
      const cursor = await prisma.providerSyncCursor.findUnique({
        where: {
          connectionId_resourceType: { connectionId, resourceType },
        },
      });

      const engineResult = await runProviderSyncEngine({
        resourceType,
        initialCursor: cursor?.cursorValue,
        fetchPage: (pageCursor) =>
          adapter.fetchPage({
            context: {
              organisationId: context.organisationId,
              connectionId,
              providerKey: connection.providerKey,
              accessToken: accessToken!,
              dateRange,
            },
            resourceType,
            cursor: pageCursor,
          }),
        onPage: async (page, nextCursor) => {
          await this.ingestRecords(context, connection, syncRun.id, page.records);
          totalProcessed += page.records.length;
          if (page.warnings?.length) allWarnings.push(...page.warnings);

          if (nextCursor) {
            await prisma.providerSyncCursor.upsert({
              where: { connectionId_resourceType: { connectionId, resourceType } },
              create: {
                organisationId: context.organisationId,
                connectionId,
                resourceType,
                cursorValue: nextCursor,
              },
              update: { cursorValue: nextCursor },
            });
          }
        },
        onFailure: async (failure) => {
          totalFailed += 1;
          await prisma.providerSyncFailure.create({
            data: {
              organisationId: context.organisationId,
              connectionId,
              syncRunId: syncRun.id,
              resourceType: failure.resourceType,
              externalResourceId: failure.externalResourceId,
              pageCursor: failure.cursor,
              errorMessage: failure.error.message,
              status: "PENDING_RETRY",
            },
          });
        },
      });

      totalFailed += engineResult.recordsFailed;
      partialFailure = partialFailure || engineResult.partialFailure;
      if (engineResult.warnings.length) allWarnings.push(...engineResult.warnings);
    }

    const finalStatus =
      engineStatus(totalProcessed, totalFailed, partialFailure);

    const completed = await prisma.providerSyncRun.update({
      where: { id: syncRun.id },
      data: {
        status: finalStatus,
        completedAt: new Date(),
        recordsProcessed: totalProcessed,
        recordsFailed: totalFailed,
        partialFailure,
        errorMessage: finalStatus === "FAILED" ? "One or more resources failed to sync." : undefined,
        metadata: { warnings: allWarnings },
      },
    });

    await prisma.providerConnection.update({
      where: { id: connectionId },
      data: {
        lastSuccessfulAt: finalStatus === "COMPLETED" || finalStatus === "PARTIAL" ? new Date() : undefined,
        lastHealthCheckAt: new Date(),
      },
    });

    await providerAuditService.recordEvent({
      organisationId: context.organisationId,
      providerKey: connection.providerKey,
      action: finalStatus === "FAILED" ? "SYNC_FAILED" : "SYNC_COMPLETED",
      connectionId,
      actorUserId: context.userId,
      result: finalStatus === "FAILED" ? "failure" : "success",
      metadata: {
        syncRunId: syncRun.id,
        recordsProcessed: totalProcessed,
        recordsFailed: totalFailed,
        partialFailure,
      },
    });

    return {
      id: completed.id,
      status: completed.status,
      recordsProcessed: completed.recordsProcessed,
      recordsFailed: completed.recordsFailed,
      partialFailure: completed.partialFailure,
      warnings: allWarnings,
      dateRange: { start: formatDate(dateRange.start), end: formatDate(dateRange.end) },
    };
  },

  async ingestRecords(
    context: TenantContext,
    connection: { id: string; organisationId: string; providerKey: string; projectId: string | null; brandId: string | null },
    syncRunId: string,
    records: CanonicalSyncRecord[],
  ) {
    const metricRecords = records.filter(isMetricRecord);
    const campaignRecords = records.filter(isCampaignRecord);

    if (metricRecords.length > 0) {
      await analyticsSyncBridgeService.ingestMetricRecords({
        organisationId: connection.organisationId,
        connectionId: connection.id,
        providerKey: connection.providerKey,
        syncRunId,
        records: metricRecords,
        projectId: connection.projectId,
        brandId: connection.brandId,
      });
    }

    for (const record of campaignRecords) {
      await campaignMappingService.importCampaignRecord(context, connection.id, record, "EXTERNAL_ONLY");
    }

    for (const record of records) {
      if (record.resourceType === "provider_account") {
        await externalResourceMappingService.upsertMapping({
          organisationId: connection.organisationId,
          connectionId: connection.id,
          providerKey: connection.providerKey,
          externalResourceType: "provider_account",
          externalResourceId: record.externalId,
          internalResourceType: "provider_account",
          internalResourceId: record.externalId,
          sourceUpdatedAt: record.sourceUpdatedAt ? new Date(record.sourceUpdatedAt) : undefined,
        });
      }
    }
  },
};

function engineStatus(
  processed: number,
  failed: number,
  partialFailure: boolean,
): "COMPLETED" | "PARTIAL" | "FAILED" {
  if (failed > 0 && processed === 0) return "FAILED";
  if (partialFailure || failed > 0) return "PARTIAL";
  return "COMPLETED";
}
