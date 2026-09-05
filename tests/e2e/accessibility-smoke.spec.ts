import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "./support/fixtures";
import { requireLaunchE2e } from "./support/environment";

const PUBLIC_ACCESSIBILITY_ROUTES = [
  { path: "/login", label: "login" },
  { path: "/pricing", label: "pricing" },
] as const;

const AUTHENTICATED_ACCESSIBILITY_ROUTES = [
  { path: "/dashboard", label: "dashboard" },
  { path: "/getting-started", label: "getting-started" },
  { path: "/content/studio", label: "content-studio" },
] as const;

function seriousOrCriticalViolations(results: Awaited<ReturnType<AxeBuilder["analyze"]>>) {
  return results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
}

test.describe("@launch-critical accessibility smoke", () => {
  test.beforeEach(() => {
    requireLaunchE2e(test);
  });

  for (const route of PUBLIC_ACCESSIBILITY_ROUTES) {
    test(`${route.label} has no serious or critical accessibility violations`, async ({ page }) => {
      await page.goto(route.path, { waitUntil: "domcontentloaded" });
      const results = await new AxeBuilder({ page }).analyze();
      expect(seriousOrCriticalViolations(results)).toEqual([]);
    });
  }

  for (const route of AUTHENTICATED_ACCESSIBILITY_ROUTES) {
    test(`${route.label} has no serious or critical accessibility violations`, async ({ ownerPage }) => {
      await ownerPage.goto(route.path, { waitUntil: "domcontentloaded" });
      const results = await new AxeBuilder({ page: ownerPage }).analyze();
      expect(seriousOrCriticalViolations(results)).toEqual([]);
    });
  }
});
