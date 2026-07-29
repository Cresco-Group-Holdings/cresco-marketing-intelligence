import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganisationRole } from "@prisma/client";
import { hasPermission, PERMISSIONS } from "@/lib/tenancy/permissions";

const prismaMock = vi.hoisted(() => ({
  socialExperiment: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  socialPostMetric: {
    findMany: vi.fn(),
  },
  experimentResult: {
    upsert: vi.fn(),
  },
  experimentDecision: {
    upsert: vi.fn(),
  },
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

import { socialExperimentService } from "@/server/services/social-experiment-service";

const tenant = {
  organisationId: "org-1",
  userProfileId: "user-1",
  userId: "user-1",
  organisationRole: OrganisationRole.ADMIN,
};

describe("experiment permissions", () => {
  it("allows marketers to write experiments", () => {
    expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS["experiments.write"])).toBe(true);
  });

  it("prevents viewers from writing experiments", () => {
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["experiments.write"])).toBe(false);
  });
});

describe("social experiment service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects cross-tenant experiment access", async () => {
    prismaMock.socialExperiment.findFirst.mockResolvedValue(null);
    await expect(
      socialExperimentService.getById("brand-1", "org-1", "exp-1", tenant),
    ).rejects.toThrow("Experiment was not found.");
  });

  it("requires at least two variants when marking ready", async () => {
    prismaMock.socialExperiment.findFirst.mockResolvedValue({
      id: "exp-1",
      organisationId: "org-1",
      brandId: "brand-1",
      status: "DRAFT",
      variants: [{ id: "v1" }],
      metrics: [{ role: "PRIMARY", metricKey: "engagement_rate" }],
    });
    await expect(
      socialExperimentService.markReady("brand-1", "org-1", "exp-1", tenant),
    ).rejects.toThrow("At least two variants are required.");
  });
});
