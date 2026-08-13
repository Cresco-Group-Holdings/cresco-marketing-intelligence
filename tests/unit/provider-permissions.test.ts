import { describe, expect, it } from "vitest";
import { hasPermission, PERMISSIONS } from "@/lib/tenancy/permissions";
import { OrganisationRole } from "@prisma/client";

describe("provider permissions", () => {
  it("grants OWNER full provider permissions", () => {
    expect(hasPermission(OrganisationRole.OWNER, PERMISSIONS["providerConnections.manageCredentials"])).toBe(true);
    expect(hasPermission(OrganisationRole.OWNER, PERMISSIONS["providerDefinitions.admin"])).toBe(true);
  });

  it("grants ADMIN credential management", () => {
    expect(hasPermission(OrganisationRole.ADMIN, PERMISSIONS["providerConnections.authorize"])).toBe(true);
    expect(hasPermission(OrganisationRole.ADMIN, PERMISSIONS["providerConnections.manageCredentials"])).toBe(true);
  });

  it("grants MARKETER connect but not credential management", () => {
    expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS["providerConnections.create"])).toBe(true);
    expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS["providerConnections.manageCredentials"])).toBe(false);
  });

  it("grants VIEWER read-only provider access", () => {
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["providerConnections.read"])).toBe(true);
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["providerConnections.authorize"])).toBe(false);
  });

  it("grants integration permissions to admin roles", () => {
    expect(hasPermission(OrganisationRole.ADMIN, PERMISSIONS["integration.sync"])).toBe(true);
    expect(hasPermission(OrganisationRole.ADMIN, PERMISSIONS["integration.manage_credentials"])).toBe(true);
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["integration.read"])).toBe(true);
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["integration.manage_credentials"])).toBe(false);
  });
});
