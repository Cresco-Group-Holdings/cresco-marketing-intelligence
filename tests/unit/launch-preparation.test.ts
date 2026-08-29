import { describe, expect, it } from "vitest";
import { isDevPreviewRoute, isProtectedRoute, isPublicRoute } from "@/lib/auth/routes";
import { resolveLegacyRouteRedirect } from "@/lib/navigation/legacy-redirects";
import { getPublicPricingPlans } from "@/lib/marketing/pricing-display";
import {
  dashboardNavigation,
  dashboardNavigationSections,
} from "@/components/navigation/dashboard-nav";

describe("route protection rules", () => {
  it("marks public routes as accessible without authentication", () => {
    expect(isPublicRoute("/")).toBe(true);
    expect(isPublicRoute("/login")).toBe(true);
    expect(isPublicRoute("/pricing")).toBe(true);
    expect(isPublicRoute("/product")).toBe(true);
    expect(isProtectedRoute("/")).toBe(false);
    expect(isProtectedRoute("/login")).toBe(false);
  });

  it("marks dashboard routes as protected", () => {
    expect(isProtectedRoute("/dashboard")).toBe(true);
    expect(isProtectedRoute("/brands")).toBe(true);
    expect(isProtectedRoute("/settings")).toBe(true);
  });

  it("allows dev preview routes without auth only in development", () => {
    expect(isDevPreviewRoute("/dev/command-centre-preview")).toBe(true);
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    expect(isProtectedRoute("/dev/command-centre-preview")).toBe(false);
    process.env.NODE_ENV = "production";
    expect(isProtectedRoute("/dev/command-centre-preview")).toBe(true);
    process.env.NODE_ENV = originalNodeEnv;
  });
});

describe("launch navigation", () => {
  it("follows the Command / Execute / Strategy / Measure / Intelligence / System hierarchy", () => {
    expect(dashboardNavigationSections.map((section) => section.id)).toEqual([
      "command",
      "execute",
      "strategy",
      "measure",
      "intelligence",
      "system",
    ]);
  });

  it("places Command Centre under Command", () => {
    const command = dashboardNavigationSections.find((section) => section.id === "command");
    expect(command?.items.map((item) => item.href)).toEqual(["/dashboard"]);
  });

  it("uses canonical Content Studio route", () => {
    const execute = dashboardNavigationSections.find((section) => section.id === "execute");
    expect(execute?.items.some((item) => item.href === "/content/studio")).toBe(true);
    expect(execute?.items.some((item) => item.href === "/content")).toBe(false);
  });

  it("does not expose Agents in primary navigation", () => {
    expect(dashboardNavigation.some((item) => item.href === "/ai-agents")).toBe(false);
  });

  it("points Reports to revenue analytics", () => {
    const measure = dashboardNavigationSections.find((section) => section.id === "measure");
    const reports = measure?.items.find((item) => item.label === "Reports");
    expect(reports?.href).toBe("/analytics/revenue");
  });
});

describe("legacy route redirects", () => {
  it("maps legacy paths to canonical launch routes", () => {
    expect(resolveLegacyRouteRedirect("/content")).toBe("/content/studio");
    expect(resolveLegacyRouteRedirect("/connectors")).toBe("/integrations");
    expect(resolveLegacyRouteRedirect("/social/connections")).toBe("/organic-social/accounts");
    expect(resolveLegacyRouteRedirect("/analyst")).toBe("/copilot");
  });
});

describe("public pricing display", () => {
  it("sources plans from the canonical billing catalogue", () => {
    const plans = getPublicPricingPlans();
    expect(plans.some((plan) => plan.key === "starter")).toBe(true);
    expect(plans.some((plan) => plan.key === "trial")).toBe(false);
    expect(plans.find((plan) => plan.key === "starter")?.monthlyPriceLabel).toBe("£49");
  });
});
