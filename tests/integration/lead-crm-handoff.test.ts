import { beforeEach, describe, expect, it, vi } from "vitest";
import { leadsTenantContext, leadsTestIds } from "../helpers/leads-mocks";

const prismaMock = vi.hoisted(() => ({
  marketingLead: { findFirst: vi.fn() },
  crmHandoff: { findUnique: vi.fn(), upsert: vi.fn() },
  leadActivity: { create: vi.fn() },
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
vi.mock("@/server/services/audit-service", () => ({ recordAuditEvent: vi.fn() }));

import { leadCrmHandoffService } from "@/server/services/lead-crm-handoff-service";

describe("leadCrmHandoffService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.marketingLead.findFirst.mockResolvedValue({
      id: leadsTestIds.leadId,
      status: "QUALIFIED",
      sourcePlatform: "LINKEDIN",
      sourceCampaign: "Q3",
      source: { creationSource: "SOCIAL_COMMENT" },
      consents: [{ consentState: "UNKNOWN", marketingOptIn: false }],
    });
    prismaMock.crmHandoff.findUnique.mockResolvedValue(null);
    prismaMock.crmHandoff.upsert.mockResolvedValue({
      id: "handoff-1",
      status: "SENT",
      externalId: "fake-lead-test-1",
    });
    prismaMock.leadActivity.create.mockResolvedValue({ id: "activity-1" });
  });

  it("is idempotent for repeated handoff requests", async () => {
    prismaMock.crmHandoff.findUnique.mockResolvedValueOnce({
      id: "handoff-1",
      status: "SENT",
      externalId: "fake-lead-test-1",
    });

    const result = await leadCrmHandoffService.handoff(
      leadsTestIds.brandId,
      leadsTestIds.organisationId,
      leadsTestIds.leadId,
      { provider: "FAKE", idempotencyKey: "handoff-key-12345678" },
      leadsTenantContext,
    );

    expect(result.duplicate).toBe(true);
    expect(result.handoff.status).toBe("SENT");
  });
});
