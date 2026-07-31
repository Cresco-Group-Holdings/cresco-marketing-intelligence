import type { Prisma, SeoRankChangeType } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { shouldTriggerAlert } from "@/lib/rank-tracking/alerts";
import { buildIdempotencyKey, validateObservationRow } from "@/lib/rank-tracking/observation-import";
import { detectVolatilitySignals } from "@/lib/rank-tracking/volatility";
import type { TenantContext } from "@/lib/tenancy/context";
import { brandService } from "@/server/services/workspace-service";

export const seoRankObservationService = {
  async importObservations(
    brandId: string,
    organisationId: string,
    trackedKeywordId: string,
    rows: Array<{
      source: "SEARCH_CONSOLE" | "RANK_PROVIDER" | "MANUAL_IMPORT" | "COMPLIANT_SERP";
      observedDate: string;
      rank: number | null;
      rankingUrl?: string | null;
      impressions?: number | null;
      clicks?: number | null;
      ctr?: number | null;
      providerMetadata?: Record<string, unknown>;
    }>,
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const tracked = await prisma.seoTrackedKeyword.findFirst({
      where: { id: trackedKeywordId, organisationId, brandId },
      include: { trackingProject: true },
    });
    if (!tracked) throw new AppError("NOT_FOUND", "Tracked keyword not found.");

    const created = [];
    for (const row of rows) {
      const fullRow = {
        ...row,
        keyword: tracked.keyword,
        location: tracked.country,
        language: tracked.language,
        device: tracked.device,
      };
      const errors = validateObservationRow(fullRow);
      if (errors.length) continue;

      let rankingUrlId: string | undefined;
      if (row.rankingUrl) {
        const url = await prisma.seoRankingUrl.upsert({
          where: { trackedKeywordId_url: { trackedKeywordId, url: row.rankingUrl } },
          create: {
            organisationId,
            trackedKeywordId,
            url: row.rankingUrl,
            isTarget: tracked.targetPageId != null,
          },
          update: { lastSeenAt: new Date() },
        });
        rankingUrlId = url.id;
      }

      const idempotencyKey = buildIdempotencyKey(fullRow, trackedKeywordId);
      const obs = await prisma.seoRankObservation.upsert({
        where: {
          trackedKeywordId_source_observedDate_device_resultType: {
            trackedKeywordId,
            source: row.source,
            observedDate: new Date(row.observedDate),
            device: tracked.device,
            resultType: "ORGANIC",
          },
        },
        create: {
          organisationId,
          trackedKeywordId,
          source: row.source,
          keyword: tracked.keyword,
          location: tracked.country,
          language: tracked.language,
          device: tracked.device,
          observedDate: new Date(row.observedDate),
          rank: row.rank,
          rankingUrlId,
          impressions: row.impressions,
          clicks: row.clicks,
          ctr: row.ctr,
          providerMetadata: (row.providerMetadata ?? undefined) as Prisma.InputJsonValue | undefined,
          idempotencyKey,
        },
        update: {
          rank: row.rank,
          rankingUrlId,
          impressions: row.impressions,
          clicks: row.clicks,
          ctr: row.ctr,
          providerMetadata: (row.providerMetadata ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
      created.push(obs);
    }

    await this.detectChanges(trackedKeywordId, tracked.trackingProjectId, organisationId);
    await prisma.seoRankTrackingProject.update({
      where: { id: tracked.trackingProjectId },
      data: { lastSyncAt: new Date(), lastSyncSource: rows[0]?.source, lastSyncStatus: "SUCCESS" },
    });

    return created;
  },

  async detectChanges(trackedKeywordId: string, trackingProjectId: string, organisationId: string) {
    const observations = await prisma.seoRankObservation.findMany({
      where: { trackedKeywordId },
      orderBy: { observedDate: "asc" },
      include: { rankingUrl: true },
    });

    if (observations.length < 2) return;

    const points = observations.map((o) => ({
      observedDate: o.observedDate.toISOString().slice(0, 10),
      rank: o.rank,
      url: o.rankingUrl?.url,
      impressions: o.impressions,
      clicks: o.clicks,
    }));

    const signals = detectVolatilitySignals(points);
    const lastAlert = await prisma.seoRankChange.findFirst({
      where: { trackedKeywordId, isAlert: true },
      orderBy: { alertSentAt: "desc" },
    });

    for (const signal of signals) {
      const current = observations.at(-1)!;
      const previous = observations.at(-2)!;
      const isAlert = shouldTriggerAlert(
        { ...signal, trackedKeywordId },
        lastAlert?.alertSentAt,
        current.impressions,
      );

      await prisma.seoRankChange.create({
        data: {
          organisationId,
          trackingProjectId,
          trackedKeywordId,
          changeType: signal.changeType as SeoRankChangeType,
          severity: signal.severity,
          previousRank: previous.rank,
          currentRank: current.rank,
          previousUrl: previous.rankingUrl?.url,
          currentUrl: current.rankingUrl?.url,
          evidence: signal.evidence as Prisma.InputJsonValue,
          isAlert,
          alertSentAt: isAlert ? new Date() : undefined,
        },
      });
    }
  },
};
