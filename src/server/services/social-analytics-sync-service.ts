import { createHash, randomUUID } from "node:crypto";
import { Prisma, type SocialProvider } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logging";
import { getAnalyticsSyncConfig } from "@/lib/analytics/config";
import { incrementAnalyticsCounter } from "@/lib/analytics/observability";
import {
  SocialAnalyticsProviderError,
  getSocialAnalyticsAdapter,
  type AnalyticsFetchResult,
  type SocialAnalyticsAdapter,
} from "@/lib/social/analytics-adapters";
import { SOCIAL_METRIC_REGISTRY } from "@/lib/social/metric-registry";
import type { TenantContext } from "@/lib/tenancy/context";
import { socialAnalyticsCredentialService } from "@/server/services/social-analytics-credential-service";
import {
  socialCredentialService,
  type StoredSocialTokens,
} from "@/server/services/social-credential-service";
import { brandService } from "@/server/services/workspace-service";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");

export type SyncType = "INITIAL" | "INCREMENTAL" | "SCHEDULED" | "BACKFILL";

type SyncCursor = {
  account?: string;
  posts?: string;
  discovery?: string;
};

type ProcessResult = {
  status: "COMPLETED" | "PARTIAL" | "FAILED" | "REQUEUED_AFTER_REFRESH";
  postsProcessed: number;
  metricsStored: number;
  recovered?: boolean;
};

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

/**
 * A snapshot row is the idempotency anchor for one entity within one sync. Metric rows additionally
 * carry a natural unique key, so a replay after a crash can never double-count an observation.
 */
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
  providerPublishedAt?: Date;
  discoverySource?: string;
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
          providerPublishedAt: input.providerPublishedAt,
          discoverySource: input.discoverySource ?? "PLATFORM_PUBLISHING",
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

function toProviderError(error: unknown) {
  return error instanceof SocialAnalyticsProviderError
    ? error
    : new SocialAnalyticsProviderError(
        "PROVIDER_ERROR",
        error instanceof Error ? error.message : "Analytics sync failed.",
        false,
      );
}

