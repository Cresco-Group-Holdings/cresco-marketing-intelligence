import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  crmLead: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  crmLeadStatusHistory: { create: vi.fn() },
  crmActivityTimelineItem: { create: vi.fn() },
  crmQualificationAssessment: { create: vi.fn() },
  crmConsentRecord: { create: vi.fn() },
  crmLeadManualScore: { updateMany: vi.fn(), create: vi.fn() },
  crmContactMethod: { findMany: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/database/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/server/services/workspace-service", () => ({
  brandService: {
    getById: vi.fn().mockResolvedValue({
      id: "brand-1",
      projectId: "project-1",
    }),
  },
}));
vi.mock("@/server/services/audit-service", () => ({
  recordAuditEvent: vi.fn(),
}));

import { crmLeadCoreService } from "@/server/services/crm-lead-core-service";

const tenantContext = {
  userId: "user-1",
  userProfileId: "profile-1",
  organisationId: "org-1",
};

describe("crmLeadCoreService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) =>
      fn(prismaMock),
    );
    prismaMock.crmLead.findFirst.mockResolvedValue({
      id: "lead-1",
      organisationId: "org-1",
      brandId: "brand-1",
      projectId: "project-1",
      status: "NEW",
      lifecycleStage: "LEAD",
      qualificationState: "UNASSESSED",
      retentionStatus: "ACTIVE",
      person: { contactMethods: [], displayName: "Alex" },
      company: null,
      source: { sourceType: "MANUAL_ENTRY", utmCampaign: "spring" },
      consentRecords: [],
      qualificationAssessments: [],
      manualScores: [],
    });
    prismaMock.crmLead.update.mockResolvedValue({ id: "lead-1", status: "CONTACTED" });
    prismaMock.crmLeadStatusHistory.create.mockResolvedValue({ id: "hist-1" });
    prismaMock.crmActivityTimelineItem.create.mockResolvedValue({ id: "timeline-1" });
    prismaMock.crmConsentRecord.create.mockResolvedValue({ id: "consent-1" });
    prismaMock.crmQualificationAssessment.create.mockResolvedValue({ id: "qa-1" });
    prismaMock.crmLeadManualScore.create.mockResolvedValue({ id: "score-1", score: 80, maxScore: 100 });
  });

  it("enforces tenant isolation when loading leads", async () => {
    prismaMock.crmLead.findFirst.mockResolvedValue(null);
    await expect(
      crmLeadCoreService.getLeadCore("lead-1", "brand-1", "org-1", tenantContext),
    ).rejects.toThrow("CRM lead not found");
    expect(prismaMock.crmLead.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organisationId: "org-1",
          brandId: "brand-1",
          archivedAt: null,
        }),
      }),
    );
  });

  it("transitions leads through the workflow", async () => {
    const result = await crmLeadCoreService.transitionLead(
      "lead-1",
      "brand-1",
      "org-1",
      "CONTACTED",
      "Called prospect",
      tenantContext,
    );
    expect(result.status).toBe("CONTACTED");
    expect(prismaMock.crmLeadStatusHistory.create).toHaveBeenCalled();
  });

  it("rejects invalid workflow transitions", async () => {
    await expect(
      crmLeadCoreService.transitionLead(
        "lead-1",
        "brand-1",
        "org-1",
        "WON",
        undefined,
        tenantContext,
      ),
    ).rejects.toThrow("Cannot transition");
  });

  it("records consent with audit trail", async () => {
    const consent = await crmLeadCoreService.recordConsent(
      "brand-1",
      "org-1",
      {
        leadId: "lead-1",
        channel: "EMAIL",
        status: "GRANTED",
        marketingOptIn: true,
        lawfulBasis: "CONSENT",
      },
      tenantContext,
    );
    expect(consent.id).toBe("consent-1");
    expect(prismaMock.crmConsentRecord.create).toHaveBeenCalled();
  });

  it("exports lead data with campaign attribution", async () => {
    const exported = await crmLeadCoreService.exportLead(
      "lead-1",
      "brand-1",
      "org-1",
      "FULL",
      tenantContext,
    );
    expect(exported.lead).toMatchObject({
      id: "lead-1",
      sourceType: "MANUAL_ENTRY",
      utmCampaign: "spring",
    });
  });

  it("prepares anonymisation requests", async () => {
    const preview = await crmLeadCoreService.prepareAnonymisation(
      "lead-1",
      "brand-1",
      "org-1",
      tenantContext,
    );
    expect(preview.retentionStatus).toBe("ANONYMISED");
    expect(prismaMock.crmLead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ retentionStatus: "DELETION_REQUESTED" }),
      }),
    );
  });
});
