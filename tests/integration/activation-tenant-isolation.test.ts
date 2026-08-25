import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganisationRole } from "@prisma/client";

const tenantA = {
  userProfileId: "user-a",
  organisationId: "org-a",
};

const tenantB = {
  userProfileId: "user-b",
  organisationId: "org-b",
};

const prisma = vi.hoisted(() => ({
  onboardingProgress: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
  },
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
  workspacePreference: { upsert: vi.fn() },
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
import { recordAuditEvent } from "@/server/services/audit-service";

function mockTenant(userProfileId: string, organisationId: string) {
  workspaceService.getResolvedWorkspace.mockImplementation(async (userId: string) => {
    if (userId !== userProfileId) {
      throw new Error("Unexpected user");
    }
    return {
      organisations: [{ id: organisationId, name: "Tenant Org" }],
      projects: [{ id: `${organisationId}-project`, name: "Project" }],
      brands: [{ id: `${organisationId}-brand`, name: "Brand" }],
      preference: {
        currentOrganisationId: organisationId,
        currentProjectId: `${organisationId}-project`,
        currentBrandId: `${organisationId}-brand`,
        onboardingCompletedAt: new Date(),
        onboardingStep: null,
      },
    };
  });

  buildTenantContextForUser.mockResolvedValue({
    organisationRole: OrganisationRole.OWNER,
  });
}

function mockEmptyQueries() {
  prisma.onboardingProgress.findUnique.mockResolvedValue({ stepData: {} });
  prisma.invitation.findFirst.mockResolvedValue(null);
  brandKnowledgeService.getSnapshot.mockResolvedValue({
    brand: { name: "Brand", description: "Desc", website: null, primaryDomain: null, logoUrl: null, faviconUrl: null, primaryColour: null, secondaryColour: null, accentColour: null },
    profile: { shortDescription: "Short", valueProposition: "Value", targetAudience: "SMB" },
    messaging: { coreMessage: "Message", elevatorPitch: null, ctaLibrary: [] },
    audiences: [{ name: "SMB", archivedAt: null }],
    personas: [],
    offers: [{ name: "Offer", archivedAt: null }],
    voice: { preferredTone: "Professional" },
    competitors: [],
    assets: [],
    references: [],
    complianceRules: [],
  } as never);
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

describe("activation tenant isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("scopes activation snapshot to the requesting tenant workspace", async () => {
    mockTenant(tenantA.userProfileId, tenantA.organisationId);
    mockEmptyQueries();

    const stateA = await activationService.getState(tenantA.userProfileId);
    expect(stateA.workspace.organisation?.id).toBe(tenantA.organisationId);

    mockTenant(tenantB.userProfileId, tenantB.organisationId);
    const stateB = await activationService.getState(tenantB.userProfileId);
    expect(stateB.workspace.organisation?.id).toBe(tenantB.organisationId);
    expect(stateB.workspace.organisation?.id).not.toBe(stateA.workspace.organisation?.id);
  });

  it("records activation events only for the caller organisation", async () => {
    mockTenant(tenantA.userProfileId, tenantA.organisationId);

    await activationService.recordEvent(tenantA.userProfileId, "first_analytics_view");
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ organisationId: tenantA.organisationId }),
    );
    expect(recordAuditEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ organisationId: tenantB.organisationId }),
    );
  });

  it("does not enable demo mode for another tenant via preferences", async () => {
    mockTenant(tenantA.userProfileId, tenantA.organisationId);
    prisma.onboardingProgress.upsert.mockResolvedValue({ stepData: {} });
    prisma.onboardingProgress.update.mockResolvedValue({});

    await activationService.setDemoMode(tenantA.userProfileId, true);
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: tenantA.organisationId,
        action: "activation.demo_workspace_entered",
      }),
    );
  });

  it("rejects cross-tenant domain event spoofing", async () => {
    mockTenant(tenantB.userProfileId, tenantB.organisationId);

    await expect(
      activationService.recordEvent(tenantB.userProfileId, "provider_connected"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
