import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { OrganisationRole } from "@prisma/client";

const crmLeadCoreService = vi.hoisted(() => ({
  getLeadCore: vi.fn(),
  transitionLead: vi.fn(),
  recordConsent: vi.fn(),
  exportLead: vi.fn(),
  listWorkflowLeads: vi.fn(),
}));

const buildTenantContext = vi.hoisted(() => vi.fn());

vi.mock("@/server/services/crm-lead-core-service", () => ({ crmLeadCoreService }));
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

import { GET, POST } from "@/app/api/brands/[brandId]/crm/core/route";

const brandId = "brand-crm-core-1";
const organisationId = "org-crm-core-1";
const brandParams = { params: Promise.resolve({ brandId }) };

describe("CRM core route authorization", () => {
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
    crmLeadCoreService.getLeadCore.mockResolvedValue({ id: "lead-1", status: "NEW" });
    crmLeadCoreService.transitionLead.mockResolvedValue({ id: "lead-1", status: "CONTACTED" });
    crmLeadCoreService.recordConsent.mockResolvedValue({ id: "consent-1" });
    crmLeadCoreService.exportLead.mockResolvedValue({ lead: { id: "lead-1" } });
  });

  afterEach(() => {
    delete process.env.ALLOW_TEST_AUTH;
    delete process.env.TEST_AUTH_USER_ID;
  });

  it("allows authorised users to read lead core data", async () => {
    const response = await GET(
      new NextRequest(
        `https://app.test/api/brands/${brandId}/crm/core?organisationId=${organisationId}&leadId=lead-1`,
      ),
      brandParams,
    );
    expect(response.status).toBe(200);
    expect(crmLeadCoreService.getLeadCore).toHaveBeenCalled();
  });

  it("rejects viewers from recording consent", async () => {
    buildTenantContext.mockResolvedValue({
      userId: "test-auth-user",
      userProfileId: "profile-1",
      organisationId,
      organisationRole: OrganisationRole.VIEWER,
    });

    const response = await POST(
      new NextRequest(`https://app.test/api/brands/${brandId}/crm/core?organisationId=${organisationId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "recordConsent",
          leadId: "lead-1",
          channel: "EMAIL",
          status: "GRANTED",
        }),
      }),
      brandParams,
    );
    expect(response.status).toBe(403);
    expect(crmLeadCoreService.recordConsent).not.toHaveBeenCalled();
  });

  it("transitions leads for marketers", async () => {
    buildTenantContext.mockResolvedValue({
      userId: "test-auth-user",
      userProfileId: "profile-1",
      organisationId,
      organisationRole: OrganisationRole.MARKETER,
    });

    const response = await POST(
      new NextRequest(`https://app.test/api/brands/${brandId}/crm/core?organisationId=${organisationId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "transitionLead",
          leadId: "lead-1",
          status: "CONTACTED",
        }),
      }),
      brandParams,
    );
    expect(response.status).toBe(200);
    expect(crmLeadCoreService.transitionLead).toHaveBeenCalled();
  });

  it("allows export for roles with export permission", async () => {
    buildTenantContext.mockResolvedValue({
      userId: "test-auth-user",
      userProfileId: "profile-1",
      organisationId,
      organisationRole: OrganisationRole.MARKETER,
    });

    const response = await POST(
      new NextRequest(`https://app.test/api/brands/${brandId}/crm/core?organisationId=${organisationId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "exportLead",
          leadId: "lead-1",
          scope: "FULL",
        }),
      }),
      brandParams,
    );
    expect(response.status).toBe(200);
    expect(crmLeadCoreService.exportLead).toHaveBeenCalled();
  });
});
