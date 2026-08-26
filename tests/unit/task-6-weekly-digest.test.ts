import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MarketingIntelligenceContext } from "@/lib/marketing-intelligence/types";

const prismaMock = vi.hoisted(() => ({
  brand: { findFirst: vi.fn() },
  organisationMembership: { findFirst: vi.fn(), findMany: vi.fn() },
}));

const buildContextMock = vi.hoisted(() => vi.fn());
const buildTenantMock = vi.hoisted(() => vi.fn());
const notificationEmitMock = vi.hoisted(() => vi.fn());

const evaluateSignalsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/database/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/marketing-intelligence/engine", () => ({
  evaluateMarketingSignals: evaluateSignalsMock,
}));
vi.mock("@/server/services/marketing-intelligence-context-service", () => ({
  marketingIntelligenceContextService: { buildWeeklyContext: buildContextMock },
}));
vi.mock("@/lib/tenancy/guards", () => ({
  buildTenantContextForUser: buildTenantMock,
}));
vi.mock("@/server/services/notification-service", () => ({
  notificationService: { emit: notificationEmitMock },
}));

import { weeklyMarketingDigestService } from "@/server/services/weekly-marketing-digest-service";

function fullContext(): MarketingIntelligenceContext {
  return {
    rangeLabel: "Last 7 days",
    comparisonLabel: "Previous 7 days",
    paid: {
      connectedCount: 2,
      totalProviders: 4,
      spend: 1200,
      previousSpend: 1000,
      conversions: 40,
      previousConversions: 35,
      revenue: 4800,
      previousRevenue: 4200,
      roas: 4,
      previousRoas: 4.2,
      cpa: 30,
      previousCpa: 28.5,
      byProvider: [],
      freshness: "fresh",
      lastSyncedAt: new Date(),
    },
    organic: {
      connectedCount: 3,
      totalProviders: 6,
      reach: 50000,
      previousReach: 45000,
      engagement: 3200,
      previousEngagement: 2900,
      engagementRate: 0.064,
      published: 5,
      scheduled: 2,
      channels: [],
      freshness: "fresh",
      lastSyncedAt: new Date(),
    },
    publishing: {
      publishedInRange: 5,
      scheduledUpcoming: 2,
      daysWithoutScheduled: 0,
      strongestOrganicFormat: null,
    },
    connectivity: {
      paidConnected: 2,
      paidTotal: 4,
      organicConnected: 3,
      organicTotal: 6,
    },
  };
}

function partialContext(): MarketingIntelligenceContext {
  return {
    rangeLabel: "Last 7 days",
    comparisonLabel: "Previous 7 days",
    paid: {
      connectedCount: 0,
      totalProviders: 4,
      spend: 0,
      previousSpend: 0,
      conversions: 0,
      previousConversions: 0,
      revenue: 0,
      previousRevenue: 0,
      roas: null,
      previousRoas: null,
      cpa: null,
      previousCpa: null,
      byProvider: [],
      freshness: "unavailable",
      lastSyncedAt: null,
    },
    organic: {
      connectedCount: 0,
      totalProviders: 6,
      reach: null,
      previousReach: null,
      engagement: null,
      previousEngagement: null,
      engagementRate: null,
      published: 0,
      scheduled: 0,
      channels: [],
      freshness: "unavailable",
      lastSyncedAt: null,
    },
    publishing: {
      publishedInRange: 0,
      scheduledUpcoming: 0,
      daysWithoutScheduled: 7,
      strongestOrganicFormat: null,
    },
    connectivity: {
      paidConnected: 0,
      paidTotal: 4,
      organicConnected: 0,
      organicTotal: 6,
    },
  };
}

describe("weekly marketing digest regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.brand.findFirst.mockResolvedValue({
      id: "brand-1",
      projectId: "proj-1",
      name: "Acme",
    });
    prismaMock.organisationMembership.findFirst.mockResolvedValue({ userId: "user-1" });
    prismaMock.organisationMembership.findMany.mockResolvedValue([{ userId: "user-1" }]);
    buildTenantMock.mockResolvedValue({
      userId: "user-1",
      userProfileId: "profile-1",
      organisationId: "org-1",
      organisationRole: "ADMIN",
      projectId: "proj-1",
      brandId: "brand-1",
    });
    notificationEmitMock.mockResolvedValue([]);
  });

  it("includes paid and organic sections when full data is available", async () => {
    buildContextMock.mockResolvedValue(fullContext());
    evaluateSignalsMock.mockReturnValue([
      {
        id: "paid-1",
        type: "opportunity",
        severity: "medium",
        title: "Paid ROAS stable",
        explanation: "Paid spend efficiency held steady.",
        evidence: [],
        category: "paid",
        generatedAt: new Date().toISOString(),
        confidence: 0.8,
      },
      {
        id: "organic-1",
        type: "opportunity",
        severity: "medium",
        title: "Organic reach grew",
        explanation: "Organic reach increased week over week.",
        evidence: [],
        category: "organic",
        generatedAt: new Date().toISOString(),
        confidence: 0.8,
      },
    ]);

    const digest = await weeklyMarketingDigestService.generate("org-1", "brand-1");

    const paid = digest.sections.find((s) => s.title === "Paid Performance");
    const organic = digest.sections.find((s) => s.title === "Organic Growth");
    expect(paid?.available).toBe(true);
    expect(organic?.available).toBe(true);
    expect(digest.signalCount).toBeGreaterThan(0);
    expect(paid?.body).not.toMatch(/unavailable/i);
  });

  it("marks unavailable sections without fabricating zero metrics", async () => {
    buildContextMock.mockResolvedValue(partialContext());
    evaluateSignalsMock.mockReturnValue([]);

    const digest = await weeklyMarketingDigestService.generate("org-1", "brand-1");

    const paid = digest.sections.find((s) => s.title === "Paid Performance");
    const organic = digest.sections.find((s) => s.title === "Organic Growth");
    expect(paid?.available).toBe(false);
    expect(organic?.available).toBe(false);
    expect(paid?.body).toContain("unavailable");
    expect(organic?.body).toContain("unavailable");
    expect(digest.summary).toContain("Insufficient connected data");
  });
});
