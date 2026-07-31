import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { OrganisationRole } from "@prisma/client";

const campaignService = vi.hoisted(() => ({
  listCampaigns: vi.fn(),
  createCampaign: vi.fn(),
  getCampaign: vi.fn(),
  launchCampaign: vi.fn(),
  runReadinessChecks: vi.fn(),
}));
const segmentService = vi.hoisted(() => ({ listSegments: vi.fn() }));
const buildTenantContext = vi.hoisted(() => vi.fn());

vi.mock("@/server/services/email-campaign-service", () => ({ emailCampaignService: campaignService }));
vi.mock("@/server/services/crm-audience-segment-service", () => ({ crmAudienceSegmentService: segmentService }));
vi.mock("@/lib/tenancy/guards", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tenancy/guards")>();
  return { ...actual, buildTenantContext };
});
vi.mock("@/lib/auth/provisioning", () => ({
  ensureUserProfile: vi.fn().mockResolvedValue({ authUserId: "test-auth", userProfileId: "profile-1" }),
  extractProviderMetadata: vi.fn().mockReturnValue({}),
}));

import { GET, POST } from "@/app/api/brands/[brandId]/email/campaigns/route";

const brandId = "brand-camp-1";
const organisationId = "org-camp-1";
const brandParams = { params: Promise.resolve({ brandId }) };

describe("email campaign routes authorization", () => {
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
    campaignService.listCampaigns.mockResolvedValue([]);
    campaignService.createCampaign.mockResolvedValue({ id: "camp-1" });
    campaignService.getCampaign.mockResolvedValue({ id: "camp-1", status: "DRAFT" });
    campaignService.launchCampaign.mockResolvedValue({ status: "SENT" });
    campaignService.runReadinessChecks.mockResolvedValue({ passed: true, results: [] });
    segmentService.listSegments.mockResolvedValue([]);
  });

  afterEach(() => {
    delete process.env.ALLOW_TEST_AUTH;
    delete process.env.TEST_AUTH_USER_ID;
  });

  it("allows marketers to list campaigns", async () => {
    buildTenantContext.mockResolvedValue({
      userId: "test-auth",
      userProfileId: "profile-1",
      organisationId,
      organisationRole: OrganisationRole.MARKETER,
    });
    const response = await GET(
      new NextRequest(`https://app.test/api/brands/${brandId}/email/campaigns?organisationId=${organisationId}`),
      brandParams,
    );
    expect(response.status).toBe(200);
  });

  it("rejects viewers launching campaigns", async () => {
    buildTenantContext.mockResolvedValue({
      userId: "test-auth",
      userProfileId: "profile-1",
      organisationId,
      organisationRole: OrganisationRole.VIEWER,
    });
    const response = await POST(
      new NextRequest(`https://app.test/api/brands/${brandId}/email/campaigns?organisationId=${organisationId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "launchCampaign", campaignId: "camp-1" }),
      }),
      brandParams,
    );
    expect(response.status).toBe(403);
  });

  it("creates campaigns for marketers", async () => {
    buildTenantContext.mockResolvedValue({
      userId: "test-auth",
      userProfileId: "profile-1",
      organisationId,
      organisationRole: OrganisationRole.MARKETER,
    });
    const response = await POST(
      new NextRequest(`https://app.test/api/brands/${brandId}/email/campaigns?organisationId=${organisationId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "createCampaign", name: "Newsletter", campaignType: "NEWSLETTER" }),
      }),
      brandParams,
    );
    expect(response.status).toBe(200);
    expect(campaignService.createCampaign).toHaveBeenCalled();
  });

  it("loads campaign detail with tenant scoping", async () => {
    const response = await GET(
      new NextRequest(`https://app.test/api/brands/${brandId}/email/campaigns?organisationId=${organisationId}&campaignId=camp-1`),
      brandParams,
    );
    expect(response.status).toBe(200);
    expect(campaignService.getCampaign).toHaveBeenCalledWith("camp-1", brandId, organisationId, expect.anything());
  });
});
