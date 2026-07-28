import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganisationRole } from "@prisma/client";
import { hasPermission, PERMISSIONS } from "@/lib/tenancy/permissions";

const prismaMock = vi.hoisted(() => ({
  brandProfile: { findUnique: vi.fn() },
  marketingObjective: { findMany: vi.fn() },
  marketingAsset: { findMany: vi.fn() },
  connectorAccount: { findMany: vi.fn() },
}));

vi.mock("@/lib/database/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/server/services/workspace-service", () => ({
  workspaceService: {
    getResolvedWorkspace: vi.fn(),
  },
}));
vi.mock("@/lib/tenancy/guards", () => ({
  buildTenantContextForUser: vi.fn(),
}));
vi.mock("@/server/services/brand-knowledge-service", () => ({
  brandKnowledgeService: {
    getSnapshot: vi.fn(),
  },
}));
vi.mock("@/server/services/audit-service", () => ({
  auditService: {
    list: vi.fn(),
  },
}));
vi.mock("@/lib/ai/providers", () => ({
  listConfiguredProviders: vi.fn(() => [
    { provider: "MOCK", configured: true },
    { provider: "OPENAI", configured: false },
  ]),
}));

import { workspaceService } from "@/server/services/workspace-service";
import { buildTenantContextForUser } from "@/lib/tenancy/guards";
import { brandKnowledgeService } from "@/server/services/brand-knowledge-service";
import { auditService } from "@/server/services/audit-service";
import { foundationDashboardService } from "@/server/services/foundation-dashboard-service";

describe("foundationDashboardService", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(workspaceService.getResolvedWorkspace).mockResolvedValue({
      organisations: [{ id: "org-1", name: "Cresco", slug: "cresco" }],
      projects: [{ id: "project-1", name: "Grants", slug: "grants" }],
      brands: [{ id: "brand-1", name: "Cresco Grants", slug: "cresco-grants", projectId: "project-1" }],
      preference: {
        currentOrganisationId: "org-1",
        currentProjectId: "project-1",
        currentBrandId: "brand-1",
        onboardingCompletedAt: new Date("2025-01-01T00:00:00.000Z"),
        onboardingStep: null,
      },
    } as never);

    vi.mocked(buildTenantContextForUser).mockResolvedValue({
      userId: "auth-1",
      userProfileId: "profile-1",
      organisationId: "org-1",
      organisationRole: OrganisationRole.OWNER,
    });

    prismaMock.brandProfile.findUnique.mockResolvedValue({
      shortDescription: "Short",
      targetAudience: "Charities",
      valueProposition: "Funding support",
    });
    prismaMock.marketingObjective.findMany.mockResolvedValue([
      {
        id: "obj-1",
        objectiveType: "LEAD_GENERATION",
        priority: 1,
        status: "ACTIVE",
      },
    ]);
    prismaMock.marketingAsset.findMany.mockResolvedValue([
      { id: "asset-1", approvedForMarketing: true, assetType: "IMAGE" },
    ]);
    prismaMock.connectorAccount.findMany.mockResolvedValue([
      { status: "CONNECTED", connectorType: "GOOGLE_ANALYTICS_4" },
    ]);

    vi.mocked(brandKnowledgeService.getSnapshot).mockResolvedValue({
      brand: {
        name: "Cresco Grants",
        description: null,
        website: null,
        primaryDomain: null,
        logoUrl: "https://example.com/logo.png",
        faviconUrl: null,
        primaryColour: null,
        secondaryColour: null,
        accentColour: null,
      },
      profile: {
        shortDescription: "Short",
        valueProposition: "Value",
        targetAudience: "Charities",
      },
      messaging: { ctaLibrary: ["Apply now"] },
      audiences: [],
      personas: [],
      offers: [],
      voice: null,
      competitors: [],
      assets: [],
      references: [],
      complianceRules: [],
    } as never);

    vi.mocked(auditService.list).mockResolvedValue([
      {
        id: "audit-1",
        action: "connector.connect.complete",
        resourceType: "ConnectorAccount",
        createdAt: new Date("2025-01-02T00:00:00.000Z"),
      },
    ] as never);
  });

  it("returns real configuration metrics without fabricated analytics", async () => {
    const dashboard = await foundationDashboardService.getDashboard("profile-1");

    expect(dashboard.workspace.brand?.name).toBe("Cresco Grants");
    expect(dashboard.metrics.connectedChannelCount).toBe(1);
    expect(dashboard.metrics.marketingObjectiveCount).toBe(1);
    expect(dashboard.metrics.marketingAssetCount).toBe(1);
    expect(dashboard.readiness).toHaveLength(9);
    expect(dashboard.nextActions.length).toBeGreaterThan(0);
    expect(JSON.stringify(dashboard)).not.toMatch(/traffic|revenue|roi/i);
  });

  it("scopes audit activity to the current organisation", async () => {
    const dashboard = await foundationDashboardService.getDashboard("profile-1");
    expect(dashboard.recentActivity).toHaveLength(1);
    expect(auditService.list).toHaveBeenCalledWith("org-1", 12);
  });

  it("hides audit activity when the user lacks permission", async () => {
    vi.mocked(buildTenantContextForUser).mockResolvedValue({
      userId: "auth-2",
      userProfileId: "profile-2",
      organisationId: "org-1",
      organisationRole: OrganisationRole.VIEWER,
    });

    const dashboard = await foundationDashboardService.getDashboard("profile-2");
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["auditLogs.read"])).toBe(false);
    expect(dashboard.recentActivity).toEqual([]);
    expect(dashboard.canViewAuditActivity).toBe(false);
  });

  it("handles an empty workspace without a selected brand", async () => {
    vi.mocked(workspaceService.getResolvedWorkspace).mockResolvedValue({
      organisations: [],
      projects: [],
      brands: [],
      preference: {
        currentOrganisationId: null,
        currentProjectId: null,
        currentBrandId: null,
        onboardingCompletedAt: null,
        onboardingStep: "ORGANISATION",
      },
    } as never);

    const dashboard = await foundationDashboardService.getDashboard("profile-1");
    expect(dashboard.workspace.organisation).toBeNull();
    expect(dashboard.metrics.knowledgeOverallScore).toBeNull();
    expect(dashboard.readiness.find((item) => item.category === "workspace")?.status).toBe(
      "blocked",
    );
  });
});
