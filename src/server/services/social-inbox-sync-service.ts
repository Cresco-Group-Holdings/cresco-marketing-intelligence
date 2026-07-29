import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { getInboxSyncConfig } from "@/lib/inbox/config";
import {
  getSocialInboxAdapter,
  SocialInboxProviderError,
} from "@/lib/inbox/adapters";
import type { InboxAccountScope } from "@/lib/inbox/types";
import type { TenantContext } from "@/lib/tenancy/context";
import { socialInboxIngestService } from "@/server/services/social-inbox-ingest-service";
import {
  socialCredentialService,
  type StoredSocialTokens,
} from "@/server/services/social-credential-service";
import { brandService } from "@/server/services/workspace-service";

export type InboxSyncType = "INITIAL" | "INCREMENTAL" | "SCHEDULED";

type SyncCursor = {
  page?: string;
};

type ProcessResult = {
  status: "COMPLETED" | "PARTIAL" | "FAILED";
  itemsProcessed: number;
};

function toProviderError(error: unknown) {
  return error instanceof SocialInboxProviderError
    ? error
    : new SocialInboxProviderError(
        "PROVIDER_ERROR",
        error instanceof Error ? error.message : "Inbox sync failed.",
        false,
      );
}

export const socialInboxSyncService = {
  async processDue(limit = getInboxSyncConfig().maxSyncsPerWorkerRun) {
    const now = new Date();
    const take = Math.min(Math.max(limit, 1), 50);
    const due = await prisma.socialInboxSync.findMany({
      where: {
        status: { in: ["QUEUED", "PARTIAL"] },
        OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }],
        AND: [{ OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }] }],
      },
      orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }],
      take,
      select: { id: true },
    });

    const results = [];
    for (const item of due) {
      results.push({
        syncId: item.id,
        result: await this.process(item.id),
      });
    }
    return results;
  },

  async enqueue(
    brandId: string,
    organisationId: string,
    input: {
      socialAccountId: string;
      syncType: InboxSyncType;
      idempotencyKey: string;
      scheduledFor?: Date;
    },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const account = await prisma.socialAccount.findFirst({
      where: {
        id: input.socialAccountId,
        organisationId,
        brandId,
        status: "CONNECTED",
        socialConnection: { status: "CONNECTED" },
        capabilities: { some: { capability: { in: ["READ_COMMENTS", "READ_MESSAGES"] } } },
      },
    });
    if (!account) {
      throw new AppError(
        "VALIDATION_ERROR",
        "The account is not connected or does not expose inbox read capabilities.",
      );
    }

    return prisma.socialInboxSync.upsert({
      where: { idempotencyKey: input.idempotencyKey },
      create: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        socialAccountId: account.id,
        provider: account.provider,
        syncType: input.syncType,
        idempotencyKey: input.idempotencyKey,
        scheduledFor: input.scheduledFor,
        createdByUserId: context.userProfileId,
      },
      update: {},
    });
  },

  async process(syncId: string): Promise<ProcessResult | null> {
    const config = getInboxSyncConfig();
    const now = new Date();
    const sync = await prisma.socialInboxSync.findUnique({ where: { id: syncId } });
    if (!sync) return null;
    if (!["QUEUED", "PARTIAL"].includes(sync.status)) return null;
    if (sync.nextRetryAt && sync.nextRetryAt.getTime() > now.getTime()) return null;
    if (sync.attemptCount >= sync.maxAttempts) {
      await prisma.socialInboxSync.update({
        where: { id: syncId },
        data: {
          status: "FAILED",
          lastError: "The inbox sync exceeded its retry budget.",
          completedAt: new Date(),
        },
      });
      return { status: "FAILED", itemsProcessed: sync.itemsProcessed };
    }

    const claimed = await prisma.socialInboxSync.updateMany({
      where: { id: syncId, status: sync.status, attemptCount: sync.attemptCount },
      data: {
        status: "RUNNING",
        startedAt: sync.startedAt ?? now,
        attemptCount: { increment: 1 },
      },
    });
    if (claimed.count === 0) return null;

    const account = await prisma.socialAccount.findFirst({
      where: {
        id: sync.socialAccountId,
        organisationId: sync.organisationId,
        brandId: sync.brandId,
        status: "CONNECTED",
      },
      include: { socialConnection: true },
    });
    if (
      !account ||
      account.provider !== sync.provider ||
      account.organisationId !== sync.organisationId ||
      account.brandId !== sync.brandId
    ) {
      await prisma.socialInboxSync.update({
        where: { id: syncId },
        data: {
          status: "FAILED",
          lastError: "Inbox sync account is outside the tenant scope.",
          completedAt: new Date(),
        },
      });
      throw new AppError("FORBIDDEN", "Inbox sync account is outside the tenant scope.");
    }

    const tokens: StoredSocialTokens | null = await socialCredentialService.readTokens(
      account.socialConnectionId,
    );
    if (!tokens) {
      await prisma.socialInboxSync.update({
        where: { id: syncId },
        data: {
          status: "FAILED",
          lastError: "Inbox credentials are unavailable.",
          completedAt: new Date(),
        },
      });
      throw new AppError("VALIDATION_ERROR", "Inbox credentials are unavailable.");
    }

    const scope: InboxAccountScope = {
      organisationId: sync.organisationId,
      projectId: sync.projectId,
      brandId: sync.brandId,
      socialAccountId: sync.socialAccountId,
      provider: sync.provider,
    };
    const adapter = getSocialInboxAdapter(sync.provider);
    let cursor: SyncCursor = (sync.cursor as SyncCursor | null) ?? {};
    let itemsProcessed = sync.itemsProcessed;
    let rateLimited = false;

    for (let page = 0; page < config.maxPagesPerRun; page += 1) {
      try {
        const result = await adapter.fetchPage({
          accessToken: tokens.accessToken,
          providerAccountId: account.providerAccountId,
          cursor: cursor.page,
        });
        const ingest = await socialInboxIngestService.ingestBatch(scope, {
          idempotencyKey: `${sync.idempotencyKey}:page:${page}:${cursor.page ?? "start"}`,
          ...result.batch,
        });
        if (!ingest.skipped) {
          itemsProcessed +=
            ingest.participantsUpserted +
            ingest.conversationsUpserted +
            ingest.messagesUpserted +
            ingest.commentsUpserted +
            ingest.mentionsUpserted;
        }
        cursor = { page: result.cursor };
        await prisma.socialInboxSync.update({
          where: { id: syncId },
          data: {
            cursor: cursor as Prisma.InputJsonValue,
            itemsProcessed,
          },
        });
        if (!result.hasMore || !result.cursor) {
          break;
        }
      } catch (error) {
        const providerError = toProviderError(error);
        if (providerError.code === "RATE_LIMITED") {
          rateLimited = true;
          break;
        }
        await prisma.socialInboxSync.update({
          where: { id: syncId },
          data: {
            status: "FAILED",
            cursor: cursor as Prisma.InputJsonValue,
            itemsProcessed,
            lastError: providerError.message,
            completedAt: new Date(),
          },
        });
        return { status: "FAILED", itemsProcessed };
      }
    }

    const status = rateLimited ? "PARTIAL" : "COMPLETED";
    await prisma.socialInboxSync.update({
      where: { id: syncId },
      data: {
        status,
        cursor: cursor as Prisma.InputJsonValue,
        itemsProcessed,
        completedAt: status === "COMPLETED" ? new Date() : undefined,
        nextRetryAt:
          status === "PARTIAL"
            ? new Date(Date.now() + config.retryBackoffSeconds * 1_000)
            : null,
      },
    });

    return { status, itemsProcessed };
  },
};
