import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BrandMarketingChannel,
  GrowthRecommendationStatus,
  MarketingAnalystRecommendationStatus,
  OrganisationRole,
  ProviderConnectionStatus,
  ProviderSyncRunStatus,
} from "@prisma/client";
import { createEmptyMilestoneSnapshot } from "@/lib/activation/status";

const userProfileId = "user-1";
const organisationId = "org-1";
const projectId = "project-1";
const brandId = "brand-1";

const prisma = vi.hoisted(() => ({
  onboardingProgress: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
  },
  invitation: {
    findFirst: vi.fn(),
  },
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

function mockWorkspace(overrides: Record<string, unknown> = {}) {
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
    ...overrides,
  });
}

function mockBaselineQueries() {
  prisma.onboardingProgress.findUnique.mockResolvedValue({ stepData: {} });
  prisma.invitation.findFirst.mockResolvedValue(null);
  buildTenantContextForUser.mockResolvedValue({
    organisationRole: OrganisationRole.OWNER,
  });
  brandKnowledgeService.getSnapshot.mockResolvedValue({
    brand: { name: "Brand", description: "Desc", website: null, primaryDomain: null, logoUrl: null, faviconUrl: null, primaryColour: null, secondaryColour: null, accentColour: null },
    profile: { shortDescription: "Short", valueProposition: "Value", targetAudience: "SMB" },
    messaging: { coreMessage: "Message", elevatorPitch: null, ctaLibrary: [] },
    audiences: [{ name: "SMB marketers", archivedAt: null }],
    personas: [],
    offers: [{ name: "Platform", archivedAt: null }],
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

describe("activationService integration progression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWorkspace();
    mockBaselineQueries();
  });

  it("starts with empty workspace milestones", async () => {
    workspaceService.getResolvedWorkspace.mockResolvedValue({
      organisations: [],
      projects: [],
      brands: [],
      preference: {
        currentOrganisationId: null,
        currentProjectId: null,
        currentBrandId: null,
        onboardingCompletedAt: null,
        onboardingStep: null,
      },
    });

    const state = await activationService.getState(userProfileId);
    expect(state.status).toBe("not_started");
    expect(state.isActivated).toBe(false);
    expect(state.workspace.organisation).toBeNull();
  });

  it("recognises organisation, project, and brand readiness", async () => {
    const state = await activationService.getState(userProfileId);
    expect(state.checklist.essential.find((item) => item.id === "organisation_ready")?.status).toBe(
      "complete",
    );
    expect(state.checklist.essential.find((item) => item.id === "brand_ready")?.status).toBe("complete");
  });

  it("requires real provider connection for data source milestone", async () => {
    prisma.providerConnection.findMany.mockResolvedValue([
      { providerKey: "ga4", status: ProviderConnectionStatus.CONNECTED },
    ]);
    prisma.providerSyncRun.findFirst.mockResolvedValue({ id: "sync-1" });

    const state = await activationService.getState(userProfileId);
    const connectItem = state.checklist.essential.find((item) => item.id === "first_provider_connected");
    expect(connectItem?.status).toBe("complete");
  });

  it("does not treat demo mode as real provider connection", async () => {
    prisma.onboardingProgress.findUnique.mockResolvedValue({
      stepData: { demoModeEnabled: true },
    });

    const state = await activationService.getState(userProfileId);
    const connectItem = state.checklist.essential.find((item) => item.id === "first_provider_connected");
    expect(connectItem?.status).not.toBe("complete");
    expect(state.isActivated).toBe(false);
  });

  it("marks analytics ready only from observations, not sync completion", async () => {
    prisma.providerConnection.findMany.mockResolvedValue([
      { providerKey: "ga4", status: ProviderConnectionStatus.CONNECTED },
    ]);
    prisma.providerSyncRun.findFirst.mockResolvedValue({ id: "sync-1" });
    prisma.marketingMetricObservation.count.mockResolvedValue(0);

    const state = await activationService.getState(userProfileId);
    const analyticsMilestone = state.checklist.optional.find(
      (item) => item.id === "first_analytics_observation",
    );
    expect(analyticsMilestone?.status).not.toBe("complete");
  });

  it("marks first insight only from canonical recommendations", async () => {
    prisma.providerConnection.findMany.mockResolvedValue([
      { providerKey: "ga4", status: ProviderConnectionStatus.CONNECTED },
    ]);
    prisma.marketingMetricObservation.count.mockResolvedValue(5);
    prisma.growthRecommendation.findFirst.mockResolvedValue({
      id: "rec-1",
      status: GrowthRecommendationStatus.ACTIVE,
    });
    prisma.contentProvenance.count.mockResolvedValue(1);

    const state = await activationService.getState(userProfileId);
    const insightItem = state.checklist.essential.find(
      (item) => item.id === "first_recommendation_generated",
    );
    expect(insightItem?.status).toBe("complete");
    expect(state.isActivated).toBe(true);
  });

  it("accepts marketing analyst recommendations as first insight", async () => {
    prisma.providerConnection.findMany.mockResolvedValue([
      { providerKey: "ga4", status: ProviderConnectionStatus.CONNECTED },
    ]);
    prisma.marketingMetricObservation.count.mockResolvedValue(3);
    prisma.marketingAnalystRecommendation.findFirst.mockResolvedValue({
      id: "analyst-1",
      status: MarketingAnalystRecommendationStatus.OPEN,
    });
    prisma.contentProvenance.count.mockResolvedValue(1);

    const state = await activationService.getState(userProfileId);
    expect(
      state.checklist.essential.find((item) => item.id === "first_recommendation_generated")?.status,
    ).toBe("complete");
  });

  it("does not treat recommendation view audit as generated insight", async () => {
    prisma.providerConnection.findMany.mockResolvedValue([
      { providerKey: "ga4", status: ProviderConnectionStatus.CONNECTED },
    ]);
    prisma.contentProvenance.count.mockResolvedValue(1);
    prisma.auditLog.findFirst.mockImplementation(async ({ where }) => {
      if (where.action === "activation.first_recommendation_view") {
        return { id: "view-1" };
      }
      return null;
    });

    const state = await activationService.getState(userProfileId);
    expect(
      state.checklist.essential.find((item) => item.id === "first_recommendation_generated")?.status,
    ).not.toBe("complete");
    expect(
      state.checklist.optional.find((item) => item.id === "first_recommendation_viewed")?.status,
    ).toBe("complete");
  });

  it("marks provider complete for member without integration permission when workspace connected", async () => {
    buildTenantContextForUser.mockResolvedValue({
      organisationRole: OrganisationRole.VIEWER,
    });
    prisma.providerConnection.findMany.mockResolvedValue([
      { providerKey: "ga4", status: ProviderConnectionStatus.CONNECTED },
    ]);

    const state = await activationService.getState(userProfileId);
    const connectItem = state.checklist.essential.find((item) => item.id === "first_provider_connected");
    expect(connectItem?.status).toBe("complete");
  });

  it("shows requires_admin when member cannot connect and workspace has no provider", async () => {
    buildTenantContextForUser.mockResolvedValue({
      organisationRole: OrganisationRole.VIEWER,
    });

    const state = await activationService.getState(userProfileId);
    const connectItem = state.checklist.essential.find((item) => item.id === "first_provider_connected");
    expect(connectItem?.status).toBe("requires_admin");
    expect(connectItem?.consequence).toContain("Organisation Owner or Admin");
  });

  it("emits activation_complete once when workspace becomes activated", async () => {
    prisma.providerConnection.findMany.mockResolvedValue([
      { providerKey: "ga4", status: ProviderConnectionStatus.CONNECTED },
    ]);
    prisma.contentProvenance.count.mockResolvedValue(1);
    prisma.growthRecommendation.findFirst.mockResolvedValue({ id: "rec-1" });

    await activationService.getState(userProfileId);
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "activation.activation_complete" }),
    );

    vi.mocked(recordAuditEvent).mockClear();
    prisma.auditLog.findFirst.mockImplementation(async ({ where }) => {
      if (where.action === "activation.activation_complete") {
        return { id: "complete-1" };
      }
      return null;
    });

    await activationService.getState(userProfileId);
    expect(recordAuditEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: "activation.activation_complete" }),
    );
  });
});

describe("activationService recordEvent trust", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWorkspace();
  });

  it("rejects client domain-asserting events", async () => {
    await expect(
      activationService.recordEvent(userProfileId, "first_publication_scheduled"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("deduplicates idempotent behavioural events", async () => {
    prisma.auditLog.findFirst.mockResolvedValue({ id: "existing" });

    const result = await activationService.recordEvent(userProfileId, "first_analytics_view");
    expect(result).toEqual({ id: "existing" });
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it("records behavioural analytics events", async () => {
    prisma.auditLog.findFirst.mockResolvedValue(null);

    await activationService.recordEvent(userProfileId, "first_recommendation_view");
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "activation.first_recommendation_view" }),
    );
  });
});

describe("activation milestone snapshot helpers", () => {
  it("includes first_recommendation_viewed in empty snapshot", () => {
    const snapshot = createEmptyMilestoneSnapshot();
    expect(snapshot.first_recommendation_viewed).toBe(false);
  });
});
