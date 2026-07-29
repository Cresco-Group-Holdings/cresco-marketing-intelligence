import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  growthInsight: {
    create: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
    groupBy: vi.fn(),
  },
  growthRecommendation: { create: vi.fn(), count: vi.fn(), updateMany: vi.fn() },
  growthAnalysisRun: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  performanceBenchmark: { deleteMany: vi.fn(), createMany: vi.fn(), findMany: vi.fn() },
  contentPattern: { deleteMany: vi.fn(), createMany: vi.fn(), findMany: vi.fn() },
  contentProvenance: { findMany: vi.fn() },
  contentVariant: { findMany: vi.fn() },
  contentItem: { findMany: vi.fn() },
  brandOffer: { findMany: vi.fn() },
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

const context = {
  organisationId: "org-1",
  userProfileId: "user-1",
} as never;

const filters = {
  from: new Date("2026-07-01T00:00:00Z"),
  to: new Date("2026-07-31T23:59:59Z"),
};

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
      from: filters.from,
      to: filters.to,
    });
    socialAnalyticsQueryService.posts.mockResolvedValue([]);
    socialAnalyticsQueryService.accounts.mockResolvedValue([]);
    prisma.contentProvenance.findMany.mockResolvedValue([]);
    prisma.contentVariant.findMany.mockResolvedValue([]);
    prisma.contentItem.findMany.mockResolvedValue([]);
    prisma.brandOffer.findMany.mockResolvedValue([]);
    prisma.growthAnalysisRun.findUnique.mockResolvedValue(null);
    prisma.growthAnalysisRun.upsert.mockResolvedValue({ id: "run-1" });
    prisma.growthAnalysisRun.update.mockResolvedValue({ id: "run-1", status: "COMPLETED" });
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
        where: expect.objectContaining({
          organisationId: "org-1",
          brandId: "brand-1",
        }),
      }),
    );
  });

  it("supersedes prior active records inside the analysis transaction", async () => {
    await growthIntelligenceService.analyze("brand-1", "org-1", filters, context, { force: true });
    expect(prisma.growthInsight.updateMany).toHaveBeenCalled();
    expect(prisma.growthRecommendation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "SUPERSEDED" },
      }),
    );
    expect(prisma.growthInsight.create).toHaveBeenCalledTimes(12);
  });
});
