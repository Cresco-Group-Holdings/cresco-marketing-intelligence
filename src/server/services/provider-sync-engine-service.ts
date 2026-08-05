import { prisma } from "@/lib/database/prisma";
import { isCanonicalCapability } from "@/lib/providers/capability-registry";
import { PROVIDER_ERROR_CODES, ProviderGatewayError } from "@/lib/providers/errors";
import { calculateRetryDelay, classifyProviderError } from "@/lib/providers/execution-policy";
import { providerGateway } from "@/server/services/provider-gateway-service";
import { providerAuditService } from "@/server/services/provider-audit-service";
import { notificationEventService } from "@/server/services/notification-event-service";
import { getOrganisationNotifierUserIds } from "@/lib/notifications/recipients";
import type { TenantContext } from "@/lib/tenancy/context";
import { AppError } from "@/lib/errors";
import type { ProviderSyncRunStatus } from "@prisma/client";

const ACTIVE_SYNC_STATUSES: ProviderSyncRunStatus[] = ["QUEUED", "RUNNING", "RETRYING"];

export const providerSyncEngineService = {
  async startSync(
    connectionId: string,
    organisationId: string,
    input: {
      capability: string;
      resourceType: string;
      direction?: "IMPORT" | "EXPORT";
      triggerType?: "MANUAL" | "SCHEDULED" | "WEBHOOK" | "EVENT" | "INITIAL_IMPORT" | "RETRY";
      idempotencyKey?: string;
    },
    context: TenantContext,
  ) {
    if (!isCanonicalCapability(input.capability)) {
      throw new AppError("VALIDATION_ERROR", "Invalid sync capability.");
    }

    const connection = await prisma.providerConnection.findFirst({
      where: { id: connectionId, organisationId },
    });
    if (!connection) throw new AppError("NOT_FOUND", "Connection not found.");

    const running = await prisma.providerSyncRun.findFirst({
      where: {
        connectionId,
        capability: input.capability,
        status: { in: ACTIVE_SYNC_STATUSES },
      },
    });
    if (running) {
      throw new ProviderGatewayError({
        code: PROVIDER_ERROR_CODES.SYNC_ALREADY_RUNNING,
        safeMessage: "A synchronisation job is already running for this capability.",
      });
    }

    const idempotencyKey = input.idempotencyKey ?? `${input.capability}:${Date.now()}`;
    const existing = await prisma.providerSyncRun.findFirst({
      where: { connectionId, idempotencyKey },
    });
    if (existing?.status === "SUCCEEDED" || existing?.status === "COMPLETED") {
      return existing;
    }

    const syncRun = await prisma.providerSyncRun.create({
      data: {
        organisationId,
        connectionId,
        capability: input.capability,
        resourceType: input.resourceType,
        direction: input.direction ?? "IMPORT",
        triggerType: input.triggerType ?? "MANUAL",
        status: "QUEUED",
        idempotencyKey,
        requestedByUserId: context.userProfileId,
        correlationId: crypto.randomUUID(),
      },
    });

    await providerAuditService.recordEvent({
      organisationId,
      providerKey: connection.providerKey,
      connectionId,
      action: "SYNC_STARTED",
      actorUserId: context.userProfileId,
      requestId: syncRun.correlationId ?? undefined,
      result: "success",
      metadata: { capability: input.capability, syncRunId: syncRun.id },
    });

    return this.executeSyncRun(syncRun.id, organisationId, context);
  },

  async executeSyncRun(syncRunId: string, organisationId: string, context: TenantContext) {
    const syncRun = await prisma.providerSyncRun.findFirst({
      where: { id: syncRunId, organisationId },
    });
    if (!syncRun) throw new AppError("NOT_FOUND", "Sync job not found.");

    await prisma.providerSyncRun.update({
      where: { id: syncRunId },
      data: { status: "RUNNING", startedAt: new Date(), attemptCount: { increment: 1 } },
    });

    let cursor = syncRun.cursor ?? undefined;
    let recordsRead = syncRun.recordsRead;
    let recordsWritten = syncRun.recordsWritten;
    const recordsSkipped = syncRun.recordsSkipped;
    const recordsFailed = syncRun.recordsFailed;
    let hasMore = true;
    let finalStatus: "SUCCEEDED" | "PARTIALLY_SUCCEEDED" | "FAILED" = "SUCCEEDED";

    try {
      while (hasMore) {
        const operation =
          syncRun.capability === "CRM_CONTACTS_READ"
            ? "listContacts"
            : syncRun.capability === "CRM_COMPANIES_READ"
              ? "listCompanies"
              : syncRun.capability === "AD_CAMPAIGNS_READ"
                ? "listCampaigns"
                : syncRun.capability === "AD_ACCOUNTS_READ"
                  ? "listAccounts"
                  : "list";

        const result = await providerGateway.execute({
          organisationId,
          connectionId: syncRun.connectionId,
          capability: syncRun.capability!,
          operation,
          input: { cursor, pageSize: 50 },
          correlationId: syncRun.correlationId ?? undefined,
          idempotencyKey: syncRun.idempotencyKey ? `${syncRun.idempotencyKey}:${cursor ?? "0"}` : undefined,
        }, context);

        if (!result.success) {
          throw new ProviderGatewayError({
            code: PROVIDER_ERROR_CODES.SYNC_FAILED,
            safeMessage: result.errorMessageSafe ?? "Synchronisation failed.",
            retryable: result.retryable,
          });
        }

        const data = result.data as Record<string, unknown>;
        const items =
          (data.campaigns as unknown[]) ??
          (data.contacts as unknown[]) ??
          (data.companies as unknown[]) ??
          (data.accounts as unknown[]) ??
          [];

        recordsRead += items.length;
        recordsWritten += items.length;

        for (const item of items) {
          const record = item as Record<string, unknown>;
          await prisma.providerSyncRecord.create({
            data: {
              syncRunId,
              externalResourceType: syncRun.resourceType ?? "unknown",
              externalResourceId: String(record.externalId ?? record.id ?? crypto.randomUUID()),
              action: "CREATED",
            },
          });
        }

        cursor = data.nextCursor as string | undefined;
        hasMore = Boolean(cursor);

        await prisma.providerSyncRun.update({
          where: { id: syncRunId },
          data: {
            cursor,
            checkpoint: { cursor } as object,
            recordsRead,
            recordsWritten,
            recordsSkipped,
            recordsFailed,
            recordsProcessed: recordsRead,
          },
        });
      }
    } catch (error) {
      finalStatus = recordsWritten > 0 ? "PARTIALLY_SUCCEEDED" : "FAILED";
      const classification = classifyProviderError(error);
      const retryable = classification === "retryable" || classification === "rate_limited";
      const attemptCount = syncRun.attemptCount + 1;

      if (retryable && attemptCount < 3) {
        const updated = await prisma.providerSyncRun.update({
          where: { id: syncRunId },
          data: {
            status: "RETRYING",
            nextRetryAt: new Date(Date.now() + calculateRetryDelay(attemptCount)),
            errorCode: error instanceof ProviderGatewayError ? error.code : "SYNC_FAILED",
            errorMessage: error instanceof Error ? error.message.slice(0, 500) : "Sync failed",
            recordsRead,
            recordsWritten,
            recordsSkipped,
            recordsFailed: recordsFailed + 1,
          },
        });
        return updated;
      }

      const deadLetter = attemptCount >= 3;
      const updated = await prisma.providerSyncRun.update({
        where: { id: syncRunId },
        data: {
          status: deadLetter ? "DEAD_LETTERED" : finalStatus,
          completedAt: new Date(),
          errorCode: error instanceof ProviderGatewayError ? error.code : "SYNC_FAILED",
          errorMessage: error instanceof Error ? error.message.slice(0, 500) : "Sync failed",
          recordsRead,
          recordsWritten,
          recordsSkipped,
          recordsFailed: recordsFailed + 1,
        },
      });

      await providerAuditService.recordEvent({
        organisationId,
        providerKey: "sync-engine",
        connectionId: syncRun.connectionId,
        action: "SYNC_FAILED",
        actorUserId: context.userProfileId,
        requestId: syncRun.correlationId ?? undefined,
        result: "failure",
      });

      const connection = await prisma.providerConnection.findFirst({
        where: { id: syncRun.connectionId, organisationId },
        select: { providerKey: true, brandId: true },
      });
      const recipientUserIds = await getOrganisationNotifierUserIds(organisationId);
      await notificationEventService
        .syncFailed({
          organisationId,
          brandId: connection?.brandId ?? undefined,
          connectionId: syncRun.connectionId,
          provider: connection?.providerKey ?? "provider",
          safeError: error instanceof Error ? error.message.slice(0, 500) : "Sync failed",
          recipientUserIds,
          idempotencyKey: `sync-failed:${syncRun.id}`,
        })
        .catch(() => undefined);

      return updated;
    }

    const completed = await prisma.providerSyncRun.update({
      where: { id: syncRunId },
      data: {
        status: finalStatus,
        completedAt: new Date(),
        recordsRead,
        recordsWritten,
        recordsSkipped,
        recordsFailed,
        recordsProcessed: recordsRead,
      },
    });

    await prisma.providerConnection.update({
      where: { id: syncRun.connectionId },
      data: { lastSuccessfulAt: new Date() },
    });

    await providerAuditService.recordEvent({
      organisationId,
      providerKey: "sync-engine",
      connectionId: syncRun.connectionId,
      action: "SYNC_COMPLETED",
      actorUserId: context.userProfileId,
      requestId: syncRun.correlationId ?? undefined,
      result: "success",
      metadata: { recordsWritten },
    });

    return completed;
  },

  async listSyncJobs(connectionId: string, organisationId: string, limit = 50) {
    return prisma.providerSyncRun.findMany({
      where: { connectionId, organisationId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },

  async cancelSyncJob(syncRunId: string, organisationId: string) {
    const job = await prisma.providerSyncRun.findFirst({
      where: { id: syncRunId, organisationId, status: { in: [...ACTIVE_SYNC_STATUSES] } },
    });
    if (!job) throw new AppError("NOT_FOUND", "Active sync job not found.");
    return prisma.providerSyncRun.update({
      where: { id: syncRunId },
      data: { status: "CANCELLED", completedAt: new Date() },
    });
  },
};
