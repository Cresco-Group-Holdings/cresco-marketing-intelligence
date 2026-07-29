import type { SocialProvider } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import type { TenantContext } from "@/lib/tenancy/context";
import {
  averageViewsPerPost,
  clickThroughRate,
  engagementRate,
  followerGrowth,
  publishingConsistency,
} from "@/lib/social/derived-metrics";
import { brandService } from "@/server/services/workspace-service";

type Filters = {
  from: Date;
  to: Date;
  provider?: SocialProvider;
  socialAccountId?: string;
  projectId?: string;
  campaign?: string;
  contentType?: string;
  contentItemId?: string;
  ownerUserId?: string;
};

const publicMetric = <T extends { metricValue: unknown }>(metric: T) => ({
  ...metric,
  metricValue: Number(metric.metricValue),
});

export const socialAnalyticsQueryService = {
  async posts(brandId: string, organisationId: string, filters: Filters, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const metrics = await prisma.socialPostMetric.findMany({
      where: {
        organisationId,
        brandId,
        measuredAt: { gte: filters.from, lte: filters.to },
        ...(filters.provider ? { provider: filters.provider } : {}),
        ...(filters.socialAccountId ? { socialAccountId: filters.socialAccountId } : {}),
        ...(filters.projectId ? { projectId: filters.projectId } : {}),
        ...(filters.contentItemId ? { contentItemId: filters.contentItemId } : {}),
      },
      orderBy: { measuredAt: "desc" },
    });
    const contentIds = [
      ...new Set(
        metrics.map((metric) => metric.contentItemId).filter((id): id is string => Boolean(id)),
      ),
    ];
    const content = await prisma.contentItem.findMany({
      where: {
        id: { in: contentIds },
        organisationId,
        brandId,
        ...(filters.campaign ? { campaignName: filters.campaign } : {}),
        ...(filters.contentType ? { contentType: filters.contentType as never } : {}),
        ...(filters.ownerUserId ? { ownerUserId: filters.ownerUserId } : {}),
      },
      select: {
        id: true,
        title: true,
        campaignName: true,
        objectiveId: true,
        targetAudienceId: true,
        contentPillar: true,
        contentType: true,
        primaryCTA: true,
        destinationUrl: true,
      },
    });
    const attribution = new Map(content.map((item) => [item.id, item]));
    return metrics
      .filter((metric) => !metric.contentItemId || attribution.has(metric.contentItemId))
      .map((metric) => ({
        ...publicMetric(metric),
        attribution: metric.contentItemId ? (attribution.get(metric.contentItemId) ?? null) : null,
      }));
  },

  async accounts(
    brandId: string,
    organisationId: string,
    filters: Filters,
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const metrics = await prisma.socialAccountMetric.findMany({
      where: {
        organisationId,
        brandId,
        measuredAt: { gte: filters.from, lte: filters.to },
        ...(filters.provider ? { provider: filters.provider } : {}),
        ...(filters.socialAccountId ? { socialAccountId: filters.socialAccountId } : {}),
        ...(filters.projectId ? { projectId: filters.projectId } : {}),
      },
      orderBy: { measuredAt: "desc" },
    });
    return metrics.map(publicMetric);
  },

  async overview(
    brandId: string,
    organisationId: string,
    filters: Filters,
    context: TenantContext,
  ) {
    const [posts, accounts, publishedCount] = await Promise.all([
      this.posts(brandId, organisationId, filters, context),
      this.accounts(brandId, organisationId, filters, context),
      prisma.contentSchedule.count({
        where: {
          organisationId,
          brandId,
          status: "COMPLETED",
          scheduledFor: { gte: filters.from, lte: filters.to },
        },
      }),
    ]);
    const latestByPost = new Map<string, Record<string, number>>();
    for (const metric of posts) {
      const values = latestByPost.get(metric.providerPostId) ?? {};
      if (values[metric.metricType] === undefined) {
        values[metric.metricType] = metric.metricValue;
      }
      latestByPost.set(metric.providerPostId, values);
    }
    const aggregate = [...latestByPost.values()].reduce<Record<string, number>>(
      (result, values) => {
        for (const [key, value] of Object.entries(values)) {
          result[key] = (result[key] ?? 0) + value;
        }
        return result;
      },
      {},
    );
    const byProvider = posts.reduce<Record<string, Record<string, number>>>((result, metric) => {
      const channel = result[metric.provider] ?? {};
      channel[metric.metricType] = (channel[metric.metricType] ?? 0) + metric.metricValue;
      result[metric.provider] = channel;
      return result;
    }, {});
    const followerSeries = accounts
      .filter((metric) => ["follows", "subscribers"].includes(metric.metricType))
      .sort((a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime());
    const periodDays = Math.max(1, (filters.to.getTime() - filters.from.getTime()) / 86_400_000);
    return {
      totals: aggregate,
      byProvider,
      derived: {
        engagementRate: engagementRate(aggregate),
        clickThroughRate: clickThroughRate(aggregate),
        averageViewsPerPost: averageViewsPerPost(
          [...latestByPost.values()].map((values) => values.views ?? values.videoViews),
        ),
        followerGrowth: followerGrowth(
          followerSeries[0]?.metricValue,
          followerSeries.at(-1)?.metricValue,
        ),
        publishingConsistency: publishingConsistency(publishedCount, periodDays),
      },
      postsMeasured: latestByPost.size,
      accountsMeasured: new Set(accounts.map((metric) => metric.socialAccountId)).size,
    };
  },

  async export(
    brandId: string,
    organisationId: string,
    filters: Filters,
    scope: "POST" | "ACCOUNT",
    format: "CSV" | "JSON",
    context: TenantContext,
  ) {
    const rows =
      scope === "POST"
        ? await this.posts(brandId, organisationId, filters, context)
        : await this.accounts(brandId, organisationId, filters, context);
    if (format === "JSON")
      return {
        contentType: "application/json",
        body: JSON.stringify(rows),
      };
    const columns =
      scope === "POST"
        ? [
            "provider",
            "socialAccountId",
            "providerPostId",
            "contentItemId",
            "contentVariantId",
            "metricType",
            "metricValue",
            "measuredAt",
            "metricPeriod",
          ]
        : [
            "provider",
            "socialAccountId",
            "metricType",
            "metricValue",
            "measuredAt",
            "metricPeriod",
          ];
    const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    return {
      contentType: "text/csv; charset=utf-8",
      body: [
        columns.join(","),
        ...rows.map((row) =>
          columns
            .map((column) => escape((row as unknown as Record<string, unknown>)[column]))
            .join(","),
        ),
      ].join("\n"),
    };
  },
};
