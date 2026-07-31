import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganisationRole } from "@prisma/client";
import { hasPermission, PERMISSIONS } from "@/lib/tenancy/permissions";

const prismaMock = vi.hoisted(() => ({
  marketingObjective: { findMany: vi.fn() },
  marketingMetricObservation: { aggregate: vi.fn() },
  marketingLead: { count: vi.fn() },
  revenueSubscription: { count: vi.fn() },
  revenueCustomer: { count: vi.fn() },
  marketingCostRecord: { aggregate: vi.fn() },
  attributionJourney: { count: vi.fn() },
  connectorAccount: { findMany: vi.fn() },
  executiveDashboardPreference: { findUnique: vi.fn(), upsert: vi.fn() },
}));

vi.mock("@/lib/database/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/server/services/workspace-service", () => ({
  brandService: { getById: vi.fn().mockResolvedValue({ id: "brand-1", name: "Test Brand", projectId: "project-1" }) },
}));
vi.mock("@/server/services/revenue-dashboard-service", () => ({
  revenueDashboardService: {
    getOverview: vi.fn().mockResolvedValue({
      metrics: { netRevenue: 1000, mrr: 500, newCustomers: 5 },
      dataFreshness: "2026-01-01T00:00:00Z",
    }),
    getWarnings: vi.fn().mockResolvedValue({ warnings: [] }),
  },
}));
vi.mock("@/server/services/attribution-dashboard-service", () => ({
  attributionDashboardService: {
    getOverview: vi.fn().mockResolvedValue({ attributedRevenue: 800, limitations: [] }),
    getWarnings: vi.fn().mockResolvedValue({ warnings: [] }),
  },
}));
vi.mock("@/server/services/paid-ads-dashboard-service", () => ({
  paidAdsDashboardService: {
    getOverview: vi.fn().mockResolvedValue({ clicks: 200, spend: 300, impressions: 1000 }),
  },
}));
vi.mock("@/server/services/gsc-dashboard-service", () => ({
  gscDashboardService: {
    getOverview: vi.fn().mockResolvedValue({
      clicks: 150,
      freshness: { lastSyncedDate: "2026-01-01", dataDelayDays: 2, disclaimer: "delay" },
    }),
  },
}));
vi.mock("@/server/services/social-analytics-query-service", () => ({
  socialAnalyticsQueryService: {
    overview: vi.fn().mockResolvedValue({ totals: { likes: 10, comments: 5 } }),
  },
}));
vi.mock("@/server/services/marketing-warehouse-health-service", () => ({
  marketingWarehouseHealthService: {
    listHealth: vi.fn().mockResolvedValue({
      summary: { healthy: 1, degraded: 0, unhealthy: 0, unknown: 0 },
      items: [],
    }),
  },
}));
vi.mock("@/lib/revenue/adapters", () => ({
  listAvailableRevenueAdapters: vi.fn(() => [{ sourceType: "STRIPE", available: false }]),
}));

import { executiveDashboardService } from "@/server/services/executive-dashboard-service";
import { clearExecutiveCache } from "@/lib/executive/cache";

const tenant = {
  organisationId: "org-1",
  userProfileId: "user-1",
  userId: "user-1",
  organisationRole: OrganisationRole.ADMIN,
};

const from = new Date("2026-01-01T00:00:00Z");
const to = new Date("2026-01-31T23:59:59Z");

describe("executive permissions", () => {
  it("requires marketingData.read for dashboard access", () => {
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["marketingData.read"])).toBe(true);
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["marketingData.runSync"])).toBe(false);
  });
});

describe("executive dashboard service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearExecutiveCache();
    prismaMock.marketingMetricObservation.aggregate.mockResolvedValue({ _sum: { metricValue: 1000 } });
    prismaMock.marketingLead.count.mockResolvedValue(10);
    prismaMock.revenueSubscription.count.mockResolvedValue(3);
    prismaMock.revenueCustomer.count.mockResolvedValue(5);
    prismaMock.marketingCostRecord.aggregate.mockResolvedValue({ _sum: { amount: 500 } });
    prismaMock.marketingObjective.findMany.mockResolvedValue([]);
    prismaMock.connectorAccount.findMany.mockResolvedValue([]);
    prismaMock.attributionJourney.count.mockResolvedValue(0);
  });

  it("returns KPIs from real data sources", async () => {
    const overview = await executiveDashboardService.getOverview(
      "brand-1",
      "org-1",
      from,
      to,
      "PREVIOUS_PERIOD",
      tenant,
    );
    const kpis = overview.kpis as Record<string, { available: boolean; value: number | null }>;
    expect(kpis.visitors?.available).toBe(true);
    expect(kpis.revenue?.available).toBe(true);
    expect(kpis.ltv?.available).toBe(false);
  });

  it("marks missing metrics as unavailable not zero", async () => {
    prismaMock.marketingMetricObservation.aggregate.mockResolvedValue({ _sum: { metricValue: null } });
    prismaMock.marketingLead.count.mockResolvedValue(0);
    const overview = await executiveDashboardService.getOverview(
      "brand-1",
      "org-1",
      from,
      to,
      "PREVIOUS_PERIOD",
      tenant,
    );
    const kpis = overview.kpis as Record<string, { available: boolean }>;
    expect(kpis.visitors?.available).toBe(false);
    expect(kpis.leads?.available).toBe(false);
  });

  it("scopes data health queries to tenant", async () => {
    await executiveDashboardService.getDataHealth("brand-1", "org-1", tenant);
    expect(prismaMock.connectorAccount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ organisationId: "org-1", brandId: "brand-1" }) }),
    );
  });

  it("exports CSV rows with formula appendix", async () => {
    const exportData = await executiveDashboardService.exportCsv(
      "brand-1",
      "org-1",
      from,
      to,
      "PREVIOUS_PERIOD",
      tenant,
    );
    expect(exportData.kpiRows.length).toBeGreaterThan(0);
    expect(exportData.appendix).toBeDefined();
  });
});
