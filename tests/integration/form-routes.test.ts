import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { OrganisationRole } from "@prisma/client";

const formService = vi.hoisted(() => ({
  listForms: vi.fn(),
  createForm: vi.fn(),
  getForm: vi.fn(),
}));
const submissionService = vi.hoisted(() => ({ submit: vi.fn() }));
const buildTenantContext = vi.hoisted(() => vi.fn());

vi.mock("@/server/services/lead-capture-form-service", () => ({ leadCaptureFormService: formService }));
vi.mock("@/server/services/lead-capture-submission-service", () => ({ leadCaptureSubmissionService: submissionService }));
vi.mock("@/lib/tenancy/guards", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tenancy/guards")>();
  return { ...actual, buildTenantContext };
});
vi.mock("@/lib/auth/provisioning", () => ({
  ensureUserProfile: vi.fn().mockResolvedValue({ authUserId: "test-auth", userProfileId: "profile-1" }),
  extractProviderMetadata: vi.fn().mockReturnValue({}),
}));

import { GET, POST } from "@/app/api/brands/[brandId]/forms/route";
import { POST as publicSubmit } from "@/app/api/forms/v1/[publicFormId]/submit/route";
import { resetRateLimitStoreForTests } from "@/lib/security/rate-limit";

const brandId = "brand-forms-1";
const organisationId = "org-forms-1";
const brandParams = { params: Promise.resolve({ brandId }) };
const publicParams = { params: Promise.resolve({ publicFormId: "pub-form-1" }) };

describe("forms management routes", () => {
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
    formService.listForms.mockResolvedValue([]);
    formService.createForm.mockResolvedValue({ id: "form-1", name: "Contact" });
  });

  afterEach(() => {
    delete process.env.ALLOW_TEST_AUTH;
    delete process.env.TEST_AUTH_USER_ID;
  });

  it("allows marketers to list forms", async () => {
    buildTenantContext.mockResolvedValue({
      userId: "test-auth",
      userProfileId: "profile-1",
      organisationId,
      organisationRole: OrganisationRole.MARKETER,
    });
    const response = await GET(
      new NextRequest(`https://app.test/api/brands/${brandId}/forms?organisationId=${organisationId}`),
      brandParams,
    );
    expect(response.status).toBe(200);
  });

  it("rejects viewers creating forms", async () => {
    buildTenantContext.mockResolvedValue({
      userId: "test-auth",
      userProfileId: "profile-1",
      organisationId,
      organisationRole: OrganisationRole.VIEWER,
    });
    const response = await POST(
      new NextRequest(`https://app.test/api/brands/${brandId}/forms?organisationId=${organisationId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "createForm", name: "Test", slug: "test" }),
      }),
      brandParams,
    );
    expect(response.status).toBe(403);
    expect(formService.createForm).not.toHaveBeenCalled();
  });
});

describe("public form submission route", () => {
  beforeEach(() => {
    resetRateLimitStoreForTests();
    submissionService.submit.mockResolvedValue({ submissionId: "sub-1", status: "ACCEPTED" });
  });

  it("accepts valid public submissions", async () => {
    const response = await publicSubmit(
      new NextRequest("https://app.test/api/forms/v1/pub-form-1/submit", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://example.com" },
        body: JSON.stringify({ fields: { email: "alex@example.com" } }),
      }),
      publicParams,
    );
    expect(response.status).toBe(200);
    expect(submissionService.submit).toHaveBeenCalled();
  });
});
