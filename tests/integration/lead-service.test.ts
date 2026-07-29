import { beforeEach, describe, expect, it, vi } from "vitest";
import { leadsTenantContext, leadsTestIds } from "../helpers/leads-mocks";

const prismaMock = vi.hoisted(() => ({
  marketingLead: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  leadSource: { create: vi.fn() },
  leadConsent: { create: vi.fn() },
  leadActivity: { create: vi.fn() },
  organisationMembership: { findFirst: vi.fn() },
  leadAssignment: { create: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/database/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/server/services/workspace-service", () => ({
  brandService: {
    getById: vi.fn().mockResolvedValue({
      id: leadsTestIds.brandId,
      projectId: leadsTestIds.projectId,
    }),
  },
}));
vi.mock("@/server/services/audit-service", () => ({
  recordAuditEvent: vi.fn(),
}));

import { marketingLeadService } from "@/server/services/marketing-lead-service";
import { leadPrivacyService } from "@/server/services/lead-privacy-service";

describe("marketingLeadService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.marketingLead.findMany.mockResolvedValue([]);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) =>
      fn(prismaMock),
    );
    prismaMock.marketingLead.create.mockResolvedValue({
      id: leadsTestIds.leadId,
      organisationId: leadsTestIds.organisationId,
      brandId: leadsTestIds.brandId,
      projectId: leadsTestIds.projectId,
    });
    prismaMock.leadSource.create.mockResolvedValue({ id: "source-1" });
    prismaMock.leadConsent.create.mockResolvedValue({ id: "consent-1" });
    prismaMock.leadActivity.create.mockResolvedValue({ id: "activity-1" });
  });

  it("creates a lead from a social comment with attribution", async () => {
    const result = await marketingLeadService.create(
      leadsTestIds.brandId,
      leadsTestIds.organisationId,
      {
        creationSource: "SOCIAL_COMMENT",
        displayName: "Alex",
        providerUsername: "alex_biz",
        expressedInterest: "Interested in grant support",
        sourcePlatform: "LINKEDIN",
        sourcePostId: "post-1",
        sourceCampaign: "Q3 launch",
        originalInteraction: "Do you help with Innovate UK grants?",
      },
      leadsTenantContext,
    );

    expect(result.lead.id).toBe(leadsTestIds.leadId);
    expect(prismaMock.leadSource.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          creationSource: "SOCIAL_COMMENT",
          providerPostId: "post-1",
          campaignName: "Q3 launch",
        }),
      }),
    );
  });

  it("flags duplicate leads without blocking creation", async () => {
    prismaMock.marketingLead.findMany.mockResolvedValue([
      { id: "existing-lead", email: "alex@example.com" },
    ]);
    prismaMock.marketingLead.create.mockResolvedValue({
      id: "new-lead",
      isDuplicateWarning: true,
      duplicateOfLeadId: "existing-lead",
    });

    const result = await marketingLeadService.create(
      leadsTestIds.brandId,
      leadsTestIds.organisationId,
      {
        creationSource: "MANUAL",
        email: "alex@example.com",
        displayName: "Alex",
      },
      leadsTenantContext,
    );

    expect(result.duplicateWarning).toBe(true);
    expect(result.duplicateOfLeadId).toBe("existing-lead");
  });

  it("rejects social leads without interaction context", async () => {
    await expect(
      marketingLeadService.create(
        leadsTestIds.brandId,
        leadsTestIds.organisationId,
        { creationSource: "SOCIAL_MESSAGE" },
        leadsTenantContext,
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});

describe("leadPrivacyService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.marketingLead.findFirst.mockResolvedValue({
      id: leadsTestIds.leadId,
      organisationId: leadsTestIds.organisationId,
      brandId: leadsTestIds.brandId,
      projectId: leadsTestIds.projectId,
      status: "NEW",
      lawfulBasisPlaceholder: "Legitimate interest",
    });
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) =>
      fn(prismaMock),
    );
    prismaMock.marketingLead.update.mockResolvedValue({ id: leadsTestIds.leadId, status: "DELETED" });
  });

  it("deletes and redacts lead personal data", async () => {
    const deleted = await leadPrivacyService.deleteLead(
      leadsTestIds.brandId,
      leadsTestIds.organisationId,
      leadsTestIds.leadId,
      leadsTenantContext,
    );
    expect(deleted.status).toBe("DELETED");
    expect(prismaMock.marketingLead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: null,
          displayName: "[deleted]",
        }),
      }),
    );
  });
});
