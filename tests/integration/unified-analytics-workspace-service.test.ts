import { describe, expect, it, vi } from "vitest";
import { computeAttributionFromJourneys } from "@/lib/unified-analytics/attribution";

const mockGetResolvedWorkspace = vi.fn();
const mockPaidOverview = vi.fn();
const mockSocialOverview = vi.fn();
const mockRevenueOverview = vi.fn();
const mockJourneys = vi.fn();
const mockGa4Overview = vi.fn();
const mockPaidConnections = vi.fn();
const mockSocialCatalogue = vi.fn();
const mockTenant = vi.fn();

vi.mock("@/server/services/workspace-service", () => ({
  workspaceService: {
    getResolvedWorkspace: (...args: unknown[]) => mockGetResolvedWorkspace(...args),
  },
}));

vi.mock("@/server/services/paid-ads-dashboard-service", () => ({
  paidAdsDashboardService: {
    getOverview: (...args: unknown[]) => mockPaidOverview(...args),
  },
}));

vi.mock("@/server/services/social-analytics-query-service", () => ({
  socialAnalyticsQueryService: {
    overview: (...args: unknown[]) => mockSocialOverview(...args),
    attribution: vi.fn().mockResolvedValue({ groups: [] }),
  },
}));

vi.mock("@/server/services/revenue-dashboard-service", () => ({
  revenueDashboardService: {
    getOverview: (...args: unknown[]) => mockRevenueOverview(...args),
  },
}));

vi.mock("@/server/services/attribution-dashboard-service", () => ({
  attributionDashboardService: {
    getJourneys: (...args: unknown[]) => mockJourneys(...args),
  },
}));

vi.mock("@/server/services/ga4-analytics-query-service", () => ({
  ga4AnalyticsQueryService: {
    getWebOverview: (...args: unknown[]) => mockGa4Overview(...args),
  },
}));

vi.mock("@/server/services/paid-ads-connection-service", () => ({
  paidAdsConnectionService: {
    getConnectionStatus: (...args: unknown[]) => mockPaidConnections(...args),
  },
}));

vi.mock("@/server/services/social-connection-service", () => ({
  socialConnectionService: {
    getCatalogue: (...args: unknown[]) => mockSocialCatalogue(...args),
  },
}));

vi.mock("@/server/services/attribution-model-service", () => ({
  attributionModelService: {
    ensureDefaultModels: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/server/services/marketing-command-centre-metrics", () => ({
  latestPaidSyncAt: vi.fn().mockResolvedValue(new Date()),
  latestOrganicSyncAt: vi.fn().mockResolvedValue(new Date()),
}));

vi.mock("@/lib/tenancy/guards", () => ({
  buildTenantContextForUser: (...args: unknown[]) => mockTenant(...args),
}));

describe("unified analytics workspace service integration", () => {
  it("includes GA4 sessions in funnel and attribution confidence in workspace", async () => {
    mockGetResolvedWorkspace.mockResolvedValue({
      preference: {
        currentOrganisationId: "org-1",
        currentProjectId: "project-1",
        currentBrandId: "brand-1",
      },
    });
    mockTenant.mockResolvedValue({ organisationId: "org-1", brandId: "brand-1" });
    mockPaidOverview.mockResolvedValue({
      spend: 5000,
      impressions: 100000,
      clicks: 2000,
      conversions: 40,
      byProvider: {},
    });
    mockSocialOverview.mockResolvedValue({
      totals: { reach: 50000, impressions: 80000, clicks: 1200, likes: 400, comments: 80, shares: 20 },
      byProvider: {},
      derived: { engagementRate: 3.2 },
    });
    mockRevenueOverview.mockResolvedValue({
      metrics: { totalRevenue: 25000 },
    });
    mockJourneys.mockResolvedValue([
      {
        journeyStart: "2026-01-20T00:00:00Z",
        journeyEnd: "2026-02-01T12:00:00Z",
        revenueValue: 1000,
        status: "CONVERTED",
        touchpointCount: 1,
        touchpoints: [
          {
            id: "tp-1",
            occurredAt: "2026-01-31T00:00:00Z",
            channel: "Meta Ads",
            position: 1,
            isExcluded: false,
          },
        ],
      },
    ]);
    mockGa4Overview.mockResolvedValue({
      connected: true,
      sessions: 8400,
      users: 6200,
      pageviews: 18400,
      conversions: 40,
      freshness: "fresh",
      lastSyncedAt: "2026-02-01T00:00:00Z",
      source: "GA4",
    });
    mockPaidConnections.mockResolvedValue({ connected: true, accountSelected: true, account: null });
    mockSocialCatalogue.mockResolvedValue([{ connection: { status: "CONNECTED" } }]);

    const { unifiedAnalyticsWorkspaceService } = await import(
      "@/server/services/unified-analytics-workspace-service"
    );

    const workspace = await unifiedAnalyticsWorkspaceService.getWorkspace("user-1");

    expect(workspace.hasBrandContext).toBe(true);
    expect(workspace.webAnalytics.sessions).toBe(8400);
    expect(workspace.funnel.some((stage) => stage.stage === "Sessions" && stage.count === 8400)).toBe(
      true,
    );
    expect(workspace.attributionConfidence.level).toBeDefined();
    expect(workspace.coverage.some((item) => item.dimension === "Web Analytics Coverage")).toBe(true);

    const attribution = computeAttributionFromJourneys(
      [
        {
          journeyStart: "2026-01-20T00:00:00Z",
          journeyEnd: "2026-02-01T12:00:00Z",
          revenueValue: 1000,
          status: "CONVERTED",
          touchpoints: [
            {
              id: "tp-1",
              occurredAt: "2026-01-31T00:00:00Z",
              channel: "Meta Ads",
              position: 1,
              isExcluded: false,
            },
          ],
        },
      ],
      "LAST_TOUCH",
      30,
    );
    expect(workspace.revenue.observedRevenue).toBe(25000);
    expect(attribution.attributedRevenue).toBe(1000);
  });
});
