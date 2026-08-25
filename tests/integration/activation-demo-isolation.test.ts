import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganisationRole } from "@prisma/client";

const userProfileId = "user-demo";
const organisationId = "org-demo";

const prisma = vi.hoisted(() => ({
  onboardingProgress: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
  },
  invitation: { findFirst: vi.fn() },
  contentItem: { count: vi.fn(), create: vi.fn() },
  contentProvenance: { count: vi.fn(), create: vi.fn() },
  contentVariant: { count: vi.fn() },
  contentApproval: { count: vi.fn() },
  publication: { count: vi.fn(), create: vi.fn() },
  providerConnection: { findMany: vi.fn() },
  providerSyncRun: { findMany: vi.fn(), findFirst: vi.fn() },
  marketingMetricObservation: { count: vi.fn(), create: vi.fn() },
  growthRecommendation: { findFirst: vi.fn(), create: vi.fn() },
  marketingAnalystRecommendation: { findFirst: vi.fn() },
  auditLog: { findFirst: vi.fn() },
  workerJob: { create: vi.fn() },
  stripeCustomer: { create: vi.fn() },
  aiRequest: { create: vi.fn() },
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

function mockDemoWorkspace() {
  workspaceService.getResolvedWorkspace.mockResolvedValue({
    organisations: [{ id: organisationId, name: "Demo Org" }],
    projects: [{ id: "project-demo", name: "Demo Project" }],
    brands: [{ id: "brand-demo", name: "Demo Brand" }],
    preference: {
      currentOrganisationId: organisationId,
      currentProjectId: "project-demo",
      currentBrandId: "brand-demo",
      onboardingCompletedAt: null,
      onboardingStep: null,
    },
  });

  prisma.onboardingProgress.findUnique.mockResolvedValue({
    stepData: { demoModeEnabled: true },
  });
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
  prisma.auditLog.findFirst.mockResolvedValue({ id: "demo-entered" });
}

describe("activation demo isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDemoWorkspace();
  });

  it("does not mark real workspace milestones complete in demo mode", async () => {
    const state = await activationService.getState(userProfileId);

    expect(state.demoModeEnabled).toBe(true);
    expect(state.isActivated).toBe(false);
    expect(state.checklist.essential.find((item) => item.id === "first_provider_connected")?.status).not.toBe(
      "complete",
    );
    expect(state.checklist.essential.find((item) => item.id === "first_recommendation_generated")?.status).not.toBe(
      "complete",
    );
  });

  it("tracks demo product experience separately from real activation", async () => {
    const state = await activationService.getState(userProfileId);
    expect(state.demoProductExperienced).toBe(true);
    expect(state.isActivated).toBe(false);
  });

  it("does not create publications when entering demo mode", async () => {
    prisma.onboardingProgress.upsert.mockResolvedValue({ stepData: { demoModeEnabled: false } });
    prisma.onboardingProgress.update.mockResolvedValue({});

    await activationService.setDemoMode(userProfileId, true);
    expect(prisma.publication.create).not.toHaveBeenCalled();
  });

  it("does not create worker jobs when enabling demo mode", async () => {
    prisma.onboardingProgress.upsert.mockResolvedValue({ stepData: {} });
    prisma.onboardingProgress.update.mockResolvedValue({});

    await activationService.setDemoMode(userProfileId, true);
    expect(prisma.workerJob.create).not.toHaveBeenCalled();
  });

  it("does not create billing state when enabling demo mode", async () => {
    prisma.onboardingProgress.upsert.mockResolvedValue({ stepData: {} });
    prisma.onboardingProgress.update.mockResolvedValue({});

    await activationService.setDemoMode(userProfileId, true);
    expect(prisma.stripeCustomer.create).not.toHaveBeenCalled();
  });

  it("does not consume AI allowance when demo mode is active", async () => {
    const state = await activationService.getState(userProfileId);
    expect(state.demoModeEnabled).toBe(true);
    expect(prisma.aiRequest.create).not.toHaveBeenCalled();
  });

  it("reflects real workspace state after exiting demo", async () => {
    prisma.onboardingProgress.findUnique.mockResolvedValue({
      stepData: { demoModeEnabled: false },
    });

    const state = await activationService.getState(userProfileId);
    expect(state.demoModeEnabled).toBe(false);
    expect(state.isActivated).toBe(false);
    expect(state.checklist.essentialCompleted).toBeLessThan(state.checklist.essentialTotal);
  });
});
