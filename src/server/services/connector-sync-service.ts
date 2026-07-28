import { randomUUID } from "node:crypto";
import type { ConnectorSyncType, ConnectorType } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { connectorAdapterFactory } from "@/lib/connectors/adapters/fake-connector-adapter";
import { runConnectorSync } from "@/lib/connectors/sync/engine";
import { connectorCredentialService } from "@/server/services/connector-credential-service";

export const connectorSyncService = {
  async startSync(input: {
    organisationId: string;
    projectId: string;
    brandId: string;
    connectorAccountId: string;
    connectorType: ConnectorType;
    syncType: ConnectorSyncType;
    idempotencyKey?: string;
    shouldCancel?: () => boolean;
  }) {
    const account = await prisma.connectorAccount.findFirst({
      where: {
        id: input.connectorAccountId,
        organisationId: input.organisationId,
        projectId: input.projectId,
        brandId: input.brandId,
      },
    });

    if (!account) {
      throw new AppError("NOT_FOUND", "Connector account was not found.");
    }

    const idempotencyKey = input.idempotencyKey ?? randomUUID();
    const existing = await prisma.connectorSync.findUnique({
      where: {
        connectorAccountId_idempotencyKey: {
          connectorAccountId: input.connectorAccountId,
          idempotencyKey,
        },
      },
    });
    if (existing) {
      return existing;
    }

    const sync = await prisma.connectorSync.create({
      data: {
        organisationId: input.organisationId,
        projectId: input.projectId,
        brandId: input.brandId,
        connectorAccountId: input.connectorAccountId,
        syncType: input.syncType,
        status: "RUNNING",
        idempotencyKey,
        startedAt: new Date(),
      },
    });

    const adapter = connectorAdapterFactory.getAdapter(input.connectorType);
    if (!adapter) {
      await this.markFailed(sync.id, account.id, "Connector adapter is not registered.");
      throw new AppError("VALIDATION_ERROR", "Connector adapter is not registered.");
    }

    const tokens = await connectorCredentialService.readTokens(input.connectorAccountId);
    if (!tokens?.accessToken) {
      await this.markFailed(sync.id, account.id, "Connector credentials are not available.");
      throw new AppError("VALIDATION_ERROR", "Connector credentials are not available.");
    }

    const latestCursor = await prisma.connectorSyncCursor.findFirst({
      where: { connectorAccountId: input.connectorAccountId },
      orderBy: { updatedAt: "desc" },
    });

    const output = await runConnectorSync({
      syncId: sync.id,
      syncType: input.syncType,
      adapter,
      accessToken: tokens.accessToken,
      initialCursor: latestCursor?.cursorValue,
      shouldCancel: input.shouldCancel,
      context: {
        organisationId: input.organisationId,
        projectId: input.projectId,
        brandId: input.brandId,
        connectorAccountId: input.connectorAccountId,
        connectorType: input.connectorType,
      },
      onPage: async (result, cursor) => {
        if (cursor) {
          await prisma.connectorSyncCursor.upsert({
            where: {
              connectorAccountId_cursorKey: {
                connectorAccountId: input.connectorAccountId,
                cursorKey: "default",
              },
            },
            create: {
              connectorAccountId: input.connectorAccountId,
              connectorSyncId: sync.id,
              cursorKey: "default",
              cursorValue: cursor,
            },
            update: {
              connectorSyncId: sync.id,
              cursorValue: cursor,
            },
          });
        }

        await prisma.connectorSync.update({
          where: { id: sync.id },
          data: {
            recordsProcessed: { increment: result.recordsProcessed },
            recordsFailed: { increment: result.recordsFailed },
            partialFailure: result.partialFailure,
          },
        });
      },
    });

    const updated = await prisma.connectorSync.update({
      where: { id: sync.id },
      data: {
        status: output.status,
        completedAt: output.status === "CANCELLED" ? null : new Date(),
        cancelledAt: output.status === "CANCELLED" ? new Date() : null,
        errorMessage: output.errorMessage,
        partialFailure: output.partialFailure,
      },
    });

    await prisma.connectorAccount.update({
      where: { id: account.id },
      data: {
        lastSyncAttemptAt: new Date(),
        lastSuccessfulSyncAt:
          output.status === "COMPLETED" ? new Date() : account.lastSuccessfulSyncAt,
        lastErrorAt: output.errorMessage ? new Date() : account.lastErrorAt,
        lastErrorMessage: output.errorMessage ?? null,
        status: output.status === "FAILED" ? "ERROR" : account.status,
      },
    });

    if (output.errorMessage) {
      await prisma.connectorError.create({
        data: {
          organisationId: input.organisationId,
          projectId: input.projectId,
          brandId: input.brandId,
          connectorAccountId: input.connectorAccountId,
          connectorSyncId: sync.id,
          category: output.status === "FAILED" ? "PROVIDER" : "INTERNAL",
          message: output.errorMessage,
          retryable: output.status !== "CANCELLED",
        },
      });
    }

    return updated;
  },

  async markFailed(syncId: string, connectorAccountId: string, message: string) {
    await prisma.connectorSync.update({
      where: { id: syncId },
      data: {
        status: "FAILED",
        errorMessage: message,
        completedAt: new Date(),
        partialFailure: true,
      },
    });

    await prisma.connectorAccount.update({
      where: { id: connectorAccountId },
      data: {
        status: "ERROR",
        lastErrorAt: new Date(),
        lastErrorMessage: message,
      },
    });
  },
};
