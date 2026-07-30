import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { OrganisationRole } from "@prisma/client";

const crmService = vi.hoisted(() => ({
  listLeads: vi.fn(),
  getLead: vi.fn(),
  createLead: vi.fn(),
  getDashboard: vi.fn(),
}));

const buildTenantContext = vi.hoisted(() => vi.fn());

vi.mock("@/server/services/crm-service", () => ({ crmService }));
vi.mock("@/lib/tenancy/guards", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tenancy/guards")>();
  return { ...actual, buildTenantContext };
});
vi.mock("@/lib/auth/provisioning", () => ({
  ensureUserProfile: vi.fn().mockResolvedValue({
    authUserId: "test-auth-user",
    userProfileId: "profile-1",
  }),
  extractProviderMetadata: vi.fn().mockReturnValue({}),
}));

import { GET, POST } from "@/app/api/brands/[brandId]/crm/route";

const brandId = "brand-crm-1";
const organisationId = "org-crm-1";
const brandParams = { params: Promise.resolve({ brandId }) };

describe("CRM route authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ALLOW_TEST_AUTH = "true";
    process.env.TEST_AUTH_USER_ID = "test-auth-user";
    buildTenantContext.mockResolvedValue({
      userId: "test-auth-user",
      userProfileId: "profile-1",
      organisationId,
      organisationRole: OrganisationRole.OWNER,
    });
    crmService.listLeads.mockResolvedValue([]);
    crmService.getDashboard.mockResolvedValue({ leads: 0, duplicates: 0, companies: 0, unassigned: 0 });
    crmService.createLead.mockResolvedValue({ id: "lead-1", status: "NEW" });
  });

  afterEach(() => {
    delete process.env.ALLOW_TEST_AUTH;
    delete process.env.TEST_AUTH_USER_ID;
  });

  it("allows authorised users to read CRM dashboard", async () => {
    const response = await GET(
      new NextRequest(`https://app.test/api/brands/${brandId}/crm?organisationId=${organisationId}&view=dashboard`),
      brandParams,
    );
    expect(response.status).toBe(200);
    expect(crmService.getDashboard).toHaveBeenCalled();
  });

  it("rejects viewers creating leads", async () => {
    buildTenantContext.mockResolvedValue({
      userId: "test-auth-user",
      userProfileId: "profile-1",
      organisationId,
      organisationRole: OrganisationRole.VIEWER,
    });

    const response = await POST(
      new NextRequest(`https://app.test/api/brands/${brandId}/crm?organisationId=${organisationId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "createLead", email: "alex@example.com" }),
      }),
      brandParams,
    );
    expect(response.status).toBe(403);
    expect(crmService.createLead).not.toHaveBeenCalled();
  });

  it("creates leads for marketers", async () => {
    buildTenantContext.mockResolvedValue({
      userId: "test-auth-user",
      userProfileId: "profile-1",
      organisationId,
      organisationRole: OrganisationRole.MARKETER,
    });

    const response = await POST(
      new NextRequest(`https://app.test/api/brands/${brandId}/crm?organisationId=${organisationId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "createLead",
          firstName: "Alex",
          email: "alex@example.com",
          sourceType: "MANUAL_ENTRY",
        }),
      }),
      brandParams,
    );
    expect(response.status).toBe(200);
    expect(crmService.createLead).toHaveBeenCalled();
  });
});
