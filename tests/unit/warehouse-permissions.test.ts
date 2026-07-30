import { describe, expect, it } from "vitest";
import { OrganisationRole } from "@prisma/client";
import { hasPermission, PERMISSIONS } from "@/lib/tenancy/permissions";

describe("marketing data warehouse permissions", () => {
  it("grants owners full warehouse management", () => {
    expect(hasPermission(OrganisationRole.OWNER, PERMISSIONS["marketingData.read"])).toBe(true);
    expect(hasPermission(OrganisationRole.OWNER, PERMISSIONS["marketingData.viewRaw"])).toBe(true);
    expect(hasPermission(OrganisationRole.OWNER, PERMISSIONS["marketingData.reprocess"])).toBe(true);
  });

  it("allows marketers to read and run syncs but not view raw payloads", () => {
    expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS["marketingData.read"])).toBe(true);
    expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS["marketingData.runSync"])).toBe(true);
    expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS["marketingData.viewRaw"])).toBe(false);
    expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS["marketingData.reprocess"])).toBe(false);
  });

  it("allows analysts to read, export, and manage quality", () => {
    expect(hasPermission(OrganisationRole.ANALYST, PERMISSIONS["marketingData.read"])).toBe(true);
    expect(hasPermission(OrganisationRole.ANALYST, PERMISSIONS["marketingData.export"])).toBe(true);
    expect(hasPermission(OrganisationRole.ANALYST, PERMISSIONS["marketingData.manageQuality"])).toBe(true);
    expect(hasPermission(OrganisationRole.ANALYST, PERMISSIONS["marketingData.runSync"])).toBe(false);
  });

  it("restricts viewers to summary read access", () => {
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["marketingData.read"])).toBe(true);
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["marketingData.export"])).toBe(false);
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["marketingData.manageSources"])).toBe(false);
  });
});
