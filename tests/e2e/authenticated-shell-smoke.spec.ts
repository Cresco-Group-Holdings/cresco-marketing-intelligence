import { test, expect } from "./support/fixtures";
import {
  LAUNCH_SHELL_ROUTES,
  PUBLIC_SMOKE_ROUTES,
  requireLaunchE2e,
} from "./support/environment";
import { attachLaunchGates, assertLaunchGates, waitForReadiness } from "./support/gates";

test.describe("@launch-critical authenticated shell smoke", () => {
  test.beforeEach(() => {
    requireLaunchE2e(test);
  });

  for (const route of LAUNCH_SHELL_ROUTES) {
    test(`loads ${route} without crash`, async ({ ownerPage }, testInfo) => {
      const gates = attachLaunchGates(ownerPage, testInfo);
      const response = await ownerPage.goto(route, { waitUntil: "domcontentloaded" });
      expect(response?.status()).toBeLessThan(400);
      await expect(ownerPage.locator("body")).toBeVisible();
      expect(ownerPage.url()).not.toMatch(/\/login(?:\?|$)/);
      assertLaunchGates(gates);
      gates.stop();
    });
  }
});

test.describe("@launch-critical public smoke", () => {
  for (const route of PUBLIC_SMOKE_ROUTES) {
    test(`${route.path} responds with key content`, async ({ page }, testInfo) => {
      const gates = attachLaunchGates(page, testInfo);
      const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });
      expect(response?.status()).toBeLessThan(400);
      await expect(page.getByRole("heading", { name: route.heading })).toBeVisible();
      assertLaunchGates(gates);
      gates.stop();
    });
  }
});

test.describe("@launch-critical readiness gate", () => {
  test("readiness endpoint reports checks before journeys rely on the app", async ({ request }) => {
    await waitForReadiness(request);
  });
});
