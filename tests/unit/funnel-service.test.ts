import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganisationRole } from "@prisma/client";
import { hasPermission, PERMISSIONS } from "@/lib/tenancy/permissions";
import { CRESCO_GRANTS_FUNNEL_TEMPLATE } from "@/lib/funnel/templates";

const prismaMock = vi.hoisted(() => ({
  organisation: { findFirst: vi.fn() },
  marketingFunnel: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  marketingFunnelVersion: { create: vi.fn() },
  marketingFunnelStep: { create: vi.fn() },
  $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(prismaMock)),
}));

vi.mock("@/lib/database/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/server/services/workspace-service", () => ({
  brandService: {
    getById: vi.fn().mockResolvedValue({ id: "brand-1", projectId: "project-1" }),
  },
}));

import { funnelService } from "@/server/services/funnel-service";

const tenant = {
  organisationId: "org-1",
  userProfileId: "user-1",
  userId: "user-1",
  organisationRole: OrganisationRole.ADMIN,
};

describe("funnel permissions", () => {
  it("allows analysts to read marketing data", () => {
    expect(hasPermission(OrganisationRole.ANALYST, PERMISSIONS["marketingData.read"])).toBe(true);
  });

  it("restricts journey samples to viewRaw permission", () => {
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["marketingData.viewRaw"])).toBe(false);
    expect(hasPermission(OrganisationRole.ADMIN, PERMISSIONS["marketingData.viewRaw"])).toBe(true);
  });
});

describe("funnel service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects cross-tenant funnel access", async () => {
    prismaMock.marketingFunnel.findFirst.mockResolvedValue(null);
    await expect(funnelService.getFunnel("brand-1", "org-1", "funnel-x", tenant)).rejects.toThrow(
      "Funnel was not found.",
    );
  });

  it("blocks Cresco templates for external organisations", async () => {
    prismaMock.organisation.findFirst.mockResolvedValue({ id: "org-1", slug: "external-customer" });
    await expect(
      funnelService.createFromTemplate("brand-1", "org-1", "CRESCO_GRANTS", tenant),
    ).rejects.toThrow("Cresco funnel templates are only available");
  });

  it("allows Cresco templates for internal organisation", async () => {
    prismaMock.organisation.findFirst.mockResolvedValue({ id: "org-1", slug: "cresco-group" });
    prismaMock.marketingFunnel.create.mockImplementation(async ({ data }) => ({ id: "f-1", ...data }));
    prismaMock.marketingFunnelVersion.create.mockResolvedValue({ id: "v-1" });
    prismaMock.marketingFunnel.update.mockResolvedValue({});
    prismaMock.marketingFunnelStep.create.mockResolvedValue({});
    prismaMock.marketingFunnel.findFirst.mockResolvedValue({ id: "f-1", versions: [] });

    await funnelService.createFromTemplate("brand-1", "org-1", "CRESCO_GRANTS", tenant);
    expect(prismaMock.marketingFunnelStep.create).toHaveBeenCalledTimes(
      CRESCO_GRANTS_FUNNEL_TEMPLATE.steps.length,
    );
  });

  it("returns empty templates list for external orgs", async () => {
    prismaMock.organisation.findFirst.mockResolvedValue({ id: "org-1", slug: "acme-corp" });
    const templates = await funnelService.listAvailableTemplates("org-1");
    expect(templates).toHaveLength(0);
  });
});

describe("Cresco funnel templates", () => {
  it("defines Cresco Grants funnel with ordered steps", () => {
    expect(CRESCO_GRANTS_FUNNEL_TEMPLATE.steps[0]?.name).toBe("Visitor");
    expect(CRESCO_GRANTS_FUNNEL_TEMPLATE.steps.at(-1)?.name).toBe("Subscription started");
    expect(CRESCO_GRANTS_FUNNEL_TEMPLATE.steps).toHaveLength(8);
  });
});

describe("step matcher", () => {
  it("matches lead status steps", async () => {
    const { matchesStep } = await import("@/lib/funnel/step-matcher");
    expect(
      matchesStep(
        { subjectKey: "l1", occurredAt: new Date(), leadStatus: "QUALIFIED" },
        {
          id: "s1",
          stepOrder: 1,
          name: "Qualified",
          stepType: "LEAD_STATUS",
          matchingRules: { leadStatus: "QUALIFIED" },
          requirement: "REQUIRED",
        },
      ),
    ).toBe(true);
  });
});
