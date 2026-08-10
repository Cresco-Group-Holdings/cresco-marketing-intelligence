import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { OrganisationRole } from "@prisma/client";

const campaignService = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  getById: vi.fn(),
  update: vi.fn(),
  transition: vi.fn(),
  archive: vi.fn(),
  restore: vi.fn(),
  listChannels: vi.fn(),
  addChannel: vi.fn(),
  listKpis: vi.fn(),
  addKpi: vi.fn(),
  listMembers: vi.fn(),
  addMember: vi.fn(),
  listActivity: vi.fn(),
}));

const buildTenantContext = vi.hoisted(() => vi.fn());

vi.mock("@/server/services/campaign-service", () => ({ campaignService }));
vi.mock("@/lib/tenancy/guards", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tenancy/guards")>();
  return { ...actual, buildTenantContext };
});
vi.mock("@/lib/auth/provisioning", () => ({
  ensureUserProfile: vi.fn().mockResolvedValue({ authUserId: "test-auth", userProfileId: "profile-1" }),
  extractProviderMetadata: vi.fn().mockReturnValue({}),
}));

import { GET, POST } from "@/app/api/campaigns/route";
import { GET as GET_DETAIL, PATCH } from "@/app/api/campaigns/[campaignId]/route";
import { POST as POST_TRANSITION } from "@/app/api/campaigns/[campaignId]/transition/route";

const organisationId = "org-campaign-1";
const campaignId = "camp-1";

describe("campaign routes authorization", () => {
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
    campaignService.list.mockResolvedValue({ items: [], nextCursor: null });
    campaignService.create.mockResolvedValue({ id: campaignId, name: "Test", version: 1 });
    campaignService.getById.mockResolvedValue({ id: campaignId, name: "Test", version: 1 });
    campaignService.update.mockResolvedValue({ id: campaignId, name: "Updated", version: 2 });
    campaignService.transition.mockResolvedValue({ id: campaignId, status: "PLANNED", version: 2 });
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
      new NextRequest(`https://app.test/api/campaigns?organisationId=${organisationId}`),
    );
    expect(response.status).toBe(200);
    expect(campaignService.list).toHaveBeenCalled();
  });

  it("rejects viewers creating campaigns", async () => {
    buildTenantContext.mockResolvedValue({
      userId: "test-auth",
      userProfileId: "profile-1",
      organisationId,
      organisationRole: OrganisationRole.VIEWER,
    });

    const response = await POST(
      new NextRequest(`https://app.test/api/campaigns?organisationId=${organisationId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Launch",
          brandId: "brand-1",
          projectId: "project-1",
        }),
      }),
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
      new NextRequest(`https://app.test/api/campaigns?organisationId=${organisationId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Launch",
          brandId: "brand-1",
          projectId: "project-1",
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(campaignService.create).toHaveBeenCalled();
  });

  it("returns campaign detail for readers", async () => {
    const response = await GET_DETAIL(
      new NextRequest(`https://app.test/api/campaigns/${campaignId}?organisationId=${organisationId}`),
      { params: Promise.resolve({ campaignId }) },
    );
    expect(response.status).toBe(200);
  });

  it("propagates version on update", async () => {
    buildTenantContext.mockResolvedValue({
      userId: "test-auth",
      userProfileId: "profile-1",
      organisationId,
      organisationRole: OrganisationRole.MARKETER,
    });

    await PATCH(
      new NextRequest(`https://app.test/api/campaigns/${campaignId}?organisationId=${organisationId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Updated", version: 1 }),
      }),
      { params: Promise.resolve({ campaignId }) },
    );

    expect(campaignService.update).toHaveBeenCalledWith(
      campaignId,
      organisationId,
      expect.objectContaining({ version: 1 }),
      expect.any(Object),
      expect.any(String),
    );
  });

  it("transitions campaign status", async () => {
    buildTenantContext.mockResolvedValue({
      userId: "test-auth",
      userProfileId: "profile-1",
      organisationId,
      organisationRole: OrganisationRole.MARKETER,
    });

    const response = await POST_TRANSITION(
      new NextRequest(
        `https://app.test/api/campaigns/${campaignId}/transition?organisationId=${organisationId}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "plan", version: 1 }),
        },
      ),
      { params: Promise.resolve({ campaignId }) },
    );
    expect(response.status).toBe(200);
    expect(campaignService.transition).toHaveBeenCalled();
  });
});

describe("campaign routes request metadata", () => {
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
    campaignService.list.mockResolvedValue({ items: [], nextCursor: null });
  });

  afterEach(() => {
    delete process.env.ALLOW_TEST_AUTH;
    delete process.env.TEST_AUTH_USER_ID;
  });

  it("includes requestId in list response meta", async () => {
    const response = await GET(
      new NextRequest(`https://app.test/api/campaigns?organisationId=${organisationId}`),
    );
    const body = await response.json();
    expect(body.meta.requestId).toBeTruthy();
  });
});
