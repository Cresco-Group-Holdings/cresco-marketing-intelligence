import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveOnboardingStatus } from "@/lib/onboarding/status";

vi.mock("@/lib/database/prisma", () => ({
  prisma: {
    workspacePreference: {
      findUnique: vi.fn(),
    },
    onboardingProgress: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/database/prisma";

describe("resolveOnboardingStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prefers workspace preference onboardingCompletedAt", async () => {
    const completedAt = new Date("2026-08-02T12:00:00.000Z");
    vi.mocked(prisma.workspacePreference.findUnique).mockResolvedValue({
      onboardingCompletedAt: completedAt,
    } as never);
    vi.mocked(prisma.onboardingProgress.findUnique).mockResolvedValue({
      completedAt: null,
    } as never);

    await expect(resolveOnboardingStatus("profile-1")).resolves.toEqual({
      status: "complete",
      completedAt,
    });
  });

  it("falls back to onboarding progress completedAt", async () => {
    const completedAt = new Date("2026-08-01T12:00:00.000Z");
    vi.mocked(prisma.workspacePreference.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.onboardingProgress.findUnique).mockResolvedValue({
      completedAt,
    } as never);

    await expect(resolveOnboardingStatus("profile-1")).resolves.toEqual({
      status: "complete",
      completedAt,
    });
  });

  it("returns incomplete when no completion timestamps exist", async () => {
    vi.mocked(prisma.workspacePreference.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.onboardingProgress.findUnique).mockResolvedValue({
      completedAt: null,
    } as never);

    await expect(resolveOnboardingStatus("profile-1")).resolves.toEqual({
      status: "incomplete",
      completedAt: null,
    });
  });
});
