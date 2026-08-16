import { createHash } from "node:crypto";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logging";
import { getSocialAnalyticsAdapter } from "@/lib/social/analytics-adapters";
import type { TenantContext } from "@/lib/tenancy/context";
import { tokenLifecycleService } from "@/server/services/token-lifecycle-service";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");

export const publicationAnalyticsSyncService = {
  async enqueueForPublication(publicationId: string, organisationId: string) {
    const publication = await prisma.publication.findFirst({
      where: { id: publicationId, organisationId },
    });
    if (!publication?.externalPublicationId) return null;

    return prisma.publicationAnalyticsSync.upsert({
      where: { publicationId },
      create: {
        organisationId: publication.organisationId,
        brandId: publication.brandId,
        publicationId: publication.id,
        connectionId: publication.connectionId,
        status: "QUEUED",
        nextSyncAt: new Date(),
      },
      update: {
        status: "QUEUED",
        nextSyncAt: new Date(),
      },
    });
  },

  async syncPublication(
    publicationId: string,
    organisationId: string,
    context: TenantContext,
    options?: { force?: boolean },
  ) {
    const publication = await prisma.publication.findFirst({
      where: { id: publicationId, organisationId },
    });
    if (!publication) throw new AppError("NOT_FOUND", "Publication not found.");
    if (!publication.externalPublicationId) {
      throw new AppError("VALIDATION_ERROR", "Publication has no external post ID yet.");
    }

    const syncRow = await prisma.publicationAnalyticsSync.upsert({
      where: { publicationId },
      create: {
        organisationId: publication.organisationId,
        brandId: publication.brandId,
        publicationId: publication.id,
        connectionId: publication.connectionId,
        status: "RUNNING",
      },
      update: {
        status: "RUNNING",
        attemptCount: { increment: 1 },
      },
    });

    if (
      !options?.force &&
      syncRow.lastSyncedAt &&
      syncRow.lastSyncedAt > new Date(Date.now() - 15 * 60_000)
    ) {
      return { status: "SKIPPED_RECENT", metricsStored: 0 };
    }

    const tokenResult = await tokenLifecycleService.getValidAccessToken(
      { organisationId, actorUserId: context.userProfileId },
      publication.connectionId,
    );

    if (!tokenResult.accessToken) {
      await prisma.publicationAnalyticsSync.update({
        where: { publicationId },
        data: {
          status: "FAILED",
          lastErrorCode: tokenResult.status,
          lastErrorMessage: "Provider connection requires reauthorization for metrics sync.",
        },
      });
      throw new AppError("FORBIDDEN", "Reconnect the provider account to sync metrics.");
    }

    const adapter = getSocialAnalyticsAdapter("INSTAGRAM");
    const cursor =
      (syncRow.syncCursor as { post?: string } | null)?.post ?? undefined;

    try {
      const result = await adapter.fetchPostMetrics({
        accessToken: tokenResult.accessToken,
        providerAccountId: publication.externalAccountId,
        providerPostId: publication.externalPublicationId,
        cursor,
      });

      let stored = 0;
      for (const observation of result.observations) {
        const idempotencyKey = digest(
          `${publication.id}:${observation.metricType}:${observation.metricPeriod}:${observation.measuredAt.toISOString()}`,
        );
        const existing = await prisma.publicationMetric.findUnique({
          where: { idempotencyKey },
        });
        if (existing) continue;

        await prisma.publicationMetric.create({
          data: {
            organisationId: publication.organisationId,
            brandId: publication.brandId,
            publicationId: publication.id,
            connectionId: publication.connectionId,
            externalPublicationId: publication.externalPublicationId,
            metricKey: observation.metricType,
            metricValue: observation.metricValue,
            metricPeriod: observation.metricPeriod.toLowerCase(),
            measuredAt: observation.measuredAt,
            idempotencyKey,
            providerMetadata: { sourceField: observation.sourceField },
          },
        });
        stored += 1;
      }

      await prisma.publicationAnalyticsSync.update({
        where: { publicationId },
        data: {
          status: result.unavailableMetrics.length > 0 ? "PARTIAL" : "COMPLETED",
          lastSyncedAt: new Date(),
          nextSyncAt: new Date(Date.now() + 60 * 60_000),
          syncCursor: result.cursor ? { post: result.cursor } : undefined,
          lastErrorCode: null,
          lastErrorMessage: null,
        },
      });

      return {
        status: "COMPLETED",
        metricsStored: stored,
        unavailableMetrics: result.unavailableMetrics,
      };
    } catch (error) {
      const code =
        error instanceof Error && "code" in error
          ? String((error as { code: string }).code)
          : "PROVIDER_ERROR";
      const retryable = code === "RATE_LIMITED" || code === "TRANSIENT";
      await prisma.publicationAnalyticsSync.update({
        where: { publicationId },
        data: {
          status: code === "RATE_LIMITED" ? "RATE_LIMITED" : "FAILED",
          lastErrorCode: code,
          lastErrorMessage:
            error instanceof Error ? error.message : "Metrics sync failed.",
          nextSyncAt: retryable ? new Date(Date.now() + 30 * 60_000) : null,
        },
      });
      logger.warn("publication.analytics_sync_failed", {
        publicationId,
        code,
      });
      throw error;
    }
  },

  async listMetrics(publicationId: string, organisationId: string) {
    const publication = await prisma.publication.findFirst({
      where: { id: publicationId, organisationId },
      include: {
        analyticsSync: true,
        metrics: { orderBy: { measuredAt: "desc" }, take: 50 },
      },
    });
    if (!publication) throw new AppError("NOT_FOUND", "Publication not found.");

    return {
      publicationId: publication.id,
      externalPublicationId: publication.externalPublicationId,
      providerPermalink: publication.providerPermalink,
      sync: publication.analyticsSync,
      metrics: publication.metrics.map((metric) => ({
        key: metric.metricKey,
        value: Number(metric.metricValue),
        period: metric.metricPeriod,
        measuredAt: metric.measuredAt.toISOString(),
      })),
      awaitingProviderData:
        publication.status === "PUBLISHED" &&
        publication.metrics.length === 0 &&
        (!publication.analyticsSync ||
          publication.analyticsSync.status === "QUEUED" ||
          publication.analyticsSync.status === "RUNNING"),
    };
  },

  async processDueSyncs(limit = 25) {
    const due = await prisma.publicationAnalyticsSync.findMany({
      where: {
        status: { in: ["QUEUED", "RATE_LIMITED"] },
        OR: [{ nextSyncAt: null }, { nextSyncAt: { lte: new Date() } }],
      },
      orderBy: { nextSyncAt: "asc" },
      take: limit,
      include: { publication: true },
    });

    const processed: string[] = [];
    for (const row of due) {
      try {
        await this.syncPublication(row.publicationId, row.organisationId, {
          organisationId: row.organisationId,
          userProfileId: row.publication.requestedByUserId,
          userId: row.publication.requestedByUserId,
          organisationRole: "ADMIN",
          projectId: row.publication.projectId,
          brandId: row.publication.brandId,
        });
        processed.push(row.publicationId);
      } catch {
        // Row updated with failure state inside syncPublication.
      }
    }
    return processed;
  },
};
