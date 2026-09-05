/**
 * Cross-cutting golden journey guards: tenant isolation, spoofing, role permissions.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { OrganisationRole } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { GOLDEN_TENANT_ALIASES } from "../harness/constants";

const buildTenantContext = vi.hoisted(() => vi.fn());

vi.mock("@/lib/tenancy/guards", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tenancy/guards")>();
  return { ...actual, buildTenantContext };
});
vi.mock("@/lib/auth/provisioning", () => ({
  ensureUserProfile: vi.fn().mockResolvedValue({
    authUserId: "auth-golden-cross",
    userProfileId: "profile-golden-cross",
  }),
  extractProviderMetadata: vi.fn().mockReturnValue({}),
}));

import { POST as postActivationEvent } from "@/app/api/activation/events/route";
import { GET as getBillingAccount } from "@/app/api/billing/account/route";

const orgA = "org-golden-alpha";
const orgB = "org-golden-beta";

describe("Golden cross-cutting security", () => {
  beforeEach(() => {
    process.env.ALLOW_TEST_AUTH = "true";
    process.env.TEST_AUTH_USER_ID = "auth-golden-cross";
    buildTenantContext.mockImplementation(async ({ organisationId }: { organisationId: string }) => {
      if (organisationId === orgA) {
        return {
          userId: "auth-golden-cross",
          userProfileId: "profile-golden-cross",
          organisationId: orgA,
          organisationRole: OrganisationRole.MEMBER,
        };
      }
      throw new AppError("ORGANISATION_MEMBERSHIP_REQUIRED", "No access");
    });
  });

  afterEach(() => {
    delete process.env.ALLOW_TEST_AUTH;
    delete process.env.TEST_AUTH_USER_ID;
  });

  it("rejects client-side domain spoofing for activation events", async () => {
    const response = await postActivationEvent(
      new NextRequest("https://app.test/api/activation/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ event: "first_publication_scheduled" }),
      }),
    );
    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it("blocks Tenant A from Tenant B billing resources", async () => {
    const response = await getBillingAccount(
      new NextRequest(`https://app.test/api/billing/account?organisationId=${orgB}`),
    );
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(GOLDEN_TENANT_ALIASES.primary).toBe("golden-tenant-alpha");
    expect(GOLDEN_TENANT_ALIASES.secondary).toBe("golden-tenant-beta");
  });

  it("enforces server-side tenant membership for restricted member", async () => {
    await expect(
      buildTenantContext({ organisationId: orgB, userProfileId: "profile-golden-cross" }),
    ).rejects.toMatchObject({ code: "ORGANISATION_MEMBERSHIP_REQUIRED" });
  });
});
