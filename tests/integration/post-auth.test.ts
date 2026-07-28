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
  },
}));

import { prisma } from "@/lib/database/prisma";

describe("post-auth redirect resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.organisationMembership.count).mockReset();
  });

  it("redirects users without organisations to onboarding", async () => {
    vi.mocked(prisma.organisationMembership.count)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    await expect(resolvePostAuthRedirectPath("profile-1")).resolves.toBe("/onboarding");
  });

  it("redirects users with active memberships to dashboard", async () => {
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
