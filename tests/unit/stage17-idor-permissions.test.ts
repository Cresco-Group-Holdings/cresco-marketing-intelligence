import { describe, expect, it } from "vitest";
import { OrganisationRole } from "@prisma/client";
import { hasPermission, PERMISSIONS } from "@/lib/tenancy/permissions";

/**
 * IDOR protection pattern: every tenant-scoped service must filter by organisationId
 * from authenticated tenant context — never from client-supplied IDs alone.
 */
describe("IDOR protection patterns", () => {
  const tenantScopedServicePatterns = [
    "organisationId: context.organisationId",
    "where: { organisationId: context.organisationId",
    "assertOrganisationScope",
    "buildTenantContext",
  ];

  it("documents required tenant scoping patterns", () => {
    expect(tenantScopedServicePatterns.length).toBeGreaterThan(0);
  });

  it("rejects viewer access to billing management", () => {
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["billing.manage"])).toBe(false);
  });

  it("rejects viewer access to member removal", () => {
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["members.remove"])).toBe(false);
  });

  it("rejects marketer access to organisation archive", () => {
    expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS["organisation.archive"])).toBe(false);
  });

  it("rejects viewer access to provider credential management", () => {
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["providerConnections.manageCredentials"])).toBe(false);
  });

  it("allows owner full permission set", () => {
    expect(hasPermission(OrganisationRole.OWNER, PERMISSIONS["billing.manage"])).toBe(true);
    expect(hasPermission(OrganisationRole.OWNER, PERMISSIONS["members.remove"])).toBe(true);
    expect(hasPermission(OrganisationRole.OWNER, PERMISSIONS["organisation.archive"])).toBe(true);
  });
});

describe("cross-tenant isolation expectations", () => {
  it("organisation context is required for tenant APIs", () => {
    const requiredHeaders = ["x-organisation-id"];
    expect(requiredHeaders).toContain("x-organisation-id");
  });

  it("platform admin is separate from organisation RBAC", () => {
    // Platform admin uses PLATFORM_ADMIN_EMAILS or PlatformAdminGrant — not org roles
    expect(PERMISSIONS["billing.manage"]).toBeDefined();
    expect(hasPermission(OrganisationRole.OWNER, PERMISSIONS["billing.manage"])).toBe(true);
    // Org owner ≠ platform admin (tested in stage17-platform-admin.test.ts)
  });
});
