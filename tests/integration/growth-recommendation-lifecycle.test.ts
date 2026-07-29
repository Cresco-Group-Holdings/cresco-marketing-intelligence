import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganisationRole } from "@prisma/client";
import { AppError } from "@/lib/errors";

const prisma = vi.hoisted(() => ({
  growthRecommendation: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  recommendationOutcome: {
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  $transaction: vi.fn((fn: (tx: typeof prisma) => unknown) => fn(prisma)),
}));

const brandService = vi.hoisted(() => ({ getById: vi.fn() }));

vi.mock("@/lib/database/prisma", () => ({ prisma }));
vi.mock("@/server/services/workspace-service", () => ({ brandService }));

import { growthRecommendationService } from "@/server/services/growth-recommendation-service";

const context = {
  organisationId: "org-1",
  userProfileId: "user-1",
  organisationRole: OrganisationRole.OWNER,
  userId: "auth-1",
} as never;

function recommendation(overrides: Record<string, unknown> = {}) {
  return {
    id: "rec-1",
    organisationId: "org-1",
    brandId: "brand-1",
    status: "ACTIVE",
    latestFeedbackStatus: null,
    draftExperimentId: "exp-1",
    ...overrides,
  };
}

describe("growthRecommendationService lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    brandService.getById.mockResolvedValue({ id: "brand-1", projectId: "project-1" });
    prisma.recommendationOutcome.create.mockResolvedValue({ id: "outcome-1" });
    prisma.growthRecommendation.update.mockResolvedValue({ id: "rec-1" });
  });

  it("records ACCEPTED, DISMISSED, and PLANNED from an untouched recommendation", async () => {
    for (const feedbackStatus of ["ACCEPTED", "DISMISSED", "PLANNED"] as const) {
      prisma.growthRecommendation.findFirst.mockResolvedValue(recommendation());
      await growthRecommendationService.recordFeedback(
        "brand-1",
        "org-1",
        "rec-1",
        { feedbackStatus },
        context,
      );
    }
    expect(prisma.recommendationOutcome.create).toHaveBeenCalledTimes(3);
  });

  it("records IMPLEMENTED and terminal measured outcomes", async () => {
    prisma.growthRecommendation.findFirst.mockResolvedValueOnce(
      recommendation({ latestFeedbackStatus: "PLANNED" }),
    );
    await growthRecommendationService.recordFeedback(
      "brand-1",
      "org-1",
      "rec-1",
      { feedbackStatus: "IMPLEMENTED" },
      context,
    );

    for (const feedbackStatus of ["SUCCESSFUL", "UNSUCCESSFUL", "INCONCLUSIVE"] as const) {
      prisma.growthRecommendation.findFirst.mockResolvedValue(
        recommendation({ latestFeedbackStatus: "IMPLEMENTED" }),
      );
      await growthRecommendationService.recordFeedback(
        "brand-1",
        "org-1",
        "rec-1",
        { feedbackStatus, measuredOutcome: { lift: 1.1 } },
        context,
      );
    }
  });

  it("rejects duplicate feedback spam", async () => {
    prisma.growthRecommendation.findFirst.mockResolvedValue(
      recommendation({ latestFeedbackStatus: "ACCEPTED" }),
    );
    await expect(
      growthRecommendationService.recordFeedback(
        "brand-1",
        "org-1",
        "rec-1",
        { feedbackStatus: "ACCEPTED" },
        context,
      ),
    ).rejects.toBeInstanceOf(AppError);
  });
});
