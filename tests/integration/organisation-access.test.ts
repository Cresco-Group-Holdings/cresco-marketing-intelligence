import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganisationRole } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { assertOrganisationScope } from "@/lib/tenancy/context";
import { organisationService } from "@/server/services";

const tenantContext = {
  userId: "auth-user-1",
  userProfileId: "profile-1",
  organisationId: "org-1",
  organisationRole: OrganisationRole.ADMIN,
};

vi.mock("@/lib/database/prisma", () => ({
  prisma: {
    organisation: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/database/prisma";

describe("organisation service tenant access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows valid organisation access within tenant context", async () => {
    vi.mocked(prisma.organisation.findFirst).mockResolvedValue({
      id: "org-1",
      name: "Cresco Group",
      slug: "cresco-group",
    } as never);

    const organisation = await organisationService.getById("org-1", tenantContext);

    expect(organisation.id).toBe("org-1");
    expect(prisma.organisation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "org-1" }),
      }),
    );
  });

  it("denies cross-tenant organisation access", async () => {
    await expect(organisationService.getById("org-2", tenantContext)).rejects.toBeInstanceOf(
      AppError,
    );
    await expect(organisationService.getById("org-2", tenantContext)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(prisma.organisation.findFirst).not.toHaveBeenCalled();
  });

  it("returns not found when organisation does not exist", async () => {
    vi.mocked(prisma.organisation.findFirst).mockResolvedValue(null);

    await expect(organisationService.getById("org-1", tenantContext)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("organisation scope assertions", () => {
  it("rejects mismatched organisation IDs before database access", () => {
    expect(() => assertOrganisationScope("org-2", tenantContext)).toThrow(AppError);
    expect(() => assertOrganisationScope("org-2", tenantContext)).toThrow(
      /Cross-organisation access is not permitted/,
    );
  });
});
