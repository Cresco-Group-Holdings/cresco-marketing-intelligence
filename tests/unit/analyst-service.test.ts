import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganisationRole } from "@prisma/client";
import { hasPermission, PERMISSIONS } from "@/lib/tenancy/permissions";

const prismaMock = vi.hoisted(() => ({
  marketingAnalystRun: { create: vi.fn(), update: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
  marketingAnalystRecommendation: { create: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  growthExperiment: { create: vi.fn() },
}));

vi.mock("@/lib/database/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/server/services/workspace-service", () => ({
  brandService: { getById: vi.fn().mockResolvedValue({ id: "brand-1", projectId: "project-1", organisationId: "org-1", name: "Test" }) },
}));
vi.mock("@/server/services/executive-dashboard-service", () => ({
  executiveDashboardService: {
    getOverview: vi.fn().mockResolvedValue({
      kpis: { revenue: { available: true, value: 100, previous: { available: true, value: 80 }, changeAbsolute: 20, changePercent: 25 } },
      period: { from: "2026-01-01", to: "2026-01-31", comparisonFrom: "2025-12-01", comparisonTo: "2025-12-31", comparisonType: "PREVIOUS_PERIOD" },
      reportingCurrency: "USD",
      disclaimer: "test",
      formulaDefinitions: { revenue: "Net revenue" },
      extensionPoints: { emailPerformance: "ext" },
    }),
    getWarnings: vi.fn().mockResolvedValue({ warnings: [] }),
    getDataHealth: vi.fn().mockResolvedValue({ summary: { healthy: 1, degraded: 0, unhealthy: 0, unknown: 0 } }),
  },
}));
vi.mock("@/server/services/attribution-dashboard-service", () => ({
  attributionDashboardService: { getOverview: vi.fn().mockResolvedValue({ directTrafficPolicy: "exclude" }) },
}));
vi.mock("@/server/services/brand-knowledge-service", () => ({
  brandKnowledgeService: { getSnapshot: vi.fn().mockResolvedValue({}) },
}));
vi.mock("@/lib/ai/brand-context-builder", () => ({
  brandContextBuilder: { build: vi.fn().mockReturnValue({}) },
}));
vi.mock("@/server/services/ai-request-service", () => ({
  aiRequestService: {
    executeStructured: vi.fn().mockRejectedValue(new Error("AI unavailable")),
  },
}));
vi.mock("@/server/services/content-service", () => ({
  contentService: { create: vi.fn().mockResolvedValue({ id: "content-1" }) },
}));

import { marketingAnalystService } from "@/server/services/marketing-analyst-service";

const tenant = {
  organisationId: "org-1",
  userProfileId: "user-1",
  userId: "user-1",
  organisationRole: OrganisationRole.ADMIN,
};

describe("analyst permissions", () => {
  it("restricts generate to authorised roles", () => {
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["ai.analyst.read"])).toBe(true);
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["ai.analyst.generate"])).toBe(false);
    expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS["ai.analyst.generate"])).toBe(true);
  });
});

describe("marketing analyst service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.marketingAnalystRun.create.mockResolvedValue({ id: "run-1" });
    prismaMock.marketingAnalystRun.update.mockResolvedValue({ id: "run-1", status: "COMPLETED" });
    prismaMock.marketingAnalystRecommendation.create.mockResolvedValue({});
  });

  it("uses deterministic fallback when AI fails", async () => {
    const result = await marketingAnalystService.ask("brand-1", "org-1", "What changed?", tenant);
    expect(result.output.summary).toBeTruthy();
    expect(prismaMock.marketingAnalystRun.create).toHaveBeenCalled();
  });

  it("scopes run listing to tenant", async () => {
    prismaMock.marketingAnalystRun.findMany.mockResolvedValue([]);
    await marketingAnalystService.listRuns("brand-1", "org-1", tenant);
    expect(prismaMock.marketingAnalystRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ brandId: "brand-1", organisationId: "org-1" }) }),
    );
  });
});
