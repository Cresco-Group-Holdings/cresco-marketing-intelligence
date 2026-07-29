import type { SocialProvider } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import type { TenantContext } from "@/lib/tenancy/context";
import {
  averageViewsPerPost,
  clickThroughRate,
  engagementRate,
  followerGrowth,
  publishingConsistency,
  videoCompletionRate,
} from "@/lib/social/derived-metrics";
import {
  resolveAnalyticsTimezone,
  zonedDayCount,
  zonedPeriodKey,
  zonedRangeToUtc,
  type AnalyticsGranularity,
} from "@/lib/analytics/timezone";
import { brandService } from "@/server/services/workspace-service";

export type Filters = {
  from: Date;
  to: Date;
  timezone?: string;
  granularity?: AnalyticsGranularity;
  provider?: SocialProvider;
  socialAccountId?: string;
  projectId?: string;
  campaign?: string;
  contentType?: string;
  contentItemId?: string;
  contentPillar?: string;
  ownerUserId?: string;
};

export type AttributionDimension =
  | "CONTENT_ITEM"
  | "CAMPAIGN"
  | "CONTENT_PILLAR"
  | "CONTENT_TYPE"
  | "OWNER"
  | "PLATFORM";

export type ExportScope = "POST" | "ACCOUNT" | "ATTRIBUTION";

const publicMetric = <T extends { metricValue: unknown }>(metric: T) => ({
  ...metric,
  metricValue: Number(metric.metricValue),
});

/** Sums only metric types whose canonical definition is additive across posts. */
const ADDITIVE_METRICS = [
  "impressions",
  "reach",
  "views",
  "videoViews",
  "watchTime",
  "likes",
  "reactions",
  "comments",
  "shares",
  "saves",
  "clicks",
  "profileVisits",
] as const;

function addMetric(target: Record<string, number>, metricType: string, value: number) {
  if (!(ADDITIVE_METRICS as readonly string[]).includes(metricType)) return;
  target[metricType] = (target[metricType] ?? 0) + value;
}

/**
 * Derived values are always computed from aggregated numerators and denominators. Averaging
 * post-level percentages would silently weight a 3-impression post the same as a 30,000-impression
 * post, so it is never done here.
 */
function deriveFromAggregate(values: Record<string, number>) {
  return {
    engagementRate: engagementRate(values),
    clickThroughRate: clickThroughRate(values),
    videoCompletionRate: videoCompletionRate(values.completedViews, values.videoViews),
  };
}

async function resolveScope(
  brandId: string,
  organisationId: string,
  filters: Filters,
  context: TenantContext,
) {
  const brand = await brandService.getById(brandId, organisationId, context);
  const organisation = await prisma.organisation.findUnique({
    where: { id: organisationId },
    select: { defaultTimezone: true },
  });
  const timezone = resolveAnalyticsTimezone({
    brandTimezone: brand.analyticsTimezone,
    organisationTimezone: organisation?.defaultTimezone,
    requestedTimezone: filters.timezone,
  });
  const range = zonedRangeToUtc(filters.from, filters.to, timezone);
  return { brand, timezone, range };
}

