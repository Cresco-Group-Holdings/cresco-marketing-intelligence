import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  socialPostMetric: { findMany: vi.fn() },
  socialAccountMetric: { findMany: vi.fn() },
  contentItem: { findMany: vi.fn() },
  contentSchedule: { count: vi.fn() },
  organisation: { findUnique: vi.fn() },
}));
const brandService = vi.hoisted(() => ({ getById: vi.fn() }));

vi.mock("@/lib/database/prisma", () => ({ prisma }));
vi.mock("@/server/services/workspace-service", () => ({ brandService }));

import { socialAnalyticsQueryService } from "@/server/services/social-analytics-query-service";

const context = {
  organisationId: "org-1",
  userProfileId: "user-1",
} as never;

const filters = {
  from: new Date("2026-07-01T00:00:00Z"),
  to: new Date("2026-07-31T23:59:59Z"),
  provider: "INSTAGRAM" as const,
};

const postMetric = (overrides: Record<string, unknown> = {}) => ({
  id: "metric-1",
  provider: "INSTAGRAM",
  socialAccountId: "account-1",
  providerPostId: "post-1",
  contentItemId: "content-1",
  metricType: "impressions",
  metricValue: 100,
  metricPeriod: "LIFETIME",
  measuredAt: new Date("2026-07-15T12:00:00Z"),
  ...overrides,
});

const contentItem = (overrides: Record<string, unknown> = {}) => ({
  id: "content-1",
  title: "Campaign post",
  campaignName: "Launch",
  contentPillar: "Education",
  contentType: "TEXT_POST",
  primaryCTA: "Learn",
  destinationUrl: null,
  objectiveId: null,
  targetAudienceId: null,
  ownerUserId: "owner-1",
  ...overrides,
});

