import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  publication: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  publicationMetric: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  publicationAnalyticsSync: {
    upsert: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
  },
};

vi.mock("@/lib/database/prisma", () => ({ prisma: prismaMock }));

vi.mock("@/server/services/token-lifecycle-service", () => ({
  tokenLifecycleService: {
    getValidAccessToken: vi.fn().mockResolvedValue({
      accessToken: "token",
      status: "VALID",
    }),
  },
}));

vi.mock("@/lib/social/analytics-adapters", () => ({
  getSocialAnalyticsAdapter: () => ({
    fetchPostMetrics: vi.fn().mockResolvedValue({
      observations: [
        {
          metricType: "impressions",
          metricValue: 42,
          measuredAt: new Date("2026-08-16T12:00:00Z"),
          metricPeriod: "LIFETIME",
          sourceField: "impressions",
        },
      ],
      unavailableMetrics: [],
      raw: {},
    }),
  }),
}));

describe("publication analytics identity chain", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists metrics keyed to publication and external post id", async () => {
    const { publicationAnalyticsSyncService } = await import(
      "@/server/services/publication-analytics-sync-service"
    );

    prismaMock.publication.findFirst.mockResolvedValue({
      id: "pub-1",
      organisationId: "org-1",
      brandId: "brand-1",
      connectionId: "conn-1",
      externalPublicationId: "ig-post-123",
      externalAccountId: "ig-user-1",
      requestedByUserId: "user-1",
      projectId: "proj-1",
    });
    prismaMock.publicationAnalyticsSync.upsert.mockResolvedValue({
      publicationId: "pub-1",
      syncCursor: null,
      lastSyncedAt: null,
    });
    prismaMock.publicationMetric.findUnique.mockResolvedValue(null);
    prismaMock.publicationMetric.create.mockResolvedValue({});
    prismaMock.publicationAnalyticsSync.update.mockResolvedValue({});

    const result = await publicationAnalyticsSyncService.syncPublication("pub-1", "org-1", {
      organisationId: "org-1",
      userProfileId: "user-1",
      userId: "user-1",
      organisationRole: "ADMIN",
      projectId: "proj-1",
      brandId: "brand-1",
    });

    expect(result.metricsStored).toBe(1);
    expect(prismaMock.publicationMetric.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          publicationId: "pub-1",
          connectionId: "conn-1",
          externalPublicationId: "ig-post-123",
          metricKey: "impressions",
        }),
      }),
    );
  });
});
