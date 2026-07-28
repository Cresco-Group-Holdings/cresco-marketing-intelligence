import { describe, expect, it } from "vitest";
import { OrganisationRole } from "@prisma/client";
import {
  canChangeRole,
  canManageMember,
  hasPermission,
  PERMISSIONS,
} from "@/lib/tenancy/permissions";

describe("permission matrix", () => {
  it("grants owners all permissions", () => {
    expect(hasPermission(OrganisationRole.OWNER, PERMISSIONS["organisation.archive"])).toBe(true);
    expect(hasPermission(OrganisationRole.OWNER, PERMISSIONS["members.invite"])).toBe(true);
  });

  it("prevents viewers from mutating resources", () => {
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["projects.create"])).toBe(false);
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["members.invite"])).toBe(false);
  });

  it("allows marketers to update brand profiles but not manage members", () => {
    expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS["brandProfile.update"])).toBe(true);
    expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS["members.invite"])).toBe(false);
  });

  it("prevents admins from promoting to owner or managing owners", () => {
    expect(canChangeRole(OrganisationRole.ADMIN, OrganisationRole.ADMIN, OrganisationRole.OWNER)).toBe(false);
    expect(canManageMember(OrganisationRole.ADMIN, OrganisationRole.OWNER)).toBe(false);
  });
});