describe("socialAnalyticsQueryService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    brandService.getById.mockResolvedValue({
      id: "brand-1",
      projectId: "project-1",
      analyticsTimezone: null,
    });
    prisma.organisation.findUnique.mockResolvedValue({ defaultTimezone: "UTC" });
    prisma.socialPostMetric.findMany.mockResolvedValue([]);
    prisma.socialAccountMetric.findMany.mockResolvedValue([]);
    prisma.contentItem.findMany.mockResolvedValue([]);
    prisma.contentSchedule.count.mockResolvedValue(0);
  });

  it("always applies tenant, provider and date-range filters", async () => {
    await socialAnalyticsQueryService.posts("brand-1", "org-1", filters, context);
    expect(prisma.socialPostMetric.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organisationId: "org-1",
          brandId: "brand-1",
          provider: "INSTAGRAM",
        }),
      }),
    );
  });

  it("converts the range to UTC using the brand timezone", async () => {
    brandService.getById.mockResolvedValue({
      id: "brand-1",
      projectId: "project-1",
      analyticsTimezone: "America/New_York",
    });
    const resolved = await socialAnalyticsQueryService.resolveTimezone(
      "brand-1",
      "org-1",
      filters,
      context,
    );
    expect(resolved.timezone).toBe("America/New_York");
    // 1 July 00:00 UTC is still 30 June locally, so the range opens at the start of 30 June in New
    // York and closes at the end of 31 July local.
    expect(resolved.from.toISOString()).toBe("2026-06-30T04:00:00.000Z");
    expect(resolved.to.toISOString()).toBe("2026-08-01T03:59:59.999Z");
  });

  it("falls back to the organisation timezone and then UTC", async () => {
    prisma.organisation.findUnique.mockResolvedValue({ defaultTimezone: "Europe/Berlin" });
    expect(
      (await socialAnalyticsQueryService.resolveTimezone("brand-1", "org-1", filters, context))
        .timezone,
    ).toBe("Europe/Berlin");
    prisma.organisation.findUnique.mockResolvedValue({ defaultTimezone: null });
    expect(
      (await socialAnalyticsQueryService.resolveTimezone("brand-1", "org-1", filters, context))
        .timezone,
    ).toBe("UTC");
  });

  it("lets an explicit request timezone override stored settings", async () => {
    brandService.getById.mockResolvedValue({
      id: "brand-1",
      projectId: "project-1",
      analyticsTimezone: "America/New_York",
    });
    const resolved = await socialAnalyticsQueryService.resolveTimezone(
      "brand-1",
      "org-1",
      { ...filters, timezone: "Asia/Tokyo" },
      context,
    );
    expect(resolved.timezone).toBe("Asia/Tokyo");
  });

  it("returns attributed content fields without crossing tenants", async () => {
    prisma.socialPostMetric.findMany.mockResolvedValue([postMetric()]);
    prisma.contentItem.findMany.mockResolvedValue([contentItem()]);
    const result = await socialAnalyticsQueryService.posts("brand-1", "org-1", filters, context);
    expect(result[0]).toMatchObject({
      metricValue: 100,
      attribution: { title: "Campaign post", contentPillar: "Education" },
    });
    expect(prisma.contentItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organisationId: "org-1", brandId: "brand-1" }),
      }),
    );
  });

  it("keeps unattributed provider posts unless a content filter is applied", async () => {
    prisma.socialPostMetric.findMany.mockResolvedValue([
      postMetric({ contentItemId: null, providerPostId: "history-1" }),
    ]);
    expect(
      await socialAnalyticsQueryService.posts("brand-1", "org-1", filters, context),
    ).toHaveLength(1);
    expect(
      await socialAnalyticsQueryService.posts(
        "brand-1",
        "org-1",
        { ...filters, campaign: "Launch" },
        context,
      ),
    ).toHaveLength(0);
  });

  it("buckets the overview series using business-local periods", async () => {
    brandService.getById.mockResolvedValue({
      id: "brand-1",
      projectId: "project-1",
      analyticsTimezone: "Australia/Sydney",
    });
    prisma.socialPostMetric.findMany.mockResolvedValue([
      // 23:30 UTC on 15 July is already 16 July in Sydney.
      postMetric({ contentItemId: null, measuredAt: new Date("2026-07-15T23:30:00Z") }),
    ]);
    const overview = await socialAnalyticsQueryService.overview(
      "brand-1",
      "org-1",
      filters,
      context,
    );
    expect(overview.timezone).toBe("Australia/Sydney");
    expect(overview.series).toEqual([{ period: "2026-07-16", impressions: 100 }]);
  });

  it("counts only the newest observation per post so cumulative metrics are not double counted", async () => {
    prisma.socialPostMetric.findMany.mockResolvedValue([
      // Two observations of the same cumulative metric for the same post.
      postMetric({ metricValue: 150, measuredAt: new Date("2026-07-20T12:00:00Z") }),
      postMetric({ metricValue: 100, measuredAt: new Date("2026-07-15T12:00:00Z") }),
    ]);
    prisma.contentItem.findMany.mockResolvedValue([contentItem()]);
    const overview = await socialAnalyticsQueryService.overview(
      "brand-1",
      "org-1",
      filters,
      context,
    );
    expect(overview.totals.impressions).toBe(150);
    expect(overview.byProvider.INSTAGRAM?.impressions).toBe(150);
    expect(overview.postsMeasured).toBe(1);
  });

  it("derives ratios from aggregated totals rather than averaging percentages", async () => {
    prisma.socialPostMetric.findMany.mockResolvedValue([
      postMetric({ providerPostId: "a", metricType: "impressions", metricValue: 100 }),
      postMetric({ providerPostId: "a", metricType: "likes", metricValue: 50 }),
      postMetric({ providerPostId: "b", metricType: "impressions", metricValue: 900 }),
      postMetric({ providerPostId: "b", metricType: "likes", metricValue: 10 }),
    ]);
    prisma.contentItem.findMany.mockResolvedValue([contentItem()]);
    const result = await socialAnalyticsQueryService.attribution(
      "brand-1",
      "org-1",
      filters,
      "CAMPAIGN",
      context,
    );
    const group = result.groups[0]!;
    expect(group.totals).toMatchObject({ impressions: 1000, likes: 60 });
    // Averaging the per-post rates would give 50% and 1.1% → 25.6%; the weighted rate is 6%.
    expect(group.derived.engagementRate).toBe(6);
  });

  it("aggregates each attribution dimension separately", async () => {
    prisma.socialPostMetric.findMany.mockResolvedValue([
      postMetric({ providerPostId: "a", contentItemId: "content-1" }),
      postMetric({
        providerPostId: "b",
        contentItemId: "content-2",
        provider: "LINKEDIN",
        metricValue: 40,
      }),
    ]);
    prisma.contentItem.findMany.mockResolvedValue([
      contentItem(),
      contentItem({
        id: "content-2",
        title: "Second",
        campaignName: "Launch",
        contentPillar: "Product",
        contentType: "IMAGE_POST",
        ownerUserId: "owner-2",
      }),
    ]);
    const byCampaign = await socialAnalyticsQueryService.attribution(
      "brand-1",
      "org-1",
      { ...filters, provider: undefined },
      "CAMPAIGN",
      context,
    );
    expect(byCampaign.groups).toHaveLength(1);
    expect(byCampaign.groups[0]).toMatchObject({
      label: "Launch",
      postsMeasured: 2,
      providers: ["INSTAGRAM", "LINKEDIN"],
    });
    expect(byCampaign.groups[0]!.totals.impressions).toBe(140);

    for (const [dimension, expected] of [
      ["CONTENT_ITEM", 2],
      ["CONTENT_PILLAR", 2],
      ["CONTENT_TYPE", 2],
      ["OWNER", 2],
      ["PLATFORM", 2],
    ] as const) {
      const grouped = await socialAnalyticsQueryService.attribution(
        "brand-1",
        "org-1",
        { ...filters, provider: undefined },
        dimension,
        context,
      );
      expect(grouped.groups).toHaveLength(expected);
    }
  });

  it("reports unattributed provider posts as their own group", async () => {
    prisma.socialPostMetric.findMany.mockResolvedValue([
      postMetric({ providerPostId: "history-1", contentItemId: null }),
    ]);
    const result = await socialAnalyticsQueryService.attribution(
      "brand-1",
      "org-1",
      filters,
      "CONTENT_ITEM",
      context,
    );
    expect(result.groups[0]).toMatchObject({
      key: "unattributed",
      label: "Unattributed provider posts",
    });
  });

  it("returns null derived values when a denominator is unavailable", async () => {
    prisma.socialPostMetric.findMany.mockResolvedValue([
      postMetric({ metricType: "likes", metricValue: 5, contentItemId: null }),
    ]);
    const result = await socialAnalyticsQueryService.attribution(
      "brand-1",
      "org-1",
      filters,
      "PLATFORM",
      context,
    );
    expect(result.groups[0]!.derived.engagementRate).toBeNull();
    expect(result.groups[0]!.derived.clickThroughRate).toBeNull();
    expect(result.groups[0]!.derived.videoCompletionRate).toBeNull();
  });

  it("exports post CSV with timezone metadata and account JSON with an envelope", async () => {
    prisma.socialPostMetric.findMany.mockResolvedValue([
      postMetric({ metricType: "reach", metricValue: 10, contentItemId: null }),
    ]);
    const csv = await socialAnalyticsQueryService.export(
      "brand-1",
      "org-1",
      filters,
      "POST",
      "CSV",
      context,
    );
    expect(csv.contentType).toContain("text/csv");
    expect(csv.body.split("\n")[0]).toContain("# timezone=UTC");
    expect(csv.body).toContain('"reach"');

    prisma.socialAccountMetric.findMany.mockResolvedValue([]);
    const json = await socialAnalyticsQueryService.export(
      "brand-1",
      "org-1",
      filters,
      "ACCOUNT",
      "JSON",
      context,
    );
    const parsed = JSON.parse(json.body);
    expect(parsed.rows).toEqual([]);
    expect(parsed.metadata).toMatchObject({ timezone: "UTC", scope: "ACCOUNT" });
  });

  it("exports aggregated attribution rows rather than raw post rows", async () => {
    prisma.socialPostMetric.findMany.mockResolvedValue([
      postMetric({ providerPostId: "a" }),
      postMetric({ providerPostId: "b", metricValue: 20 }),
    ]);
    prisma.contentItem.findMany.mockResolvedValue([contentItem()]);
    const exported = await socialAnalyticsQueryService.export(
      "brand-1",
      "org-1",
      filters,
      "ATTRIBUTION",
      "JSON",
      context,
      "CAMPAIGN",
    );
    const parsed = JSON.parse(exported.body);
    expect(parsed.metadata).toMatchObject({ scope: "ATTRIBUTION", dimension: "CAMPAIGN" });
    expect(parsed.rows).toEqual([
      expect.objectContaining({ label: "Launch", postsMeasured: 2, impressions: 120 }),
    ]);
  });
});
