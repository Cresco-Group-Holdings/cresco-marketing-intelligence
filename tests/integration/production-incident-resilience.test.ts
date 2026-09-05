import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganisationRole } from "@prisma/client";
import { AppError } from "@/lib/errors";
import type { DataFreshnessState } from "@/lib/marketing-intelligence/types";

const userProfileId = "user-1";
const organisationId = "org-1";
const projectId = "project-1";
const brandId = "brand-1";

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

const workspaceService = vi.hoisted(() => ({
  getResolvedWorkspace: vi.fn(),
}));

const brandKnowledgeService = vi.hoisted(() => ({
  getSnapshot: vi.fn(),
}));

const buildTenantContextForUser = vi.hoisted(() => vi.fn());

vi.mock("@/lib/database/prisma", () => ({ prisma }));
vi.mock("@/server/services/workspace-service", () => ({ workspaceService }));
vi.mock("@/server/services/brand-knowledge-service", () => ({ brandKnowledgeService }));
vi.mock("@/lib/tenancy/guards", () => ({ buildTenantContextForUser }));
vi.mock("@/server/services/audit-service", () => ({
  recordAuditEvent: vi.fn().mockResolvedValue({ id: "audit-1" }),
}));

import { activationService } from "@/server/services/activation-service";

function mockWorkspace() {
  workspaceService.getResolvedWorkspace.mockResolvedValue({
    organisations: [{ id: organisationId, name: "Acme" }],
    projects: [{ id: projectId, name: "Main" }],
    brands: [{ id: brandId, name: "Brand" }],
    preference: {
      currentOrganisationId: organisationId,
      currentProjectId: projectId,
      currentBrandId: brandId,
      onboardingCompletedAt: new Date("2026-08-01T00:00:00.000Z"),
      onboardingStep: null,
    },
  });
}

function mockActivationBaseline() {
  prisma.onboardingProgress.findUnique.mockResolvedValue({ stepData: {} });
  prisma.invitation.findFirst.mockResolvedValue(null);
  buildTenantContextForUser.mockResolvedValue({ organisationRole: OrganisationRole.OWNER });
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
}

describe("production incident resilience", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWorkspace();
    mockActivationBaseline();
  });

  it("returns activation state when optional analytics lookup fails", async () => {
    prisma.contentProvenance.count.mockRejectedValue(new Error("analytics unavailable"));

    const state = await activationService.getState(userProfileId);

    expect(state.status).toBeDefined();
    expect(state.degradedSources).toContain("contentProvenance");
  });

  it("returns controlled tenant errors for invalid organisation membership", async () => {
    buildTenantContextForUser.mockRejectedValue(
      new AppError("ORGANISATION_MEMBERSHIP_REQUIRED", "No access"),
    );

    await expect(activationService.getState(userProfileId)).rejects.toMatchObject({
      code: "ORGANISATION_MEMBERSHIP_REQUIRED",
    });
  });

  it("keeps command centre priorities empty when auxiliary queries fail", async () => {
    prisma.publication.count.mockRejectedValue(new Error("db down"));
    prisma.advertisingCampaignPlan.count.mockResolvedValue(0);
    prisma.socialExperiment.count.mockResolvedValue(0);
    prisma.contentItem.count.mockResolvedValue(0);
    prisma.providerConnection.findMany.mockResolvedValue([]);
    prisma.providerSyncRun.findMany.mockResolvedValue([]);

    const { buildDashboardPriorities } = await import(
      "@/server/services/marketing-command-centre-auxiliary"
    );

    await expect(
      buildDashboardPriorities({
        brandId,
        organisationId,
        tenant: {
          userId: userProfileId,
          userProfileId,
          organisationId,
          organisationRole: OrganisationRole.OWNER,
          projectId,
          brandId,
        },
        paidFreshness: "current" as DataFreshnessState,
        organicFreshness: "current" as DataFreshnessState,
        paidLabels: [],
        organicLabels: [],
      }),
    ).rejects.toThrow("db down");
  });
});
