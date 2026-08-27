import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  hasActiveOrganisationMembership,
  hasSuspendedMembershipOnly,
  resolvePostAuthRedirectPath,
} from "@/lib/auth/post-auth";

vi.mock("@/lib/database/prisma", () => ({
  prisma: {
    organisationMembership: {
      count: vi.fn(),
    },
    workspacePreference: {
      findUnique: vi.fn(),
    },
    onboardingProgress: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/database/prisma";

function mockOnboardingIncomplete() {
  vi.mocked(prisma.workspacePreference.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.onboardingProgress.findUnique).mockResolvedValue({
    completedAt: null,
  } as never);
}

function mockOnboardingComplete() {
  vi.mocked(prisma.workspacePreference.findUnique).mockResolvedValue({
    onboardingCompletedAt: new Date("2026-08-02T00:00:00.000Z"),
  } as never);
  vi.mocked(prisma.onboardingProgress.findUnique).mockResolvedValue({
    completedAt: new Date("2026-08-02T00:00:00.000Z"),
  } as never);
}

describe("post-auth redirect resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.organisationMembership.count).mockReset();
    mockOnboardingIncomplete();
  });

  it("redirects users with incomplete onboarding to onboarding", async () => {
    vi.mocked(prisma.organisationMembership.count)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    await expect(resolvePostAuthRedirectPath("profile-1")).resolves.toBe("/onboarding");
  });

  it("redirects users with completed onboarding to dashboard even without memberships", async () => {
    mockOnboardingComplete();
    vi.mocked(prisma.organisationMembership.count)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    await expect(resolvePostAuthRedirectPath("profile-1")).resolves.toBe("/dashboard");
  });

  it("redirects users with active memberships but incomplete onboarding to getting-started", async () => {
    vi.mocked(prisma.organisationMembership.count).mockResolvedValue(1);

    await expect(resolvePostAuthRedirectPath("profile-1")).resolves.toBe("/getting-started?invited=1");
  });

  it("redirects users with completed onboarding to dashboard", async () => {
    mockOnboardingComplete();
    vi.mocked(prisma.organisationMembership.count).mockResolvedValue(1);

    await expect(resolvePostAuthRedirectPath("profile-1")).resolves.toBe("/dashboard");
  });

  it("redirects suspended-only users to the auth error page", async () => {
    vi.mocked(prisma.organisationMembership.count)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1);

    await expect(resolvePostAuthRedirectPath("profile-1")).resolves.toBe(
      "/auth/error?code=membership_suspended",
    );
  });

  it("detects suspended-only membership state", async () => {
    vi.mocked(prisma.organisationMembership.count)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(2);

    await expect(hasSuspendedMembershipOnly("profile-1")).resolves.toBe(true);
    await expect(hasActiveOrganisationMembership("profile-1")).resolves.toBe(false);
  });
});
