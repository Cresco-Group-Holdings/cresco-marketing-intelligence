/**
 * Journey D — Weekly Operating Loop
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganisationRole } from "@prisma/client";
import { finishJourneyMonitor, resetJourneyMonitor } from "../harness/journey-monitor";

const userProfileId = "profile-golden-d";
const organisationId = "org-golden-d";
const brandId = "brand-golden-d";
const projectId = "project-golden-d";

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
  prisma: { marketingCampaign: { count: (...args: unknown[]) => mockMarketingCampaignCount(...args) } },
}));
vi.mock("@/server/services/workspace-service", () => ({
  workspaceService: { getResolvedWorkspace: (...args: unknown[]) => mockGetResolvedWorkspace(...args) },
}));
vi.mock("@/server/services/paid-ads-dashboard-service", () => ({
  paidAdsDashboardService: { getOverview: (...args: unknown[]) => mockPaidOverview(...args) },
}));
vi.mock("@/server/services/social-analytics-query-service", () => ({
  socialAnalyticsQueryService: { overview: (...args: unknown[]) => mockSocialOverview(...args) },
}));
vi.mock("@/server/services/revenue-dashboard-service", () => ({
  revenueDashboardService: { getOverview: (...args: unknown[]) => mockRevenueOverview(...args) },
}));
vi.mock("@/server/services/attribution-dashboard-service", () => ({
  attributionDashboardService: { getJourneys: (...args: unknown[]) => mockJourneys(...args) },
}));
vi.mock("@/server/services/paid-ads-connection-service", () => ({
  paidAdsConnectionService: { getConnectionStatus: (...args: unknown[]) => mockPaidConnections(...args) },
}));
vi.mock("@/server/services/social-connection-service", () => ({
  socialConnectionService: { getCatalogue: (...args: unknown[]) => mockSocialCatalogue(...args) },
}));
vi.mock("@/server/services/publication-service", () => ({
  publicationService: { list: (...args: unknown[]) => mockPublications(...args) },
}));
vi.mock("@/server/services/calendar-service", () => ({
  calendarService: { listUpcoming: (...args: unknown[]) => mockCalendarUpcoming(...args) },
}));
vi.mock("@/server/services/marketing-command-centre-metrics", () => ({
  latestPaidSyncAt: vi.fn().mockResolvedValue(new Date("2026-09-01T00:00:00.000Z")),
  latestOrganicSyncAt: vi.fn().mockResolvedValue(new Date("2026-09-01T00:00:00.000Z")),
  buildPaidMetricSeries: vi.fn().mockResolvedValue({ spend: [], revenue: [], conversions: [], roas: [], cpa: [] }),
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

import { marketingCommandCentreService } from "@/server/services/marketing-command-centre-service";

function mockHealthyDashboard() {
  mockGetResolvedWorkspace.mockResolvedValue({
    organisations: [{ id: organisationId, name: "Golden" }],
    projects: [{ id: projectId, name: "Main" }],
    brands: [{ id: brandId, name: "Brand" }],
    preference: { currentOrganisationId: organisationId, currentProjectId: projectId, currentBrandId: brandId },
  });
  mockTenant.mockResolvedValue({
    userId: userProfileId,
    userProfileId,
    organisationId,
    organisationRole: OrganisationRole.OWNER,
    projectId,
    brandId,
  });
  mockPaidOverview.mockResolvedValue({ spend: 1200, impressions: 20000, clicks: 800, conversions: 12, currencies: ["GBP"], byProvider: {} });
  mockSocialOverview.mockResolvedValue({
    totals: { reach: 9000, impressions: 12000, clicks: 600, likes: 200, comments: 40, shares: 10, saves: 5 },
    byProvider: {},
    derived: { engagementRate: 3.1 },
  });
  mockRevenueOverview.mockResolvedValue({ metrics: { totalRevenue: 8400 } });
  mockJourneys.mockResolvedValue([]);
  mockPaidConnections.mockResolvedValue({ connected: true, accountSelected: true, account: { id: "paid-1" } });
  mockSocialCatalogue.mockResolvedValue([]);
  mockPublications.mockResolvedValue([]);
  mockCalendarUpcoming.mockResolvedValue([]);
  mockMarketingCampaignCount.mockResolvedValue(2);
  mockBuildDashboardPriorities.mockResolvedValue([
    {
      id: "priority-1",
      title: "LinkedIn engagement dropped",
      severity: "high",
      evidence: ["Engagement rate fell 18% week-on-week"],
      recommendedAction: "Repurpose top-performing carousel",
    },
  ]);
  mockBuildDashboardActivity.mockResolvedValue([
    { id: "activity-1", type: "default", description: "Report generated", timestamp: "2026-09-01T00:00:00.000Z" },
  ]);
}

describe("Golden Journey D — Weekly Operating Loop", () => {
  beforeEach(() => {
    resetJourneyMonitor();
    vi.clearAllMocks();
    mockHealthyDashboard();
  });

  it("closes observe → understand → recommend loop with evidence-backed priorities", async () => {
    const dashboard = await marketingCommandCentreService.getDashboard(userProfileId);

    expect(dashboard.executiveKpis.length).toBeGreaterThan(0);
    expect(dashboard.priorities.length).toBeGreaterThan(0);
    expect(dashboard.priorities[0]?.evidence?.length).toBeGreaterThan(0);
    expect(dashboard.priorities[0]?.recommendedAction).toBeTruthy();
    expect(dashboard.recentActivity.length).toBeGreaterThan(0);

    const metrics = finishJourneyMonitor();
    expect(metrics.unexpected5xx).toBe(0);
  });
});
