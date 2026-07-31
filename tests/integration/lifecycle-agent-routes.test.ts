import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { OrganisationRole } from "@prisma/client";

const lifecycleAgentService = vi.hoisted(() => ({
  listRuns: vi.fn(),
  getRun: vi.fn(),
  startRun: vi.fn(),
  approveAction: vi.fn(),
}));

const buildTenantContext = vi.hoisted(() => vi.fn());

vi.mock("@/server/services/lifecycle-agent-service", () => ({ lifecycleAgentService }));
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

import { GET, POST } from "@/app/api/brands/[brandId]/crm/assistant/route";

const brandId = "brand-lifecycle-1";
const organisationId = "org-lifecycle-1";
const brandParams = { params: Promise.resolve({ brandId }) };

describe("lifecycle agent routes", () => {
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
    lifecycleAgentService.listRuns.mockResolvedValue([]);
    lifecycleAgentService.getRun.mockResolvedValue({
      id: "run-1",
      brandId,
      organisationId,
      status: "COMPLETED",
    });
    lifecycleAgentService.startRun.mockResolvedValue({
      id: "run-new",
      brandId,
      organisationId,
      status: "COMPLETED",
      reviewType: "DAILY_SALES_BRIEF",
    });
    lifecycleAgentService.approveAction.mockResolvedValue({
      id: "proposal-1",
      status: "APPROVED",
      recommendationId: "rec-1",
    });
  });

  afterEach(() => {
    delete process.env.ALLOW_TEST_AUTH;
    delete process.env.TEST_AUTH_USER_ID;
  });

  it("scopes run reads to brand and organisation (tenant isolation)", async () => {
    const response = await GET(
      new NextRequest(
        `https://app.test/api/brands/${brandId}/crm/assistant?organisationId=${organisationId}&view=run&runId=run-1`,
      ),
      brandParams,
    );

    expect(response.status).toBe(200);
    expect(lifecycleAgentService.getRun).toHaveBeenCalledWith(
      "run-1",
      brandId,
      organisationId,
      expect.objectContaining({ organisationId }),
    );
  });

  it("starts a lifecycle agent run for authorised users", async () => {
    buildTenantContext.mockResolvedValue({
      userId: "test-auth-user",
      userProfileId: "profile-1",
      organisationId,
      organisationRole: OrganisationRole.MARKETER,
    });

    const response = await POST(
      new NextRequest(`https://app.test/api/brands/${brandId}/crm/assistant?organisationId=${organisationId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "startRun",
          reviewType: "DAILY_SALES_BRIEF",
          dateRangeStart: "2026-07-01",
          dateRangeEnd: "2026-07-31",
          analysis: { leads: [], opportunities: [], activities: [], tasks: [] },
        }),
      }),
      brandParams,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.run.id).toBe("run-new");
    expect(lifecycleAgentService.startRun).toHaveBeenCalledWith(
      brandId,
      organisationId,
      expect.objectContaining({ action: "startRun", reviewType: "DAILY_SALES_BRIEF" }),
      expect.objectContaining({ organisationId }),
    );
  });

  it("approves action proposals for authorised approvers", async () => {
    const response = await POST(
      new NextRequest(`https://app.test/api/brands/${brandId}/crm/assistant?organisationId=${organisationId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "approveAction",
          actionProposalId: "proposal-1",
          notes: "Looks good",
        }),
      }),
      brandParams,
    );

    expect(response.status).toBe(200);
    expect(lifecycleAgentService.approveAction).toHaveBeenCalledWith(
      "proposal-1",
      brandId,
      organisationId,
      "Looks good",
      expect.objectContaining({ organisationId }),
    );
  });

  it("blocks viewers from starting runs", async () => {
    buildTenantContext.mockResolvedValue({
      userId: "test-auth-user",
      userProfileId: "profile-1",
      organisationId,
      organisationRole: OrganisationRole.VIEWER,
    });

    const response = await POST(
      new NextRequest(`https://app.test/api/brands/${brandId}/crm/assistant?organisationId=${organisationId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "startRun",
          reviewType: "DAILY_SALES_BRIEF",
          dateRangeStart: "2026-07-01",
          dateRangeEnd: "2026-07-31",
          analysis: {},
        }),
      }),
      brandParams,
    );

    expect(response.status).toBe(403);
    expect(lifecycleAgentService.startRun).not.toHaveBeenCalled();
  });

  it("blocks viewers from approving actions", async () => {
    buildTenantContext.mockResolvedValue({
      userId: "test-auth-user",
      userProfileId: "profile-1",
      organisationId,
      organisationRole: OrganisationRole.VIEWER,
    });

    const response = await POST(
      new NextRequest(`https://app.test/api/brands/${brandId}/crm/assistant?organisationId=${organisationId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "approveAction",
          actionProposalId: "proposal-1",
        }),
      }),
      brandParams,
    );

    expect(response.status).toBe(403);
    expect(lifecycleAgentService.approveAction).not.toHaveBeenCalled();
  });
});
