import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { OrganisationRole } from "@prisma/client";

const automationEngineService = vi.hoisted(() => ({
  listWorkflows: vi.fn(),
  createWorkflow: vi.fn(),
}));

const automationEngineExecutionService = vi.hoisted(() => ({
  dispatchEvent: vi.fn(),
}));

const buildTenantContext = vi.hoisted(() => vi.fn());

vi.mock("@/server/services/automation-engine-service", () => ({ automationEngineService }));
vi.mock("@/server/services/automation-engine-execution-service", () => ({
  automationEngineExecutionService,
}));
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

import { GET, POST } from "@/app/api/brands/[brandId]/automation-engine/route";

const brandId = "brand-auto-1";
const organisationId = "org-auto-1";
const brandParams = { params: Promise.resolve({ brandId }) };

describe("automation engine route authorization", () => {
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
    automationEngineService.listWorkflows.mockResolvedValue([]);
    automationEngineService.createWorkflow.mockResolvedValue({ id: "wf-1", name: "Test" });
    automationEngineExecutionService.dispatchEvent.mockResolvedValue({ results: [] });
  });

  afterEach(() => {
    delete process.env.ALLOW_TEST_AUTH;
    delete process.env.TEST_AUTH_USER_ID;
  });

  it("allows authorised users to list workflows", async () => {
    const response = await GET(
      new NextRequest(`https://app.test/api/brands/${brandId}/automation-engine?organisationId=${organisationId}`),
      brandParams,
    );
    expect(response.status).toBe(200);
    expect(automationEngineService.listWorkflows).toHaveBeenCalled();
  });

  it("rejects viewers from dispatching events", async () => {
    buildTenantContext.mockResolvedValue({
      userId: "test-auth-user",
      userProfileId: "profile-1",
      organisationId,
      organisationRole: OrganisationRole.VIEWER,
    });

    const response = await POST(
      new NextRequest(`https://app.test/api/brands/${brandId}/automation-engine?organisationId=${organisationId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "dispatchEvent",
          eventType: "CAMPAIGN_ACTIVATED",
          payload: { campaign: { status: "ACTIVE" } },
        }),
      }),
      brandParams,
    );
    expect(response.status).toBe(403);
    expect(automationEngineExecutionService.dispatchEvent).not.toHaveBeenCalled();
  });

  it("creates workflows for marketers", async () => {
    buildTenantContext.mockResolvedValue({
      userId: "test-auth-user",
      userProfileId: "profile-1",
      organisationId,
      organisationRole: OrganisationRole.MARKETER,
    });

    const response = await POST(
      new NextRequest(`https://app.test/api/brands/${brandId}/automation-engine?organisationId=${organisationId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "createWorkflow", name: "Launch tasks" }),
      }),
      brandParams,
    );
    expect(response.status).toBe(200);
    expect(automationEngineService.createWorkflow).toHaveBeenCalled();
  });
});
