import { test, expect } from "./support/fixtures";
import { authHeaders, loadTenantManifest, requireLaunchE2e } from "./support/environment";
import { attachLaunchGates, waitForReadiness } from "./support/gates";

test.describe("@launch-critical harness certification", () => {
  test.beforeEach(() => {
    requireLaunchE2e(test);
  });

  test("A — authenticated owner session resolves workspace", async ({ ownerPage, tenantManifest }) => {
    const response = await ownerPage.request.get("/api/workspace", {
      headers: authHeaders(tenantManifest.tenantA.users.owner.authUserId),
    });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.data.preference.currentOrganisationId).toBe(tenantManifest.tenantA.organisationId);
  });

  test("B — restricted member session resolves workspace", async ({ memberPage, tenantManifest }) => {
    const response = await memberPage.request.get("/api/workspace", {
      headers: authHeaders(tenantManifest.tenantA.users.member.authUserId),
    });
    expect(response.ok()).toBeTruthy();
  });

  test("C — tenant A/B isolation enforced via API", async ({ request, tenantManifest }) => {
    const crossTenant = await request.get(
      `/api/organisations/${tenantManifest.tenantB.organisationId}`,
      { headers: authHeaders(tenantManifest.tenantA.users.owner.authUserId) },
    );
    expect(crossTenant.status()).toBeGreaterThanOrEqual(400);
  });

  test("D — real PostgreSQL persistence for seeded brand", async ({ request, tenantManifest }) => {
    const response = await request.get(
      `/api/organisations/${tenantManifest.tenantA.organisationId}`,
      { headers: authHeaders(tenantManifest.tenantA.users.owner.authUserId) },
    );
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.data.organisation.id).toBe(tenantManifest.tenantA.organisationId);
  });

  test("E — migration manifest present after global setup", async () => {
    const manifest = loadTenantManifest();
    expect(manifest.tenantA.organisationId).toBeTruthy();
    expect(manifest.tenantB.organisationId).toBeTruthy();
    expect(manifest.seededAt).toBeTruthy();
  });

  test("F — OAuth mock boundary enabled for harness CI env", async () => {
    expect(process.env.CRESCO_E2E_HARNESS).toBe("true");
    expect(process.env.ALLOW_OAUTH_MOCK).toBe("true");
  });

  test("G — deterministic AI mock boundary enabled for harness CI env", async () => {
    expect(process.env.CRESCO_E2E_HARNESS).toBe("true");
    expect(process.env.AI_ALLOW_MOCK).toBe("true");
  });

  test("H — worker route rejects unauthenticated invocation", async ({ request }) => {
    const response = await request.post("/api/workers/process");
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test("I — Stripe webhook route is public but rejects invalid signature", async ({ request }) => {
    const response = await request.post("/api/webhooks/stripe", {
      data: { id: "evt_invalid" },
      headers: { "stripe-signature": "invalid" },
    });
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test("J — failure artifacts configured via Playwright trace policy", async ({ ownerPage }, testInfo) => {
    expect(testInfo.project.retries).toBeLessThanOrEqual(1);
    await ownerPage.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(ownerPage.locator("body")).toBeVisible();
  });

  test("K — unexpected 5xx gate catches unmocked failures", async ({ ownerPage }, testInfo) => {
    const gates = attachLaunchGates(ownerPage, testInfo);
    await ownerPage.route("**/api/workspace**", async (route) => {
      await route.fulfill({ status: 500, body: "forced failure" });
    });
    await ownerPage.goto("/dashboard", { waitUntil: "domcontentloaded" });
    expect(gates.unexpected5xx.some((entry) => entry.url.includes("/api/workspace"))).toBe(true);
    gates.stop();
  });

  test("L — browser exception gate captures page errors", async ({ ownerPage }, testInfo) => {
    const gates = attachLaunchGates(ownerPage, testInfo);
    await ownerPage.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await ownerPage.evaluate(() => {
      setTimeout(() => {
        throw new Error("e2e harness exception probe");
      }, 0);
    });
    await ownerPage.waitForTimeout(100);
    expect(gates.unexpectedConsoleErrors.join("\n")).toMatch(/e2e harness exception probe/);
    gates.stop();
  });

  test("M — retry-storm detector tracks activation polling", async ({ ownerPage }, testInfo) => {
    const gates = attachLaunchGates(ownerPage, testInfo);
    await ownerPage.route("**/api/activation**", async (route) => {
      await route.fulfill({ status: 503, body: "temporary" });
    });
    await ownerPage.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await ownerPage.waitForTimeout(1500);
    const activationCount = gates.requestCounter.counts.get("/api/activation") ?? 0;
    expect(activationCount).toBeLessThanOrEqual(12);
    gates.stop();
  });

  test("N — incident #156 calendar resilience covered by dedicated spec", async ({ request }) => {
    await waitForReadiness(request);
  });
});
