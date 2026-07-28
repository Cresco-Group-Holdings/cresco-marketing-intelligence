import { beforeEach, describe, expect, it, vi } from "vitest";
import { MarketingChannel, MarketingObjectiveType, OnboardingStepKey } from "@prisma/client";
import { AppError } from "@/lib/errors";

const userProfileId = "profile-1";
const organisationId = "org-1";
const projectId = "project-1";
const brandId = "brand-1";

const progressState = {
  id: "progress-1",
  userId: userProfileId,
  organisationId: null as string | null,
  projectId: null as string | null,
  brandId: null as string | null,
  currentStep: OnboardingStepKey.ACCOUNT_PROFILE,
  completedSteps: [] as OnboardingStepKey[],
  stepData: null,
  templateKey: null,
  completedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

vi.mock("@/lib/database/prisma", () => ({
  prisma: {
    onboardingProgress: {
      upsert: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    userProfile: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    organisation: {
      findUnique: vi.fn(),
    },
    organisationMembership: {
      findFirst: vi.fn(),
    },
    project: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    brand: {
      findFirst: vi.fn(),
    },
    brandProfile: {
      findUnique: vi.fn(),
    },
    marketingObjective: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      upsert: vi.fn(),
    },
    brandChannelPreference: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      upsert: vi.fn(),
    },
    workspacePreference: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
    },
    $transaction: vi.fn((callback: (tx: unknown) => Promise<unknown>) => callback({
      marketingObjective: {
        deleteMany: vi.fn(),
        upsert: vi.fn(),
      },
      brandChannelPreference: {
        deleteMany: vi.fn(),
        upsert: vi.fn(),
      },
    })),
  },
}));

vi.mock("@/server/services/workspace-service", () => ({
  organisationService: {
    create: vi.fn(),
    update: vi.fn(),
    listForUser: vi.fn().mockResolvedValue([]),
  },
  projectService: {
    create: vi.fn(),
    update: vi.fn(),
    listActive: vi.fn().mockResolvedValue([]),
  },
  brandService: {
    create: vi.fn(),
    update: vi.fn(),
    listForProject: vi.fn().mockResolvedValue([]),
  },
  brandProfileService: {
    upsert: vi.fn(),
  },
  workspaceService: {
    getResolvedWorkspace: vi.fn().mockResolvedValue({
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
    }),
    updateWorkspace: vi.fn(),
  },
}));

vi.mock("@/lib/tenancy/guards", () => ({
  buildTenantContextForUser: vi.fn().mockResolvedValue({
    userProfileId: "profile-1",
    organisationId: "org-1",
    organisationRole: "OWNER",
  }),
}));

vi.mock("@/server/services/audit-service", () => ({
  recordAuditEvent: vi.fn(),
}));

import { prisma } from "@/lib/database/prisma";
import { organisationService, workspaceService } from "@/server/services/workspace-service";
import { onboardingService } from "@/server/services/onboarding-service";

describe("onboarding service resilience", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    progressState.organisationId = null;
    progressState.projectId = null;
    progressState.brandId = null;
    progressState.completedSteps = [];
    progressState.currentStep = OnboardingStepKey.ACCOUNT_PROFILE;

    vi.mocked(prisma.onboardingProgress.upsert).mockImplementation(async () => ({ ...progressState }) as never);
    vi.mocked(prisma.onboardingProgress.update).mockImplementation(async ({ data }) => ({
      ...progressState,
      ...(typeof data === "object" && data ? data : {}),
    }) as never);
    vi.mocked(organisationService.update).mockResolvedValue({ id: organisationId } as never);
    vi.mocked(prisma.userProfile.update).mockResolvedValue({} as never);
    vi.mocked(prisma.organisationMembership.findFirst).mockResolvedValue({ id: "membership-1" } as never);
  });

  it("saves account profile and advances to organisation", async () => {
    const progress = await onboardingService.saveAccountProfile(userProfileId, {
      timezone: "UTC",
      locale: "en-GB",
    });

    expect(progress.currentStep).toBe(OnboardingStepKey.ORGANISATION);
    expect(workspaceService.updateWorkspace).toHaveBeenCalled();
  });

  it("updates an existing organisation instead of creating duplicates", async () => {
    progressState.organisationId = organisationId;

    await onboardingService.saveOrganisation(
      userProfileId,
      { name: "Acme Ltd", slug: "acme-ltd" },
    );

    expect(organisationService.update).toHaveBeenCalled();
    expect(organisationService.create).not.toHaveBeenCalled();
  });

  it("rejects cross-tenant organisation access during onboarding", async () => {
    progressState.organisationId = organisationId;
    vi.mocked(prisma.organisationMembership.findFirst).mockResolvedValue(null);

    await expect(
      onboardingService.saveProject(userProfileId, {
        name: "Project",
        slug: "project",
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("upserts marketing objectives without creating fake performance data", async () => {
    progressState.organisationId = organisationId;
    progressState.projectId = projectId;
    progressState.brandId = brandId;
    vi.mocked(prisma.project.findFirst).mockResolvedValue({ id: projectId } as never);
    vi.mocked(prisma.brand.findFirst).mockResolvedValue({ id: brandId } as never);

    const progress = await onboardingService.saveMarketingObjectives(userProfileId, {
      objectives: [
        {
          objectiveType: MarketingObjectiveType.LEAD_GENERATION,
          description: "Generate qualified leads.",
          priority: 1,
          targetValue: 100,
          targetPeriod: "90d",
        },
      ],
    });

    expect(progress.currentStep).toBe(OnboardingStepKey.CHANNEL_PREFERENCES);
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it("saves channel preferences as configuration only", async () => {
    progressState.organisationId = organisationId;
    progressState.projectId = projectId;
    progressState.brandId = brandId;
    vi.mocked(prisma.project.findFirst).mockResolvedValue({ id: projectId } as never);
    vi.mocked(prisma.brand.findFirst).mockResolvedValue({ id: brandId } as never);

    const progress = await onboardingService.saveChannelPreferences(userProfileId, {
      channels: [MarketingChannel.WEBSITE, MarketingChannel.SEO],
    });

    expect(progress.currentStep).toBe(OnboardingStepKey.REVIEW);
  });
});
