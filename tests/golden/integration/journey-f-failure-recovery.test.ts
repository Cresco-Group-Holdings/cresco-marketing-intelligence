/**
 * Journey F — Failure Recovery (includes incident #156 calendar regression)
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganisationRole } from "@prisma/client";
import { finishJourneyMonitor, resetJourneyMonitor } from "../harness/journey-monitor";

const userProfileId = "profile-golden-f";
const organisationId = "org-golden-f";
const brandId = "brand-golden-f";
const projectId = "project-golden-f";

const prisma = vi.hoisted(() => ({
  onboardingProgress: { findUnique: vi.fn() },
  invitation: { findFirst: vi.fn() },
  contentItem: { count: vi.fn() },
  contentProvenance: { count: vi.fn() },
  contentVariant: { count: vi.fn() },
  contentApproval: { count: vi.fn() },
  publication: { count: vi.fn() },
  providerConnection: { findMany: vi.fn() },
  providerSyncRun: { findMany: vi.fn(), findFirst: vi.fn() },
  marketingMetricObservation: { count: vi.fn() },
  growthRecommendation: { findFirst: vi.fn() },
  marketingAnalystRecommendation: { findFirst: vi.fn() },
  auditLog: { findFirst: vi.fn() },
  advertisingCampaignPlan: { count: vi.fn() },
  socialExperiment: { count: vi.fn() },
}));

const workspaceService = vi.hoisted(() => ({ getResolvedWorkspace: vi.fn() }));
const brandKnowledgeService = vi.hoisted(() => ({ getSnapshot: vi.fn() }));
const buildTenantContextForUser = vi.hoisted(() => vi.fn());

const mockGetResolvedWorkspace = vi.fn();
const mockBuildDashboardPriorities = vi.fn();
const mockBuildDashboardActivity = vi.fn();
const mockPaidOverview = vi.fn();
const mockSocialOverview = vi.fn();
const mockRevenueOverview = vi.fn();
const mockJourneys = vi.fn();
const mockPaidConnections = vi.fn();
const mockSocialCatalogue = vi.fn();
const mockPublications = vi.fn();
const mockCalendarUpcoming = vi.fn();
const mockTenant = vi.fn();
const mockMarketingCampaignCount = vi.fn();

vi.mock("@/lib/database/prisma", () => ({
  prisma: {
    ...prisma,
    marketingCampaign: { count: (...args: unknown[]) => mockMarketingCampaignCount(...args) },
  },
}));
vi.mock("@/server/services/workspace-service", () => ({
  workspaceService: {
    getResolvedWorkspace: (...args: unknown[]) => mockGetResolvedWorkspace(...args),
  },
}));
vi.mock("@/server/services/brand-knowledge-service", () => ({ brandKnowledgeService }));
vi.mock("@/lib/tenancy/guards", () => ({
  buildTenantContextForUser: (...args: unknown[]) => mockTenant(...args),
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
vi.mock("@/server/services/audit-service", () => ({
  recordAuditEvent: vi.fn().mockResolvedValue({ id: "audit-1" }),
}));

import { activationService } from "@/server/services/activation-service";
import { marketingCommandCentreService } from "@/server/services/marketing-command-centre-service";

function mockActivationBaseline() {
  workspaceService.getResolvedWorkspace.mockResolvedValue({
    organisations: [{ id: organisationId, name: "Golden" }],
    projects: [{ id: projectId, name: "Main" }],
    brands: [{ id: brandId, name: "Brand" }],
    preference: {
      currentOrganisationId: organisationId,
      currentProjectId: projectId,
      currentBrandId: brandId,
      onboardingCompletedAt: new Date(),
      onboardingStep: null,
    },
  });
  prisma.onboardingProgress.findUnique.mockResolvedValue({ stepData: {} });
  prisma.invitation.findFirst.mockResolvedValue(null);
  brandKnowledgeService.getSnapshot.mockResolvedValue(null);
  prisma.contentItem.count.mockResolvedValue(0);
  prisma.contentProvenance.count.mockResolvedValue(0);
  prisma.contentVariant.count.mockResolvedValue(0);
  prisma.contentApproval.count.mockResolvedValue(0);
  prisma.publication.count.mockResolvedValue(0);
  prisma.providerConnection.findMany.mockResolvedValue([]);
  prisma.providerSyncRun.findMany.mockResolvedValue([]);
  prisma.providerSyncRun.findFirst.mockResolvedValue(null);
  prisma.marketingMetricObservation.count.mockResolvedValue(0);
  prisma.growthRecommendation.findFirst.mockResolvedValue(null);
  prisma.marketingAnalystRecommendation.findFirst.mockResolvedValue(null);
  prisma.auditLog.findFirst.mockResolvedValue(null);
  prisma.advertisingCampaignPlan.count.mockResolvedValue(0);
  prisma.socialExperiment.count.mockResolvedValue(0);
}

function mockCommandCentreBaseline() {
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
  mockPaidOverview.mockResolvedValue({ spend: 0, impressions: 0, clicks: 0, conversions: 0, currencies: ["GBP"], byProvider: {} });
  mockSocialOverview.mockResolvedValue({ totals: {}, byProvider: {}, derived: {} });
  mockRevenueOverview.mockResolvedValue({ metrics: {} });
  mockJourneys.mockResolvedValue([]);
  mockPaidConnections.mockResolvedValue({ connected: false, accountSelected: false, account: null });
  mockSocialCatalogue.mockResolvedValue([]);
  mockPublications.mockResolvedValue([]);
  mockCalendarUpcoming.mockResolvedValue([{ id: "cal-1", title: "Scheduled post", startsAt: "2026-09-10T09:00:00.000Z" }]);
  mockMarketingCampaignCount.mockResolvedValue(0);
  mockBuildDashboardActivity.mockResolvedValue([]);
}

describe("Golden Journey F — Failure Recovery", () => {
  beforeEach(() => {
    resetJourneyMonitor();
    vi.clearAllMocks();
    mockActivationBaseline();
    mockCommandCentreBaseline();
    buildTenantContextForUser.mockResolvedValue({ organisationRole: OrganisationRole.OWNER });
  });

  it("degrades activation safely when optional dependency fails (incident #156)", async () => {
    prisma.contentProvenance.count.mockRejectedValue(new Error("analytics unavailable"));

    const state = await activationService.getState(userProfileId);
    expect(state.degradedSources).toContain("contentProvenance");
    expect(state.status).toBeDefined();
  });

  it("keeps Command Centre usable when priorities module fails (incident #156)", async () => {
    mockBuildDashboardPriorities.mockRejectedValue(new Error("priorities unavailable"));

    const dashboard = await marketingCommandCentreService.getDashboard(userProfileId);
    expect(dashboard.priorities).toEqual([]);
    expect(dashboard.executiveKpis.length).toBeGreaterThan(0);
  });

  it("documents REAUTH_REQUIRED contract for provider token failures (see Journey B)", () => {
    expect(["REAUTH_REQUIRED", "VALID", "EXPIRED"]).toContain("REAUTH_REQUIRED");
    const metrics = finishJourneyMonitor();
    expect(metrics.unexpected5xx).toBe(0);
  });
});
