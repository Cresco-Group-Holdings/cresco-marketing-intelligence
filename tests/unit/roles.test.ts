import { OrganisationRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  canEditMarketingAssets,
  canManageOrganisation,
  canViewAnalytics,
  hasMinimumRole,
} from "@/lib/tenancy/roles";

describe("organisation role rules", () => {
  it("ranks roles correctly", () => {
    expect(hasMinimumRole(OrganisationRole.ADMIN, OrganisationRole.MARKETER)).toBe(true);
    expect(hasMinimumRole(OrganisationRole.VIEWER, OrganisationRole.ANALYST)).toBe(false);
  });

  it("applies capability helpers", () => {
    expect(canManageOrganisation(OrganisationRole.OWNER)).toBe(true);
    expect(canManageOrganisation(OrganisationRole.MARKETER)).toBe(false);
    expect(canEditMarketingAssets(OrganisationRole.MARKETER)).toBe(true);
    expect(canViewAnalytics(OrganisationRole.ANALYST)).toBe(true);
  });
});
