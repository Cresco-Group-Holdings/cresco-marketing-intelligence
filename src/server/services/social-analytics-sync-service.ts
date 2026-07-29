import { createHash } from "node:crypto";
import { Prisma, type SocialProvider } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import {
  SocialAnalyticsProviderError,
  getSocialAnalyticsAdapter,
  type AnalyticsFetchResult,
} from "@/lib/social/analytics-adapters";
import { SOCIAL_METRIC_REGISTRY } from "@/lib/social/metric-registry";
import type { TenantContext } from "@/lib/tenancy/context";
import { socialCredentialService } from "@/server/services/social-credential-service";
import { brandService } from "@/server/services/workspace-service";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");

async function ensureDefinitions() {
  for (const definition of SOCIAL_METRIC_REGISTRY) {
    await prisma.socialMetricDefinition.upsert({
      where: {
        provider_providerSourceField_metricScope: {
          provider: definition.provider,
          providerSourceField: definition.providerSourceField,
          metricScope: definition.scope,
        },
      },
      create: {
        canonicalName: definition.canonicalName,
        provider: definition.provider,
        providerSourceField: definition.providerSourceField,
        unit: definition.unit,
        aggregationRule: definition.aggregationRule,
        cumulative: definition.cumulative,
        metricScope: definition.scope,
        limitations: definition.limitations,
      },
      update: {
        canonicalName: definition.canonicalName,
        unit: definition.unit,
        aggregationRule: definition.aggregationRule,
        cumulative: definition.cumulative,
        limitations: definition.limitations,
        active: true,
      },
    });
  }
}

async function persistResult(input: {
  syncId: string;
  scope: {
    organisationId: string;
    projectId: string;
    brandId: string;
    socialAccountId: string;
    provider: SocialProvider;
  };
  entityId: string;
  metricScope: "POST" | "ACCOUNT";
  result: AnalyticsFetchResult;
  contentItemId?: string;
  contentVariantId?: string;
}) {
  const idempotencyKey = digest(`${input.syncId}:${input.metricScope}:${input.entityId}`);
  const existing = await prisma.socialMetricSnapshot.findUnique({
    where: { idempotencyKey },
  });
  if (existing) return 0;

  const measuredAt = input.result.observations[0]?.measuredAt ?? new Date();
  await prisma.socialMetricSnapshot.create({
    data: {
      ...input.scope,
      providerEntityId: input.entityId,
      metricScope: input.metricScope,
      measuredAt,
      idempotencyKey,
      providerMetadata: input.result.raw as Prisma.InputJsonValue,
    },
  });

  if (input.metricScope === "POST") {
    if (input.result.observations.length) {
      await prisma.socialPostMetric.createMany({
        data: input.result.observations.map((metric) => ({
          ...input.scope,
          contentItemId: input.contentItemId,
          contentVariantId: input.contentVariantId,
          providerPostId: input.entityId,
          metricType: metric.metricType,
          metricValue: metric.metricValue,
          measuredAt,
          metricPeriod: metric.metricPeriod,
          providerMetadata: {
            sourceField: metric.sourceField,
          },
        })),
        skipDuplicates: true,
      });
    }
  } else if (input.result.observations.length) {
    await prisma.socialAccountMetric.createMany({
      data: input.result.observations.map((metric) => ({
        ...input.scope,
        metricType: metric.metricType,
        metricValue: metric.metricValue,
        measuredAt,
        metricPeriod: metric.metricPeriod,
        providerMetadata: { sourceField: metric.sourceField },
      })),
      skipDuplicates: true,
    });
  }
  return input.result.observations.length;
}

