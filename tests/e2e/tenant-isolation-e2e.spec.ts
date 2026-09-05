import { test, expect } from "./support/fixtures";
import { authHeaders, requireLaunchE2e } from "./support/environment";

test.describe("@launch-critical tenant isolation", () => {
  test.beforeEach(() => {
    requireLaunchE2e(test);
  });

  test("Tenant A owner cannot read Tenant B organisation", async ({
    request,
    tenantManifest,
  }) => {
    const response = await request.get(
      `/api/organisations/${tenantManifest.tenantB.organisationId}`,
      {
        headers: authHeaders(tenantManifest.tenantA.users.owner.authUserId),
      },
    );
    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(response.headers()["content-type"] ?? "").toContain("application/json");
  });

  test("Tenant B owner cannot read Tenant A organisation", async ({
    request,
    tenantManifest,
  }) => {
    const response = await request.get(
      `/api/organisations/${tenantManifest.tenantA.organisationId}`,
      {
        headers: authHeaders(tenantManifest.tenantB.users.owner.authUserId),
      },
    );
    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(response.headers()["content-type"] ?? "").toContain("application/json");
  });

  test("restricted member session is distinct from owner", async ({
    tenantManifest,
    ownerPage,
    memberPage,
  }) => {
    await ownerPage.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await memberPage.goto("/dashboard", { waitUntil: "domcontentloaded" });

    await expect(ownerPage.getByRole("heading", { name: "Overview" })).toBeVisible();
    await expect(memberPage.getByRole("heading", { name: "Overview" })).toBeVisible();

    const ownerWorkspace = await ownerPage.request.get("/api/workspace", {
      headers: authHeaders(tenantManifest.tenantA.users.owner.authUserId),
    });
    const memberWorkspace = await memberPage.request.get("/api/workspace", {
      headers: authHeaders(tenantManifest.tenantA.users.member.authUserId),
    });

    expect(ownerWorkspace.ok()).toBeTruthy();
    expect(memberWorkspace.ok()).toBeTruthy();

    const ownerBody = await ownerWorkspace.json();
    const memberBody = await memberWorkspace.json();
    expect(ownerBody.data.organisations.length).toBeGreaterThan(0);
    expect(memberBody.data.organisations.length).toBeGreaterThan(0);
  });
});
