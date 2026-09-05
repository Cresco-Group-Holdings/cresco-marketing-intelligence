import { test, expect } from "./support/fixtures";
import { authHeaders, requireLaunchE2e } from "./support/environment";
import { attachLaunchGates, assertLaunchGates } from "./support/gates";

test.describe("@launch-critical incident #156 calendar resilience", () => {
  test.beforeEach(() => {
    requireLaunchE2e(test);
  });

  async function mockOptionalDependencyFailures(
    page: import("@playwright/test").Page,
    options: { activation: boolean; commandCentre: boolean },
  ) {
    await page.route("**/api/activation**", async (route) => {
      if (options.activation) {
        await route.fulfill({ status: 503, body: "activation unavailable" });
        return;
      }
      await route.continue();
    });

    await page.route("**/api/dashboard/command-centre**", async (route) => {
      if (options.commandCentre) {
        await route.fulfill({ status: 503, body: "command centre unavailable" });
        return;
      }
      await route.continue();
    });
  }

  async function assertCalendarUsable(page: import("@playwright/test").Page) {
    await expect(page.getByRole("heading", { name: "Content Calendar" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole("button", { name: "New event" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Month" })).toBeVisible();
  }

  async function withAuthenticatedPage(
    browser: import("@playwright/test").Browser,
    authUserId: string,
    testInfo: import("@playwright/test").TestInfo,
    run: (page: import("@playwright/test").Page, gates: ReturnType<typeof attachLaunchGates>) => Promise<void>,
  ) {
    const context = await browser.newContext({
      extraHTTPHeaders: authHeaders(authUserId),
    });
    const page = await context.newPage();
    const gates = attachLaunchGates(page, testInfo);
    try {
      await run(page, gates);
    } finally {
      gates.stop();
      await context.close();
    }
  }

  test("calendar remains usable when activation optional dependency fails", async ({
    browser,
    tenantManifest,
  }, testInfo) => {
    await withAuthenticatedPage(
      browser,
      tenantManifest.tenantA.users.owner.authUserId,
      testInfo,
      async (page, gates) => {
        await mockOptionalDependencyFailures(page, { activation: true, commandCentre: false });
        await page.goto("/calendar", { waitUntil: "domcontentloaded" });
        await assertCalendarUsable(page);
        assertLaunchGates(gates, {
          allow5xx: [/\/api\/activation/],
          allowConsole: [/503/, /api\/activation/],
        });
      },
    );
  });

  test("calendar remains usable when command centre optional dependency fails", async ({
    browser,
    tenantManifest,
  }, testInfo) => {
    await withAuthenticatedPage(
      browser,
      tenantManifest.tenantA.users.owner.authUserId,
      testInfo,
      async (page, gates) => {
        await mockOptionalDependencyFailures(page, { activation: false, commandCentre: true });
        await page.goto("/calendar", { waitUntil: "domcontentloaded" });
        await assertCalendarUsable(page);
        assertLaunchGates(gates, {
          allow5xx: [/\/api\/dashboard\/command-centre/],
          allowConsole: [/503/, /command-centre/],
        });
      },
    );
  });

  test("app shell survives when both optional dependencies fail with bounded requests", async ({
    browser,
    tenantManifest,
  }, testInfo) => {
    await withAuthenticatedPage(
      browser,
      tenantManifest.tenantA.users.owner.authUserId,
      testInfo,
      async (page, gates) => {
        await mockOptionalDependencyFailures(page, { activation: true, commandCentre: true });
        await page.goto("/calendar", { waitUntil: "domcontentloaded" });
        await assertCalendarUsable(page);
        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await expect(page.locator("body")).toBeVisible();
        assertLaunchGates(gates, {
          allow5xx: [/\/api\/activation/, /\/api\/dashboard\/command-centre/],
          allowConsole: [/503/, /api\/activation/, /command-centre/],
        });
      },
    );
  });
});
