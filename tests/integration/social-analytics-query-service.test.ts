import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  socialPostMetric: { findMany: vi.fn() },
  socialAccountMetric: { findMany: vi.fn() },
  contentItem: { findMany: vi.fn() },
  contentSchedule: { count: vi.fn() },
}));
vi.mock("@/lib/database/prisma", () => ({ prisma }));
vi.mock("@/server/services/workspace-service", () => ({
  brandService: {
    getById: vi.fn().mockResolvedValue({ id: "brand-1", projectId: "project-1" }),
  },
}));

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

describe("socialAnalyticsQueryService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
          measuredAt: {
            gte: filters.from,
            lte: filters.to,
          },
        }),
      }),
    );
  });

  it("returns attributed content fields without crossing tenants", async () => {
    prisma.socialPostMetric.findMany.mockResolvedValue([
      {
        id: "metric-1",
        metricValue: 100,
        metricType: "impressions",
        providerPostId: "post-1",
        contentItemId: "content-1",
        measuredAt: filters.to,
      },
    ]);
    prisma.contentItem.findMany.mockResolvedValue([
      {
        id: "content-1",
        title: "Campaign post",
        campaignName: "Launch",
        contentPillar: "Education",
        contentType: "TEXT_POST",
        primaryCTA: "Learn",
      },
    ]);
    const result = await socialAnalyticsQueryService.posts("brand-1", "org-1", filters, context);
    expect(result[0]).toMatchObject({
      metricValue: 100,
      attribution: {
        title: "Campaign post",
        contentPillar: "Education",
      },
    });
    expect(prisma.contentItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organisationId: "org-1",
          brandId: "brand-1",
        }),
      }),
    );
  });

  it("exports post-level CSV and account-level JSON", async () => {
    prisma.socialPostMetric.findMany.mockResolvedValue([
      {
        provider: "INSTAGRAM",
        socialAccountId: "account-1",
        providerPostId: "post-1",
        metricType: "reach",
        metricValue: 10,
        measuredAt: filters.to,
        metricPeriod: "LIFETIME",
      },
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
    expect(json.body).toBe("[]");
  });
});