export const socialAnalyticsSyncService = {
  /**
   * Selects work for one worker pass: queued or partially complete syncs whose retry time has
   * elapsed, plus RUNNING syncs whose worker lease expired because the process died mid-run.
   */
  async processDue(limit = getAnalyticsSyncConfig().maxSyncsPerWorkerRun, workerId?: string) {
    const now = new Date();
    const take = Math.min(Math.max(limit, 1), 50);
    const due = await prisma.socialAnalyticsSync.findMany({
      where: {
        OR: [
          {
            status: { in: ["QUEUED", "PARTIAL"] },
            AND: [
              { OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }] },
              { OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }] },
            ],
          },
          { status: "RUNNING", leaseExpiresAt: { lt: now } },
        ],
      },
      orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }],
      take,
      select: { id: true },
    });

    const results = [];
    for (const item of due) {
      results.push({
        syncId: item.id,
        result: await this.process(item.id, workerId),
      });
    }
    return results;
  },

  async enqueue(
    brandId: string,
    organisationId: string,
    input: {
      socialAccountId: string;
      syncType: SyncType;
      idempotencyKey: string;
      scheduledFor?: Date;
      backfillFrom?: Date;
      backfillTo?: Date;
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

    const config = getAnalyticsSyncConfig();
    const wantsBackfill = input.syncType === "INITIAL" || input.syncType === "BACKFILL";
    const backfillTo = input.backfillTo ?? (wantsBackfill ? new Date() : undefined);
    const backfillFrom =
      input.backfillFrom ??
      (wantsBackfill && backfillTo
        ? new Date(backfillTo.getTime() - config.backfillDays * 86_400_000)
        : undefined);
    if (backfillFrom && backfillTo && backfillFrom >= backfillTo) {
      throw new AppError("VALIDATION_ERROR", "The backfill range must start before it ends.");
    }

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
        backfillFrom,
        backfillTo,
        createdByUserId: context.userProfileId,
      },
      update: {},
    });
  },

  /**
   * Atomically takes ownership of a sync. The where clause pins the observed lease and worker so
   * two concurrent workers racing on the same row cannot both win the claim.
   */
  async claim(syncId: string, workerId: string) {
    const config = getAnalyticsSyncConfig();
    const now = new Date();
    const existing = await prisma.socialAnalyticsSync.findUnique({ where: { id: syncId } });
    if (!existing) return null;

    const leaseExpired = Boolean(
      existing.leaseExpiresAt && existing.leaseExpiresAt.getTime() < now.getTime(),
    );
    const isRecovery = existing.status === "RUNNING" && leaseExpired;

    if (existing.status === "RUNNING" && !leaseExpired) return null;
    if (["COMPLETED", "CANCELLED"].includes(existing.status)) return null;
    if (!isRecovery && existing.status === "FAILED" && existing.attemptCount >= existing.maxAttempts)
      return null;
    if (
      !isRecovery &&
      existing.nextRetryAt &&
      existing.nextRetryAt.getTime() > now.getTime() &&
      existing.status !== "QUEUED"
    )
      return null;

    if (isRecovery && existing.recoveryCount >= existing.maxRecoveries) {
      await this.failTerminally(
        existing.id,
        "The analytics sync exceeded its crash-recovery budget and requires manual investigation.",
      );
      return null;
    }
    if (!isRecovery && existing.attemptCount >= existing.maxAttempts) {
      await this.failTerminally(
        existing.id,
        "The analytics sync exceeded its retry budget without completing.",
      );
      return null;
    }

    const claimed = await prisma.socialAnalyticsSync.updateMany({
      where: {
        id: existing.id,
        status: existing.status,
        workerId: existing.workerId,
        leaseExpiresAt: existing.leaseExpiresAt,
      },
      data: {
        status: "RUNNING",
        workerId,
        startedAt: existing.startedAt ?? now,
        heartbeatAt: now,
        leaseExpiresAt: new Date(now.getTime() + config.leaseSeconds * 1_000),
        attemptCount: { increment: isRecovery ? 0 : 1 },
        recoveryCount: { increment: isRecovery ? 1 : 0 },
        nextRetryAt: null,
      },
    });
    if (claimed.count === 0) return null;

    if (isRecovery) {
      incrementAnalyticsCounter("analytics.stale_jobs_reclaimed", 1, {
        syncId: existing.id,
        organisationId: existing.organisationId,
        brandId: existing.brandId,
        provider: existing.provider,
        recoveryCount: existing.recoveryCount + 1,
      });
    }

    const sync = await prisma.socialAnalyticsSync.findUnique({ where: { id: existing.id } });
    return sync ? { sync, recovered: isRecovery } : null;
  },

  async failTerminally(syncId: string, message: string) {
    const sync = await prisma.socialAnalyticsSync.findUnique({ where: { id: syncId } });
    if (!sync) return;
    await prisma.socialAnalyticsSync.update({
      where: { id: syncId },
      data: {
        status: "FAILED",
        lastError: message,
        workerId: null,
        leaseExpiresAt: null,
        nextRetryAt: null,
        completedAt: new Date(),
      },
    });
    await prisma.socialAnalyticsError.create({
      data: {
        organisationId: sync.organisationId,
        projectId: sync.projectId,
        brandId: sync.brandId,
        socialAccountId: sync.socialAccountId,
        provider: sync.provider,
        socialAnalyticsSyncId: sync.id,
        syncPhase: "LIFECYCLE",
        category: "TERMINAL",
        message,
        retryable: false,
        terminal: true,
      },
    });
    incrementAnalyticsCounter("analytics.failed_syncs", 1, {
      syncId,
      organisationId: sync.organisationId,
      brandId: sync.brandId,
      provider: sync.provider,
    });
  },

  async process(syncId: string, workerId = `worker-${randomUUID()}`): Promise<ProcessResult | null> {
    const config = getAnalyticsSyncConfig();
    const claim = await this.claim(syncId, workerId);
    if (!claim) return null;
    const { sync, recovered } = claim;

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
      account.brandId !== sync.brandId ||
      account.socialConnection.organisationId !== sync.organisationId ||
      account.socialConnection.brandId !== sync.brandId
    ) {
      await this.release(sync.id, workerId, {
        status: "FAILED",
        lastError: "Analytics sync account is outside the tenant scope.",
      });
      throw new AppError("FORBIDDEN", "Analytics sync account is outside the tenant scope.");
    }

    let tokens: StoredSocialTokens | null = await socialCredentialService.readTokens(
      account.socialConnectionId,
    );
    if (!tokens) {
      await this.release(sync.id, workerId, {
        status: "FAILED",
        lastError: "Analytics credentials are unavailable.",
      });
      throw new AppError("VALIDATION_ERROR", "Analytics credentials are unavailable.");
    }

    const adapter = getSocialAnalyticsAdapter(sync.provider);
    const scope = {
      organisationId: sync.organisationId,
      projectId: sync.projectId,
      brandId: sync.brandId,
      socialAccountId: sync.socialAccountId,
      provider: sync.provider,
    };

    let postsProcessed = sync.postsProcessed;
    let metricsStored = sync.metricsStored;
    let failures = 0;
    const unavailable = new Set<string>(sync.unavailableMetrics);
    let cursor: SyncCursor = (sync.cursor as SyncCursor | null) ?? {};
    let backfillCompleted = sync.backfillCompleted;

    const heartbeat = async (data: Prisma.SocialAnalyticsSyncUpdateManyMutationInput = {}) => {
      const now = new Date();
      await prisma.socialAnalyticsSync.updateMany({
        where: { id: sync.id, workerId },
        data: {
          ...data,
          heartbeatAt: now,
          leaseExpiresAt: new Date(now.getTime() + config.leaseSeconds * 1_000),
        },
      });
    };

    const recordError = async (
      error: unknown,
      phase: string,
      providerPostId?: string,
      terminal = false,
    ) => {
      const providerError = toProviderError(error);
      await prisma.socialAnalyticsError.create({
        data: {
          ...scope,
          socialAnalyticsSyncId: sync.id,
          providerPostId,
          syncPhase: phase,
          category: providerError.code,
          providerCode: providerError.code,
          message: providerError.message,
          retryable: providerError.retryable,
          terminal,
        },
      });
      failures += 1;
      if (providerError.code === "RATE_LIMITED") {
        incrementAnalyticsCounter("analytics.rate_limits", 1, {
          syncId: sync.id,
          provider: sync.provider,
        });
      }
      if (terminal) {
        incrementAnalyticsCounter("analytics.terminal_provider_failures", 1, {
          syncId: sync.id,
          provider: sync.provider,
          category: providerError.code,
        });
      }
      return providerError;
    };

    /**
     * Refreshes the credential once per sync and requeues so the run restarts from the persisted
     * cursor with a valid token. A second expiry, or a failed refresh, is terminal.
     */
    const handleTokenExpiry = async (
      error: SocialAnalyticsProviderError,
      phase: string,
    ): Promise<ProcessResult> => {
      await recordError(error, phase, undefined, sync.refreshAttemptCount >= 1);
      if (sync.refreshAttemptCount >= 1) {
        await socialAnalyticsCredentialService.markReconnectRequired({
          socialConnectionId: account.socialConnectionId,
          organisationId: sync.organisationId,
          brandId: sync.brandId,
          reason: "Analytics credentials remained invalid after one refresh.",
        });
        await this.release(sync.id, workerId, {
          status: "FAILED",
          cursor: cursor as Prisma.InputJsonValue,
          postsProcessed,
          metricsStored,
          unavailableMetrics: [...unavailable],
          lastError: "Analytics credentials remained invalid after one refresh. Reconnect the account.",
          completedAt: new Date(),
        });
        return { status: "FAILED", postsProcessed, metricsStored };
      }

      const outcome = await socialAnalyticsCredentialService.refreshForAnalytics({
        provider: sync.provider,
        socialConnectionId: account.socialConnectionId,
        organisationId: sync.organisationId,
        brandId: sync.brandId,
        tokens: tokens as StoredSocialTokens,
      });

      if (outcome.status === "RECONNECT_REQUIRED") {
        await recordError(
          new SocialAnalyticsProviderError("TOKEN_EXPIRED", outcome.reason, false),
          "CREDENTIAL_REFRESH",
          undefined,
          true,
        );
        await this.release(sync.id, workerId, {
          status: "FAILED",
          cursor: cursor as Prisma.InputJsonValue,
          postsProcessed,
          metricsStored,
          unavailableMetrics: [...unavailable],
          refreshAttemptCount: { increment: 1 },
          lastError: outcome.reason,
          completedAt: new Date(),
        });
        return { status: "FAILED", postsProcessed, metricsStored };
      }

      tokens = outcome.tokens;
      await this.release(sync.id, workerId, {
        status: "QUEUED",
        cursor: cursor as Prisma.InputJsonValue,
        postsProcessed,
        metricsStored,
        unavailableMetrics: [...unavailable],
        refreshAttemptCount: { increment: 1 },
        nextRetryAt: new Date(),
        lastError: null,
      });
      return { status: "REQUEUED_AFTER_REFRESH", postsProcessed, metricsStored };
    };

    // Account-level observations.
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
      await heartbeat({ cursor: cursor as Prisma.InputJsonValue, metricsStored });
    } catch (error) {
      const providerError = toProviderError(error);
      if (providerError.code === "TOKEN_EXPIRED") {
        return handleTokenExpiry(providerError, "ACCOUNT_METRICS");
      }
      await recordError(providerError, "ACCOUNT_METRICS");
      if (providerError.code === "RATE_LIMITED") {
        await this.release(sync.id, workerId, {
          status: "PARTIAL",
          cursor: cursor as Prisma.InputJsonValue,
          postsProcessed,
          metricsStored,
          unavailableMetrics: [...unavailable],
          nextRetryAt: new Date(Date.now() + config.retryBackoffSeconds * 1_000),
          lastError: providerError.message,
        });
        incrementAnalyticsCounter("analytics.partial_syncs", 1, { syncId: sync.id });
        return { status: "PARTIAL", postsProcessed, metricsStored, recovered };
      }
    }

    // Posts published through this platform remain the attribution-complete source.
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

    type Target = {
      providerPostId: string;
      contentItemId?: string;
      contentVariantId?: string;
      publishedAt?: Date;
      discoverySource: string;
    };
    const targets = new Map<string, Target>();
    for (const job of jobs) {
      const ids = new Set<string>();
      if (job.publishedMediaId) ids.add(job.publishedMediaId);
      (job.providerUploadState as { postIds?: string[] } | null)?.postIds?.forEach((id) =>
        ids.add(id),
      );
      for (const providerPostId of ids) {
        targets.set(providerPostId, {
          providerPostId,
          contentItemId: job.schedule.contentItemId,
          contentVariantId: job.schedule.contentVariantId,
          discoverySource: "PLATFORM_PUBLISHING",
        });
      }
    }

    // Provider history, where the API exposes it, adds posts created outside this platform.
    const discovery = await this.discoverHistoricalPosts({
      adapter,
      sync,
      accessToken: tokens.accessToken,
      providerAccountId: account.providerAccountId,
      cursor,
      onPage: async (nextCursor) => {
        cursor = { ...cursor, discovery: nextCursor };
        await heartbeat({ cursor: cursor as Prisma.InputJsonValue });
        incrementAnalyticsCounter("analytics.backfill_pages", 1, {
          syncId: sync.id,
          provider: sync.provider,
        });
      },
    }).catch(async (error) => {
      const providerError = toProviderError(error);
      if (providerError.code === "TOKEN_EXPIRED") return { tokenExpired: true } as const;
      await recordError(providerError, "POST_DISCOVERY");
      return { posts: [], completed: false } as const;
    });

    if ("tokenExpired" in discovery) {
      return handleTokenExpiry(
        new SocialAnalyticsProviderError("TOKEN_EXPIRED", "Analytics credentials expired.", true),
        "POST_DISCOVERY",
      );
    }
    for (const post of discovery.posts ?? []) {
      // Platform attribution wins so provider history never overwrites a known content link.
      if (targets.has(post.providerPostId)) continue;
      targets.set(post.providerPostId, {
        providerPostId: post.providerPostId,
        publishedAt: post.publishedAt,
        discoverySource: "PROVIDER_HISTORY",
      });
    }
    backfillCompleted = backfillCompleted || Boolean(discovery.completed);
    if (!adapter.historicalBackfill.supported) {
      unavailable.add(`historicalBackfill:${sync.provider}`);
    }

    let rateLimited = false;
    for (const target of targets.values()) {
      const snapshotKey = digest(`${sync.id}:POST:${target.providerPostId}`);
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
          providerPostId: target.providerPostId,
          cursor: cursor.posts,
        });
        metricsStored += await persistResult({
          syncId: sync.id,
          scope,
          entityId: target.providerPostId,
          metricScope: "POST",
          result,
          contentItemId: target.contentItemId,
          contentVariantId: target.contentVariantId,
          providerPublishedAt: target.publishedAt,
          discoverySource: target.discoverySource,
        });
        result.unavailableMetrics.forEach((metric) => unavailable.add(metric));
        cursor = { ...cursor, posts: result.cursor };
        postsProcessed += 1;
        // Cursor progress is durable per post so a crash resumes mid-range.
        await heartbeat({
          cursor: cursor as Prisma.InputJsonValue,
          postsProcessed,
          metricsStored,
        });
      } catch (error) {
        const providerError = toProviderError(error);
        if (providerError.code === "TOKEN_EXPIRED") {
          return handleTokenExpiry(providerError, "POST_METRICS");
        }
        await recordError(providerError, "POST_METRICS", target.providerPostId);
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

    const status = failures || rateLimited ? "PARTIAL" : "COMPLETED";
    if (unavailable.size) {
      incrementAnalyticsCounter("analytics.unavailable_metrics", unavailable.size, {
        syncId: sync.id,
        provider: sync.provider,
      });
    }
    incrementAnalyticsCounter("analytics.posts_processed", postsProcessed - sync.postsProcessed, {
      syncId: sync.id,
    });
    incrementAnalyticsCounter("analytics.metrics_stored", metricsStored - sync.metricsStored, {
      syncId: sync.id,
    });
    incrementAnalyticsCounter(
      status === "COMPLETED" ? "analytics.completed_syncs" : "analytics.partial_syncs",
      1,
      { syncId: sync.id, provider: sync.provider, organisationId: sync.organisationId },
    );

    await this.release(sync.id, workerId, {
      status,
      cursor: cursor as Prisma.InputJsonValue,
      postsProcessed,
      metricsStored,
      backfillCompleted,
      unavailableMetrics: [...unavailable],
      completedAt: status === "COMPLETED" ? new Date() : undefined,
      nextRetryAt:
        status === "PARTIAL" ? new Date(Date.now() + config.retryBackoffSeconds * 1_000) : null,
    });

    logger.info("analytics.sync_finished", {
      syncId: sync.id,
      provider: sync.provider,
      organisationId: sync.organisationId,
      brandId: sync.brandId,
      status,
      postsProcessed,
      metricsStored,
      recovered,
    });

    return { status, postsProcessed, metricsStored, recovered };
  },

  /** Writes the final state and drops the lease so the row is claimable again if needed. */
  async release(
    syncId: string,
    workerId: string,
    data: Prisma.SocialAnalyticsSyncUpdateManyMutationInput,
  ) {
    await prisma.socialAnalyticsSync.updateMany({
      where: { id: syncId, workerId },
      data: { ...data, workerId: null, leaseExpiresAt: null, heartbeatAt: new Date() },
    });
  },

  /**
   * Walks provider post history for the configured backfill window. Providers without a history
   * API return no posts, and the platform publishing fallback still applies.
   */
  async discoverHistoricalPosts(input: {
    adapter: SocialAnalyticsAdapter;
    sync: { id: string; syncType: string; backfillFrom: Date | null; backfillTo: Date | null; backfillCompleted: boolean };
    accessToken: string;
    providerAccountId: string;
    cursor: SyncCursor;
    onPage: (cursor: string | undefined) => Promise<void>;
  }): Promise<{ posts: Array<{ providerPostId: string; publishedAt?: Date }>; completed: boolean }> {
    const { adapter, sync } = input;
    if (!adapter.discoverPosts || !adapter.historicalBackfill.supported) {
      return { posts: [], completed: true };
    }
    if (sync.backfillCompleted && sync.syncType !== "BACKFILL") {
      return { posts: [], completed: true };
    }
    const config = getAnalyticsSyncConfig();
    const to = sync.backfillTo ?? new Date();
    const from = sync.backfillFrom ?? new Date(to.getTime() - config.backfillDays * 86_400_000);

    const posts: Array<{ providerPostId: string; publishedAt?: Date }> = [];
    let pageCursor = input.cursor.discovery;
    let completed = false;

    for (let page = 0; page < config.maxDiscoveryPagesPerRun; page += 1) {
      const result = await adapter.discoverPosts({
        accessToken: input.accessToken,
        providerAccountId: input.providerAccountId,
        from,
        to,
        cursor: pageCursor,
      });
      posts.push(...result.posts);
      pageCursor = result.cursor;
      await input.onPage(pageCursor);
      if (!result.hasMore || !pageCursor) {
        completed = true;
        break;
      }
    }
    return { posts, completed };
  },
};
