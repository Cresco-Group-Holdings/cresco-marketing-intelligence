import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { OrganisationRole } from "@prisma/client";
import { leadsTestIds } from "../helpers/leads-mocks";

const leadService = vi.hoisted(() => ({ create: vi.fn() }));
const queryService = vi.hoisted(() => ({ summary: vi.fn(), list: vi.fn() }));
const buildTenantContext = vi.hoisted(() => vi.fn());

vi.mock("@/server/services/marketing-lead-service", () => ({ marketingLeadService: leadService }));
vi.mock("@/server/services/marketing-lead-query-service", () => ({
  marketingLeadQueryService: queryService,
}));
vi.mock("@/lib/tenancy/guards", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tenancy/guards")>();
  return { ...actual, buildTenantContext };
});
vi.mock("@/lib/auth/provisioning", () => ({
  ensureUserProfile: vi.fn().mockResolvedValue({
    authUserId: "test-auth-user",
    userProfileId: leadsTestIds.userProfileId,
  }),
  extractProviderMetadata: vi.fn().mockReturnValue({}),
}));

import { GET as listLeads, POST as createLead } from "@/app/api/brands/[brandId]/leads/route";

const brandParams = { params: Promise.resolve({ brandId: leadsTestIds.brandId }) };

describe("leads route authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ALLOW_TEST_AUTH = "true";
    process.env.TEST_AUTH_USER_ID = "test-auth-user";
    buildTenantContext.mockResolvedValue({
      userId: "test-auth-user",
      userProfileId: leadsTestIds.userProfileId,
      organisationId: leadsTestIds.organisationId,
      organisationRole: OrganisationRole.OWNER,
    });
    queryService.summary.mockResolvedValue({ total: 0, qualified: 0 });
    queryService.list.mockResolvedValue({ items: [], nextCursor: null });
    leadService.create.mockResolvedValue({ lead: { id: "lead-1" }, duplicateWarning: false });
  });

  afterEach(() => {
    delete process.env.ALLOW_TEST_AUTH;
    delete process.env.TEST_AUTH_USER_ID;
  });

  it("allows marketers to read leads", async () => {
    buildTenantContext.mockResolvedValue({
      userId: "test-auth-user",
      userProfileId: leadsTestIds.userProfileId,
      organisationId: leadsTestIds.organisationId,
      organisationRole: OrganisationRole.MARKETER,
    });

    const response = await listLeads(
      new NextRequest(
        `https://app.test/api/brands/${leadsTestIds.brandId}/leads?organisationId=${leadsTestIds.organisationId}`,
      ),
      brandParams,
    );
    expect(response.status).toBe(200);
  });

  it("rejects viewers without leads.write", async () => {
    buildTenantContext.mockResolvedValue({
      userId: "test-auth-user",
      userProfileId: leadsTestIds.userProfileId,
      organisationId: leadsTestIds.organisationId,
      organisationRole: OrganisationRole.VIEWER,
    });

    const response = await createLead(
      new NextRequest(
        `https://app.test/api/brands/${leadsTestIds.brandId}/leads?organisationId=${leadsTestIds.organisationId}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            creationSource: "MANUAL",
            displayName: "Alex",
          }),
        },
      ),
      brandParams,
    );
    expect(response.status).toBe(403);
    expect(leadService.create).not.toHaveBeenCalled();
  });
});
