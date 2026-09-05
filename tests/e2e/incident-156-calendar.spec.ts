import { test, expect } from "./support/fixtures";
import { requireLaunchE2e } from "./support/environment";
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

  test("calendar remains usable when activation optional dependency fails", async ({
    ownerPage,
  }, testInfo) => {
    const gates = attachLaunchGates(ownerPage, testInfo);
    await mockOptionalDependencyFailures(ownerPage, { activation: true, commandCentre: false });

    await ownerPage.goto("/calendar", { waitUntil: "domcontentloaded" });
    await assertCalendarUsable(ownerPage);

    assertLaunchGates(gates, {
      allow5xx: [/\/api\/activation/],
    });
    gates.stop();
  });

  test("calendar remains usable when command centre optional dependency fails", async ({
    ownerPage,
  }, testInfo) => {
    const gates = attachLaunchGates(ownerPage, testInfo);
    await mockOptionalDependencyFailures(ownerPage, { activation: false, commandCentre: true });

    await ownerPage.goto("/calendar", { waitUntil: "domcontentloaded" });
    await assertCalendarUsable(ownerPage);

    assertLaunchGates(gates, {
      allow5xx: [/\/api\/dashboard\/command-centre/],
    });
    gates.stop();
  });

  test("app shell survives when both optional dependencies fail with bounded requests", async ({
    ownerPage,
  }, testInfo) => {
    const gates = attachLaunchGates(ownerPage, testInfo);
    await mockOptionalDependencyFailures(ownerPage, { activation: true, commandCentre: true });

    await ownerPage.goto("/calendar", { waitUntil: "domcontentloaded" });
    await assertCalendarUsable(ownerPage);

    await ownerPage.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(ownerPage.locator("body")).toBeVisible();

    assertLaunchGates(gates, {
      allow5xx: [/\/api\/activation/, /\/api\/dashboard\/command-centre/],
    });
    gates.stop();
  });
});
