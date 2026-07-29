import { beforeEach, describe, expect, it, vi } from "vitest";

const reportTestIds = {
  organisationId: "org-reports",
  projectId: "project-reports",
  brandId: "brand-reports",
  userId: "user-reports",
  reportId: "report-1",
};

const tenantContext = {
  userId: reportTestIds.userId,
  userProfileId: reportTestIds.userId,
  organisationId: reportTestIds.organisationId,
  organisationRole: "ADMIN" as const,
};

const prismaMock = vi.hoisted(() => ({
  socialReport: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  socialReportSection: { createMany: vi.fn() },
  socialReportSnapshot: { create: vi.fn() },
  socialReportExport: { create: vi.fn(), update: vi.fn() },
  socialReportSchedule: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  socialReportRecipient: { create: vi.fn() },
  organisationMembership: { findFirst: vi.fn() },
  marketingLead: { count: vi.fn() },
  socialAnalyticsSync: { count: vi.fn() },
  userProfile: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/database/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/server/services/workspace-service", () => ({
  brandService: {
    getById: vi.fn().mockResolvedValue({
      id: "brand-reports",
      projectId: "project-reports",
    }),
  },
}));
vi.mock("@/server/services/social-analytics-query-service", () => ({
  socialAnalyticsQueryService: {
    overview: vi.fn().mockResolvedValue({
      totals: { engagements: 50, impressions: 1000 },
      derived: { engagementRate: 0.05, followerGrowth: 10, publishingConsistency: 4 },
      byProvider: { LINKEDIN: { engagements: 50 } },
      postsMeasured: 4,
      accountsMeasured: 2,
    }),
    attribution: vi.fn().mockResolvedValue({
      groups: [
        {
          key: "post-1",
          label: "Launch post",
          dimension: "CONTENT_ITEM",
          postsMeasured: 1,
          totals: { engagements: 40 },
          derived: { engagementRate: 0.08 },
          score: 40,
        },
      ],
    }),
  },
}));
vi.mock("@/server/services/growth-intelligence-service", () => ({
  growthIntelligenceService: {
    listInsights: vi.fn().mockResolvedValue([{ id: "insight-1", title: "Improve hooks" }]),
  },
}));
vi.mock("@/server/services/audit-service", () => ({ recordAuditEvent: vi.fn() }));
vi.mock("@/server/services/ai-request-service", () => ({
  aiRequestService: { executeStructured: vi.fn() },
}));
vi.mock("@/server/services/brand-knowledge-service", () => ({
  brandKnowledgeService: { getSnapshot: vi.fn().mockResolvedValue({}) },
}));

import { socialReportService } from "@/server/services/social-report-service";

describe("socialReportService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.socialReport.create.mockResolvedValue({
      id: reportTestIds.reportId,
      reportType: "WEEKLY_PERFORMANCE",
      title: "Weekly report",
      status: "GENERATING",
      periodStart: new Date("2026-07-22T00:00:00.000Z"),
      periodEnd: new Date("2026-07-29T00:00:00.000Z"),
      timezone: "UTC",
      accountIds: [],
      enabledSections: [],
      selectedMetrics: [],
      customNotes: null,
      includeRecommendations: true,
      includeCrescoBranding: true,
      narrative: null,
      narrativeSource: null,
      dataLimitations: [],
      shareStatus: "DISABLED",
      shareExpiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prismaMock.socialReport.findFirst.mockResolvedValue({
      id: reportTestIds.reportId,
      organisationId: reportTestIds.organisationId,
      brandId: reportTestIds.brandId,
      reportType: "WEEKLY_PERFORMANCE",
      title: "Weekly report",
      status: "READY",
      periodStart: new Date("2026-07-22T00:00:00.000Z"),
      periodEnd: new Date("2026-07-29T00:00:00.000Z"),
      timezone: "UTC",
      accountIds: [],
      enabledSections: [],
      customNotes: null,
      includeRecommendations: true,
      includeCrescoBranding: true,
      narrative: { executiveSummary: "The data suggests steady engagement." },
      narrativeSource: "DETERMINISTIC",
      dataLimitations: [],
      shareStatus: "DISABLED",
      shareExpiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      sections: [],
      snapshots: [{ snapshotData: { overview: {} } }],
      exports: [],
      recipients: [],
    });
    prismaMock.$transaction.mockImplementation(async (input) => {
      if (Array.isArray(input)) return Promise.all(input);
      return input(prismaMock);
    });
    prismaMock.marketingLead.count.mockResolvedValue(2);
    prismaMock.socialAnalyticsSync.count.mockResolvedValue(0);
    prismaMock.socialReportExport.create.mockResolvedValue({ id: "export-1" });
    prismaMock.organisationMembership.findFirst.mockResolvedValue({ id: "membership-1" });
  });

  it("rejects recipients who are not active members", async () => {
    prismaMock.organisationMembership.findFirst.mockResolvedValue(null);

    await expect(
      socialReportService.createSchedule(
        reportTestIds.brandId,
        reportTestIds.organisationId,
        {
          reportType: "WEEKLY_PERFORMANCE",
          cadence: "WEEKLY",
          timezone: "UTC",
          recipientEmails: ["client@example.com"],
          recipientUserIds: ["removed-user"],
        },
        tenantContext,
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("rejects expired shared report links", async () => {
    prismaMock.socialReport.findFirst.mockResolvedValue({
      id: reportTestIds.reportId,
      shareToken: "token-1",
      shareStatus: "ACTIVE",
      shareExpiresAt: new Date("2020-01-01T00:00:00.000Z"),
      archivedAt: null,
      sections: [],
      snapshots: [],
    });

    await expect(socialReportService.getByShareToken("token-1")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(prismaMock.socialReport.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { shareStatus: "EXPIRED" } }),
    );
  });

  it("exports JSON report payloads", async () => {
    const exported = await socialReportService.exportReport(
      reportTestIds.brandId,
      reportTestIds.organisationId,
      reportTestIds.reportId,
      "JSON",
      tenantContext,
    );

    expect(exported.mimeType).toBe("application/json");
    expect(exported.body).toContain("Weekly report");
  });
});
