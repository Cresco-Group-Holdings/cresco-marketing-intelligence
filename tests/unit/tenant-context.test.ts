import { OrganisationRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  assertOrganisationScope,
  assertProjectScope,
  getCurrentOrganisationContext,
  runWithTenantContext,
} from "@/lib/tenancy/context";

const context = {
  userId: "user-1",
  userProfileId: "profile-1",
  organisationId: "org-1",
  organisationRole: OrganisationRole.ADMIN,
  projectId: "project-1",
};

describe("tenant isolation helpers", () => {
  it("stores and retrieves tenant context", () => {
    expect(getCurrentOrganisationContext()).toBeNull();

    runWithTenantContext(context, () => {
      expect(getCurrentOrganisationContext()?.organisationId).toBe("org-1");
    });
  });

  it("blocks cross-organisation access", () => {
    runWithTenantContext(context, () => {
      expect(() => assertOrganisationScope("org-1")).not.toThrow();
      expect(() => assertOrganisationScope("org-2")).toThrow(
        /Cross-organisation access is not permitted/,
      );
    });
  });

  it("blocks cross-project access", () => {
    runWithTenantContext(context, () => {
      expect(() => assertProjectScope("project-1")).not.toThrow();
      expect(() => assertProjectScope("project-2")).toThrow(/Cross-project access is not permitted/);
    });
  });
});
