import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  growthInsight: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
    groupBy: vi.fn(),
  },
  growthRecommendation: { create: vi.fn(), count: vi.fn(), findFirst: vi.fn() },
  performanceBenchmark: { deleteMany: vi.fn(), createMany: vi.fn(), findMany: vi.fn() },
  contentPattern: { deleteMany: vi.fn(), createMany: vi.fn(), findMany: vi.fn() },
  contentProvenance: { findMany: vi.fn() },
  contentVariant: { findMany: vi.fn() },
  growthExperiment: { count: vi.fn() },
  $transaction: vi.fn((fn: (tx: typeof prisma) => unknown) => fn(prisma)),
}));

const brandService = vi.hoisted(() => ({ getById: vi.fn() }));
const socialAnalyticsQueryService = vi.hoisted(() => ({
  resolveTimezone: vi.fn(),
  posts: vi.fn(),
  accounts: vi.fn(),
}));

vi.mock("@/lib/database/prisma", () => ({ prisma }));
vi.mock("@/server/services/workspace-service", () => ({ brandService }));
vi.mock("@/server/services/social-analytics-query-service", () => ({
  socialAnalyticsQueryService,
}));

import { growthIntelligenceService } from "@/server/services/growth-intelligence-service";

const context = { organisationId: "org-1", userProfileId: "user-1" } as never;

describe("growthIntelligenceService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    brandService.getById.mockResolvedValue({
      id: "brand-1",
      projectId: "project-1",
      analyticsTimezone: "UTC",
    });
    socialAnalyticsQueryService.resolveTimezone.mockResolvedValue({
      timezone: "UTC",
      from: new Date("2026-07-01"),
      to: new Date("2026-07-31"),
    });
    socialAnalyticsQueryService.posts.mockResolvedValue([]);
    socialAnalyticsQueryService.accounts.mockResolvedValue([]);
    prisma.contentProvenance.findMany.mockResolvedValue([]);
    prisma.contentVariant.findMany.mockResolvedValue([]);
    prisma.growthInsight.create.mockImplementation(async ({ data }) => ({
      id: `insight-${data.insightType}`,
      ...data,
      evidence: [],
    }));
    prisma.growthRecommendation.create.mockImplementation(async ({ data }) => ({ id: "rec-1", ...data }));
    prisma.growthInsight.groupBy.mockResolvedValue([]);
    prisma.growthRecommendation.count.mockResolvedValue(0);
    prisma.growthExperiment.count.mockResolvedValue(0);
  });

  it("scopes summary queries to tenant", async () => {
    await growthIntelligenceService.getSummary("brand-1", "org-1", context);
    expect(prisma.growthInsight.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organisationId: "org-1", brandId: "brand-1" }),
      }),
    );
  });

  it("generates one insight per type even with no data", async () => {
    const result = await growthIntelligenceService.analyze(
      "brand-1",
      "org-1",
      { from: new Date("2026-07-01"), to: new Date("2026-07-31") },
      context,
    );
    expect(result.insightCount).toBe(12);
    expect(result.sufficientInsights).toBe(0);
    expect(prisma.growthInsight.create).toHaveBeenCalledTimes(12);
  });
});
