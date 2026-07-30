import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { OrganisationRole } from "@prisma/client";

const pipelineService = vi.hoisted(() => ({
  listPipelines: vi.fn(),
  createPipeline: vi.fn(),
}));
const opportunityService = vi.hoisted(() => ({
  listOpportunities: vi.fn(),
  createOpportunity: vi.fn(),
  getForecast: vi.fn(),
}));
const buildTenantContext = vi.hoisted(() => vi.fn());

vi.mock("@/server/services/crm-pipeline-service", () => ({ crmPipelineService: pipelineService }));
vi.mock("@/server/services/crm-opportunity-service", () => ({ crmOpportunityService: opportunityService }));
vi.mock("@/lib/tenancy/guards", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tenancy/guards")>();
  return { ...actual, buildTenantContext };
});
vi.mock("@/lib/auth/provisioning", () => ({
  ensureUserProfile: vi.fn().mockResolvedValue({ authUserId: "test-auth", userProfileId: "profile-1" }),
  extractProviderMetadata: vi.fn().mockReturnValue({}),
}));

import { GET, POST } from "@/app/api/brands/[brandId]/crm/pipelines/route";

const brandId = "brand-pipe-1";
const organisationId = "org-pipe-1";
const brandParams = { params: Promise.resolve({ brandId }) };

describe("pipeline routes authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ALLOW_TEST_AUTH = "true";
    process.env.TEST_AUTH_USER_ID = "test-auth";
    buildTenantContext.mockResolvedValue({
      userId: "test-auth",
      userProfileId: "profile-1",
      organisationId,
      organisationRole: OrganisationRole.OWNER,
    });
    pipelineService.listPipelines.mockResolvedValue([]);
    opportunityService.listOpportunities.mockResolvedValue([]);
    opportunityService.getForecast.mockResolvedValue({ totalOpenValue: 0, weightedValue: 0, disclaimer: "estimate" });
    pipelineService.createPipeline.mockResolvedValue({ id: "pipe-1" });
    opportunityService.createOpportunity.mockResolvedValue({ id: "opp-1" });
  });

  afterEach(() => {
    delete process.env.ALLOW_TEST_AUTH;
    delete process.env.TEST_AUTH_USER_ID;
  });

  it("allows marketers to read pipelines", async () => {
    buildTenantContext.mockResolvedValue({
      userId: "test-auth",
      userProfileId: "profile-1",
      organisationId,
      organisationRole: OrganisationRole.MARKETER,
    });
    const response = await GET(
      new NextRequest(`https://app.test/api/brands/${brandId}/crm/pipelines?organisationId=${organisationId}&resource=pipelines`),
      brandParams,
    );
    expect(response.status).toBe(200);
  });

  it("rejects viewers creating opportunities", async () => {
    buildTenantContext.mockResolvedValue({
      userId: "test-auth",
      userProfileId: "profile-1",
      organisationId,
      organisationRole: OrganisationRole.VIEWER,
    });
    const response = await POST(
      new NextRequest(`https://app.test/api/brands/${brandId}/crm/pipelines?organisationId=${organisationId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "createOpportunity", pipelineId: "p1", name: "Deal" }),
      }),
      brandParams,
    );
    expect(response.status).toBe(403);
    expect(opportunityService.createOpportunity).not.toHaveBeenCalled();
  });

  it("allows forecast read for analysts", async () => {
    buildTenantContext.mockResolvedValue({
      userId: "test-auth",
      userProfileId: "profile-1",
      organisationId,
      organisationRole: OrganisationRole.ANALYST,
    });
    const response = await GET(
      new NextRequest(`https://app.test/api/brands/${brandId}/crm/pipelines?organisationId=${organisationId}&view=forecast`),
      brandParams,
    );
    expect(response.status).toBe(200);
    expect(opportunityService.getForecast).toHaveBeenCalled();
  });
});
