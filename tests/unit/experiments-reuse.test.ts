import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganisationRole } from "@prisma/client";

const prismaMock = vi.hoisted(() => ({
  socialExperiment: {
    findFirst: vi.fn(),
  },
  contentPattern: {
    create: vi.fn(),
  },
  growthRecommendation: {
    create: vi.fn(),
  },
  brandMessage: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  contentProvenance: {
    upsert: vi.fn(),
  },
  experimentReuseRecord: {
    create: vi.fn(),
  },
}));

vi.mock("@/lib/database/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/server/services/workspace-service", () => ({
  brandService: {
    getById: vi.fn().mockResolvedValue({ id: "brand-1", projectId: "project-1" }),
  },
}));
vi.mock("@/server/services/social-experiment-service", () => ({
  socialExperimentService: {
    getById: vi.fn(),
  },
}));

import { socialExperimentService } from "@/server/services/social-experiment-service";
import { experimentReuseService } from "@/server/services/experiment-reuse-service";

const tenant = {
  organisationId: "org-1",
  userProfileId: "user-1",
  userId: "user-1",
  organisationRole: OrganisationRole.ADMIN,
};

describe("experiment reuse approval", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(socialExperimentService.getById).mockResolvedValue({
      id: "exp-1",
      organisationId: "org-1",
      projectId: "project-1",
      brandId: "brand-1",
      title: "Hook test",
      testType: "HOOK",
      startDate: new Date("2026-07-01"),
      endDate: new Date("2026-07-15"),
      minimumSampleThreshold: 100,
      decisionRule: "10% improvement",
      validityWarnings: [],
      variants: [{ id: "v1", label: "Winner", contentItemId: "content-1" }],
      metrics: [{ role: "PRIMARY", metricKey: "engagement_rate" }],
      decision: {
        outcome: "WINNER",
        winningVariantId: "v1",
        percentageDifference: 15,
      },
      hypothesis: { statement: "Shorter hooks perform better" },
    } as never);
    prismaMock.contentPattern.create.mockResolvedValue({ id: "pattern-1" });
    prismaMock.experimentReuseRecord.create.mockResolvedValue({ id: "reuse-1" });
  });

  it("requires user confirmation before reuse", async () => {
    await expect(
      experimentReuseService.applyReuse("brand-1", "org-1", "exp-1", {
        reuseType: "CONTENT_PATTERN",
        confirmed: false,
      }, tenant),
    ).rejects.toThrow("User confirmation is required");
  });

  it("creates a content pattern when confirmed", async () => {
    const result = await experimentReuseService.applyReuse(
      "brand-1",
      "org-1",
      "exp-1",
      { reuseType: "CONTENT_PATTERN", confirmed: true },
      tenant,
    );
    expect(result.targetResourceType).toBe("ContentPattern");
    expect(prismaMock.experimentReuseRecord.create).toHaveBeenCalled();
  });

  it("blocks reuse for inconclusive experiments", async () => {
    vi.mocked(socialExperimentService.getById).mockResolvedValue({
      id: "exp-1",
      decision: { outcome: "INCONCLUSIVE" },
      variants: [],
      metrics: [],
    } as never);
    await expect(
      experimentReuseService.applyReuse(
        "brand-1",
        "org-1",
        "exp-1",
        { reuseType: "CONTENT_PATTERN", confirmed: true },
        tenant,
      ),
    ).rejects.toThrow("Inconclusive experiments cannot be reused.");
  });
});
