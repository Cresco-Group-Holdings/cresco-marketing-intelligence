import { describe, expect, it, vi } from "vitest";
import { OrganisationRole } from "@prisma/client";

const userProfileId = "user-1";
const organisationId = "org-1";
const projectId = "project-1";
const brandId = "brand-1";

const mockGetResolvedWorkspace = vi.fn();
const mockPaidOverview = vi.fn();
const mockSocialOverview = vi.fn();
const mockRevenueOverview = vi.fn();
const mockJourneys = vi.fn();
const mockPaidConnections = vi.fn();
const mockSocialCatalogue = vi.fn();
const mockPublications = vi.fn();
const mockCalendarUpcoming = vi.fn();
const mockTenant = vi.fn();
const mockBuildDashboardPriorities = vi.fn();
const mockBuildDashboardActivity = vi.fn();
const mockMarketingCampaignCount = vi.fn();

vi.mock("@/lib/database/prisma", () => ({
  prisma: {
    marketingCampaign: {
      count: (...args: unknown[]) => mockMarketingCampaignCount(...args),
    },
  },
}));

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

vi.mock("@/server/services/publication-service", () => ({
  publicationService: {
    list: (...args: unknown[]) => mockPublications(...args),
  },
}));

vi.mock("@/server/services/calendar-service", () => ({
  calendarService: {
    listUpcoming: (...args: unknown[]) => mockCalendarUpcoming(...args),
  },
}));

vi.mock("@/server/services/marketing-command-centre-metrics", () => ({
  latestPaidSyncAt: vi.fn().mockResolvedValue(new Date("2026-09-01T00:00:00.000Z")),
  latestOrganicSyncAt: vi.fn().mockResolvedValue(new Date("2026-09-01T00:00:00.000Z")),
  buildPaidMetricSeries: vi.fn().mockResolvedValue({
    spend: [],
    revenue: [],
    conversions: [],
    roas: [],
    cpa: [],
  }),
}));

vi.mock("@/server/services/marketing-command-centre-auxiliary", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/services/marketing-command-centre-auxiliary")>();
  return {
    ...actual,
    buildDashboardPriorities: (...args: unknown[]) => mockBuildDashboardPriorities(...args),
    buildDashboardActivity: (...args: unknown[]) => mockBuildDashboardActivity(...args),
  };
});

vi.mock("@/lib/tenancy/guards", () => ({
  buildTenantContextForUser: (...args: unknown[]) => mockTenant(...args),
}));

function mockHealthyDashboardDependencies() {
  mockGetResolvedWorkspace.mockResolvedValue({
    organisations: [{ id: organisationId, name: "Acme" }],
    projects: [{ id: projectId, name: "Main" }],
    brands: [{ id: brandId, name: "Brand" }],
    preference: {
      currentOrganisationId: organisationId,
      currentProjectId: projectId,
      currentBrandId: brandId,
    },
  });
  mockTenant.mockResolvedValue({
    userId: userProfileId,
    userProfileId,
    organisationId,
    organisationRole: OrganisationRole.OWNER,
    projectId,
    brandId,
  });
  mockPaidOverview.mockResolvedValue({
    spend: 1000,
    impressions: 10000,
    clicks: 500,
    conversions: 10,
    currencies: ["GBP"],
    byProvider: {},
  });
  mockSocialOverview.mockResolvedValue({
    totals: { reach: 5000, impressions: 8000, clicks: 400, likes: 100, comments: 20, shares: 5, saves: 2 },
    byProvider: {},
    derived: { engagementRate: 2.5 },
  });
  mockRevenueOverview.mockResolvedValue({ metrics: { totalRevenue: 5000 } });
  mockJourneys.mockResolvedValue([]);
  mockPaidConnections.mockResolvedValue({ connected: false, accountSelected: false, account: null });
  mockSocialCatalogue.mockResolvedValue([]);
  mockPublications.mockResolvedValue([]);
  mockCalendarUpcoming.mockResolvedValue([]);
  mockMarketingCampaignCount.mockResolvedValue(2);
  mockBuildDashboardActivity.mockResolvedValue([{ id: "activity-1", type: "default", description: "Updated", timestamp: "2026-09-01T00:00:00.000Z" }]);
}

describe("production incident command centre resilience", () => {
  it("returns dashboard state when an optional priorities module fails", async () => {
    mockHealthyDashboardDependencies();
    mockBuildDashboardPriorities.mockRejectedValue(new Error("priorities unavailable"));

    const { marketingCommandCentreService } = await import(
      "@/server/services/marketing-command-centre-service"
    );

    const dashboard = await marketingCommandCentreService.getDashboard(userProfileId);

    expect(dashboard.workspace.organisations[0]?.id).toBe(organisationId);
    expect(dashboard.executiveKpis.length).toBeGreaterThan(0);
    expect(dashboard.priorities).toEqual([]);
    expect(dashboard.recentActivity.length).toBeGreaterThan(0);
  });
});