export const socialAnalyticsQueryService = {
  /** Timezone resolution is exposed so exports and the dashboard can label their boundaries. */
  async resolveTimezone(
    brandId: string,
    organisationId: string,
    filters: Filters,
    context: TenantContext,
  ) {
    const { timezone, range } = await resolveScope(brandId, organisationId, filters, context);
    return { timezone, from: range.from, to: range.to };
  },

  async posts(brandId: string, organisationId: string, filters: Filters, context: TenantContext) {
    const { range } = await resolveScope(brandId, organisationId, filters, context);
    const metrics = await prisma.socialPostMetric.findMany({
      where: {
        organisationId,
        brandId,
        measuredAt: { gte: range.from, lte: range.to },
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
        ...(filters.contentPillar ? { contentPillar: filters.contentPillar } : {}),
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
        ownerUserId: true,
      },
    });
    const attribution = new Map(content.map((item) => [item.id, item]));
    const contentFiltered = Boolean(
      filters.campaign || filters.contentType || filters.ownerUserId || filters.contentPillar,
    );
    return metrics
      .filter((metric) =>
        metric.contentItemId
          ? attribution.has(metric.contentItemId)
          : // A content filter must exclude provider-discovered posts that carry no content link.
            !contentFiltered,
      )
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
    const { range } = await resolveScope(brandId, organisationId, filters, context);
    const metrics = await prisma.socialAccountMetric.findMany({
      where: {
        organisationId,
        brandId,
        measuredAt: { gte: range.from, lte: range.to },
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
    const { timezone, range } = await resolveScope(brandId, organisationId, filters, context);
    const [posts, accounts, publishedCount] = await Promise.all([
      this.posts(brandId, organisationId, filters, context),
      this.accounts(brandId, organisationId, filters, context),
      prisma.contentSchedule.count({
        where: {
          organisationId,
          brandId,
          status: "COMPLETED",
          scheduledFor: { gte: range.from, lte: range.to },
        },
      }),
    ]);

    // Post metrics are cumulative, so only the newest observation per post counts. `posts` is
    // ordered newest first, so the first value seen for a post/metric pair is the current one.
    const latestByPost = new Map<string, { provider: string; values: Record<string, number> }>();
    for (const metric of posts) {
      const entry = latestByPost.get(metric.providerPostId) ?? {
        provider: metric.provider,
        values: {},
      };
      if (entry.values[metric.metricType] === undefined) {
        entry.values[metric.metricType] = metric.metricValue;
      }
      latestByPost.set(metric.providerPostId, entry);
    }
    const aggregate: Record<string, number> = {};
    const byProvider: Record<string, Record<string, number>> = {};
    for (const entry of latestByPost.values()) {
      const channel = byProvider[entry.provider] ?? {};
      for (const [key, value] of Object.entries(entry.values)) {
        aggregate[key] = (aggregate[key] ?? 0) + value;
        channel[key] = (channel[key] ?? 0) + value;
      }
      byProvider[entry.provider] = channel;
    }

    const followerSeries = accounts
      .filter((metric) => ["follows", "subscribers"].includes(metric.metricType))
      .sort((a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime());

    // Business-local whole days keep publishing cadence correct across DST transitions.
    const periodDays = zonedDayCount(range.from, range.to, timezone);
    const granularity: AnalyticsGranularity = filters.granularity ?? "DAY";
    const series = new Map<string, Record<string, number>>();
    for (const metric of posts) {
      const key = zonedPeriodKey(new Date(metric.measuredAt), timezone, granularity);
      const bucket = series.get(key) ?? {};
      addMetric(bucket, metric.metricType, metric.metricValue);
      series.set(key, bucket);
    }

    return {
      timezone,
      granularity,
      range: { from: range.from.toISOString(), to: range.to.toISOString() },
      totals: aggregate,
      byProvider,
      series: [...series.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([period, values]) => ({ period, ...values })),
      derived: {
        ...deriveFromAggregate(aggregate),
        averageViewsPerPost: averageViewsPerPost(
          [...latestByPost.values()].map((entry) => entry.values.views ?? entry.values.videoViews),
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

  /**
   * Groups post observations by a content dimension and aggregates provider counts before deriving
   * ratios. Provider-discovered posts without a content link are reported under an explicit
   * unattributed group rather than being dropped or silently merged.
   */
  async attribution(
    brandId: string,
    organisationId: string,
    filters: Filters,
    dimension: AttributionDimension,
    context: TenantContext,
  ) {
    const { timezone, range } = await resolveScope(brandId, organisationId, filters, context);
    const posts = await this.posts(brandId, organisationId, filters, context);

    type Group = {
      key: string;
      label: string;
      dimension: AttributionDimension;
      providers: Set<string>;
      postIds: Set<string>;
      values: Record<string, number>;
      seen: Set<string>;
    };
    const groups = new Map<string, Group>();

    const groupKeyFor = (metric: (typeof posts)[number]) => {
      const item = metric.attribution;
      switch (dimension) {
        case "CONTENT_ITEM":
          return item
            ? { key: metric.contentItemId ?? item.id, label: item.title }
            : { key: "unattributed", label: "Unattributed provider posts" };
        case "CAMPAIGN":
          return { key: item?.campaignName ?? "none", label: item?.campaignName ?? "No campaign" };
        case "CONTENT_PILLAR":
          return { key: item?.contentPillar ?? "none", label: item?.contentPillar ?? "No pillar" };
        case "CONTENT_TYPE":
          return { key: item?.contentType ?? "none", label: item?.contentType ?? "No format" };
        case "OWNER":
          return { key: item?.ownerUserId ?? "none", label: item?.ownerUserId ?? "No owner" };
        case "PLATFORM":
          return { key: metric.provider, label: metric.provider };
      }
    };

    for (const metric of posts) {
      const { key, label } = groupKeyFor(metric);
      const group = groups.get(key) ?? {
        key,
        label,
        dimension,
        providers: new Set<string>(),
        postIds: new Set<string>(),
        values: {},
        seen: new Set<string>(),
      };
      group.providers.add(metric.provider);
      group.postIds.add(metric.providerPostId);
      // Post metrics are cumulative per post, so only the newest observation per post/metric counts.
      const dedupeKey = `${metric.providerPostId}:${metric.metricType}`;
      if (!group.seen.has(dedupeKey)) {
        group.seen.add(dedupeKey);
        addMetric(group.values, metric.metricType, metric.metricValue);
      }
      groups.set(key, group);
    }

    const accounts = await this.accounts(brandId, organisationId, filters, context);
    const followersByProvider = new Map<string, { first: number; last: number }>();
    for (const metric of accounts) {
      if (!["follows", "subscribers"].includes(metric.metricType)) continue;
      const existing = followersByProvider.get(metric.provider);
      // `accounts` is ordered newest first.
      followersByProvider.set(metric.provider, {
        first: metric.metricValue,
        last: existing?.last ?? metric.metricValue,
      });
    }

    return {
      timezone,
      dimension,
      range: { from: range.from.toISOString(), to: range.to.toISOString() },
      groups: [...groups.values()]
        .map((group) => {
          const followers =
            dimension === "PLATFORM" ? followersByProvider.get(group.key) : undefined;
          return {
            key: group.key,
            label: group.label,
            dimension: group.dimension,
            providers: [...group.providers].sort(),
            postsMeasured: group.postIds.size,
            totals: group.values,
            derived: {
              ...deriveFromAggregate(group.values),
              averageViewsPerPost:
                group.postIds.size > 0 && group.values.views !== undefined
                  ? group.values.views / group.postIds.size
                  : null,
              followerGrowth: followerGrowth(followers?.first, followers?.last),
            },
          };
        })
        .sort((a, b) => (b.totals.impressions ?? 0) - (a.totals.impressions ?? 0)),
    };
  },

  async export(
    brandId: string,
    organisationId: string,
    filters: Filters,
    scope: ExportScope,
    format: "CSV" | "JSON",
    context: TenantContext,
    dimension: AttributionDimension = "CONTENT_ITEM",
  ) {
    const { timezone, range } = await resolveScope(brandId, organisationId, filters, context);
    const metadata = {
      timezone,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      scope,
      ...(scope === "ATTRIBUTION" ? { dimension } : {}),
      generatedAt: new Date().toISOString(),
      note: "Provider timestamps are stored and exported in UTC; range boundaries use the reporting timezone.",
    };

    const rows =
      scope === "POST"
        ? await this.posts(brandId, organisationId, filters, context)
        : scope === "ACCOUNT"
          ? await this.accounts(brandId, organisationId, filters, context)
          : (
              await this.attribution(brandId, organisationId, filters, dimension, context)
            ).groups.map((group) => ({
              dimension: group.dimension,
              key: group.key,
              label: group.label,
              providers: group.providers.join("|"),
              postsMeasured: group.postsMeasured,
              impressions: group.totals.impressions,
              reach: group.totals.reach,
              views: group.totals.views,
              clicks: group.totals.clicks,
              likes: group.totals.likes,
              reactions: group.totals.reactions,
              comments: group.totals.comments,
              shares: group.totals.shares,
              saves: group.totals.saves,
              engagementRate: group.derived.engagementRate,
              clickThroughRate: group.derived.clickThroughRate,
              followerGrowth: group.derived.followerGrowth,
            }));

    if (format === "JSON") {
      return {
        contentType: "application/json",
        body: JSON.stringify({ metadata, rows }),
      };
    }

    const columns =
      scope === "POST"
        ? [
            "provider",
            "socialAccountId",
            "providerPostId",
            "contentItemId",
            "contentVariantId",
            "discoverySource",
            "metricType",
            "metricValue",
            "measuredAt",
            "metricPeriod",
          ]
        : scope === "ACCOUNT"
          ? ["provider", "socialAccountId", "metricType", "metricValue", "measuredAt", "metricPeriod"]
          : [
              "dimension",
              "key",
              "label",
              "providers",
              "postsMeasured",
              "impressions",
              "reach",
              "views",
              "clicks",
              "likes",
              "reactions",
              "comments",
              "shares",
              "saves",
              "engagementRate",
              "clickThroughRate",
              "followerGrowth",
            ];

    const escape = (value: unknown) =>
      value === null || value === undefined ? '""' : `"${String(value).replaceAll('"', '""')}"`;
    return {
      contentType: "text/csv; charset=utf-8",
      body: [
        `# timezone=${metadata.timezone} from=${metadata.from} to=${metadata.to} scope=${metadata.scope}`,
        columns.join(","),
        ...rows.map((row) =>
          columns
            .map((column) => escape((row as unknown as Record<string, unknown>)[column]))
            .join(","),
        ),
      ].join("\n"),
      metadata,
    };
  },
};
