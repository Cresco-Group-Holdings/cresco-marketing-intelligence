import { describe, expect, it } from "vitest";
import { OrganisationRole } from "@prisma/client";
import { hasPermission, PERMISSIONS } from "@/lib/tenancy/permissions";
import { assertOrganisationScope } from "@/lib/tenancy/context";
import { AppError } from "@/lib/errors";

describe("organisation.read permission enforcement", () => {
  it("allows viewers to read organisations", () => {
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["organisation.read"])).toBe(true);
  });

  it("denies viewers from updating organisations", () => {
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["organisation.update"])).toBe(false);
  });

  it("denies analysts from archiving organisations", () => {
    expect(hasPermission(OrganisationRole.ANALYST, PERMISSIONS["organisation.archive"])).toBe(false);
  });
});

describe("invalid organisation identifiers", () => {
  const context = {
    userId: "auth-user-1",
    userProfileId: "profile-1",
    organisationId: "org-1",
    organisationRole: OrganisationRole.VIEWER,
  };

  it("rejects cross-tenant organisation IDs", () => {
    expect(() => assertOrganisationScope("org-2", context)).toThrow(AppError);
    expect(() => assertOrganisationScope("org-2", context)).toThrow(
      /Cross-organisation access is not permitted/,
    );
  });

  it("rejects empty organisation IDs that do not match tenant context", () => {
    expect(() => assertOrganisationScope("", context)).toThrow(AppError);
  });
});