export const socialAnalyticsSyncService = {
  async processDue(limit = 10) {
    const due = await prisma.socialAnalyticsSync.findMany({
      where: {
        status: { in: ["QUEUED", "PARTIAL"] },
        OR: [{ scheduledFor: null }, { scheduledFor: { lte: new Date() } }],
        AND: [
          {
            OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }],
          },
        ],
      },
      orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }],
      take: Math.min(Math.max(limit, 1), 50),
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
      syncType: "INITIAL" | "INCREMENTAL" | "SCHEDULED";
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
        capabilities: { some: { capability: "READ_INSIGHTS" } },
      },
    });
    if (!account) {
      throw new AppError(
        "VALIDATION_ERROR",
        "The account is not connected or does not expose analytics.",
      );
    }
    await ensureDefinitions();
    return prisma.socialAnalyticsSync.upsert({
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

  async process(syncId: string) {
    const sync = await prisma.socialAnalyticsSync.findFirst({
      where: {
        id: syncId,
        status: { in: ["QUEUED", "PARTIAL", "FAILED"] },
        attemptCount: { lt: 3 },
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }],
      },
    });
    if (!sync) return null;
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
      throw new AppError("FORBIDDEN", "Analytics sync account is outside the tenant scope.");
    }
    const tokens = await socialCredentialService.readTokens(account.socialConnectionId);
    if (!tokens) throw new AppError("VALIDATION_ERROR", "Analytics credentials are unavailable.");

    await prisma.socialAnalyticsSync.update({
      where: { id: sync.id },
      data: {
        status: "RUNNING",
        attemptCount: { increment: 1 },
        startedAt: new Date(),
      },
    });

    const adapter = getSocialAnalyticsAdapter(sync.provider);
    const scope = {
      organisationId: sync.organisationId,
      projectId: sync.projectId,
      brandId: sync.brandId,
      socialAccountId: sync.socialAccountId,
      provider: sync.provider,
    };
    let postsProcessed = 0;
    let metricsStored = 0;
    let failures = 0;
    const unavailable = new Set<string>();
    let cursor = (sync.cursor as { account?: string; posts?: string } | null) ?? {};

    const recordError = async (error: unknown, providerPostId?: string) => {
      const providerError =
        error instanceof SocialAnalyticsProviderError
          ? error
          : new SocialAnalyticsProviderError(
              "PROVIDER_ERROR",
              error instanceof Error ? error.message : "Analytics sync failed.",
              false,
            );
      await prisma.socialAnalyticsError.create({
        data: {
          ...scope,
          socialAnalyticsSyncId: sync.id,
          providerPostId,
          category: providerError.code,
          providerCode: providerError.code,
          message: providerError.message,
          retryable: providerError.retryable,
        },
      });
      failures += 1;
      return providerError;
    };

    try {
      const accountResult = await adapter.fetchAccountMetrics({
        accessToken: tokens.accessToken,
        providerAccountId: account.providerAccountId,
        cursor: cursor.account,
      });
      metricsStored += await persistResult({
        syncId: sync.id,
        scope,
        entityId: account.providerAccountId,
        metricScope: "ACCOUNT",
        result: accountResult,
      });
      accountResult.unavailableMetrics.forEach((metric) => unavailable.add(metric));
      cursor = { ...cursor, account: accountResult.cursor };
    } catch (error) {
      const providerError = await recordError(error);
      if (providerError.code === "RATE_LIMITED" || providerError.code === "TOKEN_EXPIRED") {
        await prisma.socialAnalyticsSync.update({
          where: { id: sync.id },
          data: {
            status: "PARTIAL",
            cursor,
            nextRetryAt: new Date(Date.now() + 60_000),
          },
        });
        return {
          status: "PARTIAL",
          postsProcessed,
          metricsStored,
        };
      }
    }

    const jobs = await prisma.publishingJob.findMany({
      where: {
        organisationId: sync.organisationId,
        brandId: sync.brandId,
        status: "COMPLETED",
        contentScheduleId: { not: "" },
        schedule: { socialAccountId: sync.socialAccountId },
      },
      include: {
        schedule: {
          include: {
            contentVariant: true,
            contentItem: true,
          },
        },
      },
      orderBy: { updatedAt: "asc" },
    });

    let rateLimited = false;
    for (const job of jobs) {
      const ids = new Set<string>();
      if (job.publishedMediaId) ids.add(job.publishedMediaId);
      const threadIds = (
        job.providerUploadState as {
          postIds?: string[];
        } | null
      )?.postIds;
      threadIds?.forEach((id) => ids.add(id));

      for (const providerPostId of ids) {
        const snapshotKey = digest(`${sync.id}:POST:${providerPostId}`);
        if (
          await prisma.socialMetricSnapshot.findUnique({
            where: { idempotencyKey: snapshotKey },
          })
        ) {
          continue;
        }
        try {
          const result = await adapter.fetchPostMetrics({
            accessToken: tokens.accessToken,
            providerAccountId: account.providerAccountId,
            providerPostId,
            cursor: cursor.posts,
          });
          metricsStored += await persistResult({
            syncId: sync.id,
            scope,
            entityId: providerPostId,
            metricScope: "POST",
            result,
            contentItemId: job.schedule.contentItemId,
            contentVariantId: job.schedule.contentVariantId,
          });
          result.unavailableMetrics.forEach((metric) => unavailable.add(metric));
          cursor = { ...cursor, posts: result.cursor };
          postsProcessed += 1;
        } catch (error) {
          const providerError = await recordError(error, providerPostId);
          if (providerError.code === "DELETED_POST") {
            postsProcessed += 1;
            continue;
          }
          if (providerError.code === "RATE_LIMITED") {
            rateLimited = true;
            break;
          }
        }
      }
      if (rateLimited) break;
    }

    const status = failures ? "PARTIAL" : "COMPLETED";
    await prisma.socialAnalyticsSync.update({
      where: { id: sync.id },
      data: {
        status,
        cursor,
        postsProcessed,
        metricsStored,
        unavailableMetrics: [...unavailable],
        completedAt: status === "COMPLETED" ? new Date() : undefined,
        nextRetryAt: status === "PARTIAL" ? new Date(Date.now() + 60_000) : null,
      },
    });
    return { status, postsProcessed, metricsStored };
  },
};
