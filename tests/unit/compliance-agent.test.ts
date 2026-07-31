import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganisationRole } from "@prisma/client";
import { hasPermission, PERMISSIONS } from "@/lib/tenancy/permissions";

const prismaMock = vi.hoisted(() => ({
  compliancePolicy: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  complianceEvaluation: { create: vi.fn(), findFirst: vi.fn() },
  complianceFinding: { update: vi.fn() },
  complianceOverride: { create: vi.fn() },
  brandComplianceRule: { findMany: vi.fn() },
  contentItem: { findFirst: vi.fn() },
  contentComplianceCheck: { deleteMany: vi.fn(), createMany: vi.fn() },
}));

vi.mock("@/lib/database/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/server/services/workspace-service", () => ({
  brandService: { getById: vi.fn().mockResolvedValue({ id: "brand-1", projectId: "project-1" }) },
}));
vi.mock("@/server/services/audit-service", () => ({ recordAuditEvent: vi.fn() }));

import { complianceAgentService } from "@/server/services/compliance-agent-service";

const tenant = {
  organisationId: "org-1",
  userProfileId: "user-1",
  userId: "user-1",
  organisationRole: OrganisationRole.ADMIN,
};

describe("compliance permissions", () => {
  it("allows compliance officers to override findings", () => {
    expect(hasPermission(OrganisationRole.ADMIN, PERMISSIONS["compliance.override"])).toBe(true);
  });

  it("prevents viewers from overriding findings", () => {
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["compliance.override"])).toBe(false);
  });
});

describe("compliance overrides", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.complianceEvaluation.findFirst.mockResolvedValue({
      id: "eval-1",
      projectId: "project-1",
      policyId: "policy-1",
      findings: [
        {
          id: "finding-1",
          ruleReference: "GRANT_OUTDATED_DEADLINE",
          isBlocking: true,
          status: "OPEN",
        },
      ],
    });
    prismaMock.complianceOverride.create.mockResolvedValue({ id: "override-1" });
  });

  it("rejects override for technical non-overridable findings", async () => {
    prismaMock.complianceEvaluation.findFirst.mockResolvedValue({
      id: "eval-1",
      projectId: "project-1",
      policyId: "policy-1",
      findings: [
        {
          id: "finding-1",
          ruleReference: "UNSUPPORTED_PLATFORM_FORMAT",
          isBlocking: true,
          status: "OPEN",
        },
      ],
    });

    await expect(
      complianceAgentService.overrideFinding(
        "brand-1",
        "org-1",
        "content-1",
        { findingId: "finding-1", reason: "Attempting to override technical failure." },
        tenant,
      ),
    ).rejects.toThrow("cannot be overridden");
  });

  it("records override for eligible findings", async () => {
    const result = await complianceAgentService.overrideFinding(
      "brand-1",
      "org-1",
      "content-1",
      { findingId: "finding-1", reason: "Legal reviewed and approved with documented rationale." },
      tenant,
    );
    expect(result.id).toBe("override-1");
    expect(prismaMock.complianceFinding.update).toHaveBeenCalled();
  });
});

describe("cross-tenant isolation", () => {
  it("rejects evaluation when content is not found in tenant scope", async () => {
    prismaMock.compliancePolicy.findMany.mockResolvedValue([{ id: "policy-1", version: 1, rules: [], requiredDisclaimers: [] }]);
    prismaMock.contentItem.findFirst.mockResolvedValue(null);
    await expect(
      complianceAgentService.evaluate("brand-1", "org-other", "content-1", tenant),
    ).rejects.toThrow("Content item was not found.");
  });
});
