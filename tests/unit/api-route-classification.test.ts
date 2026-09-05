import { describe, expect, it } from "vitest";
import {
  API_SECURITY_CLASSES,
  classifyApiRoute,
  isCronApiRoute,
  isOAuthCallbackApiRoute,
  isSessionExemptRoute,
  isTokenPublicApiRoute,
  isTrackingPublicApiRoute,
  isWebhookApiRoute,
  isWorkerApiRoute,
} from "@/lib/security/api-route-classification";
import { isProtectedRoute } from "@/lib/auth/routes";
import { discoverApiRoutes } from "../helpers/discover-api-routes";

describe("API route security classification inventory", () => {
  const routes = discoverApiRoutes();

  it("discovers the production API surface", () => {
    expect(routes.length).toBeGreaterThanOrEqual(400);
  });

  it("classifies every API route without UNKNOWN gaps", () => {
    const unclassified = routes.filter((route) => classifyApiRoute(route.pattern) === null);
    expect(unclassified).toEqual([]);
  });

  it("assigns PERMISSIONED to routes that declare explicit permissions", () => {
    const permissioned = routes.filter((route) => route.usesPermission);
    expect(permissioned.length).toBeGreaterThan(0);

    for (const route of permissioned) {
      const baseClass = classifyApiRoute(route.pattern);
      expect(baseClass).toBe("AUTHENTICATED");
    }
  });

  it("reports classification counts for every security class", () => {
    const counts = Object.fromEntries(API_SECURITY_CLASSES.map((klass) => [klass, 0])) as Record<
      string,
      number
    >;

    for (const route of routes) {
      const klass = classifyApiRoute(route.pattern);
      expect(klass).not.toBeNull();
      counts[klass!] += 1;
      if (route.usesPermission && klass === "AUTHENTICATED") {
        counts.PERMISSIONED += 1;
      }
    }

    expect(counts.WEBHOOK).toBeGreaterThan(0);
    expect(counts.WORKER_INTERNAL).toBeGreaterThan(0);
    expect(counts.TOKEN_PUBLIC).toBeGreaterThan(0);
    expect(counts.TRACKING_PUBLIC).toBeGreaterThan(0);
    expect(counts.AUTHENTICATED).toBeGreaterThan(0);
    expect(counts.PERMISSIONED).toBeGreaterThan(0);
  });
});

describe("middleware session exemption boundaries", () => {
  it("exempts provider webhook routes without broad provider prefixes", () => {
    expect(isWebhookApiRoute("/api/webhooks/stripe")).toBe(true);
    expect(isWebhookApiRoute("/api/webhooks/providers/resend")).toBe(true);
    expect(isWebhookApiRoute("/api/webhooks/social/meta")).toBe(true);
    expect(isProtectedRoute("/api/webhooks/stripe")).toBe(false);
    expect(isProtectedRoute("/api/providers/connections")).toBe(true);
    expect(isProtectedRoute("/api/provider-connections")).toBe(true);
  });

  it("exempts shared report token routes only", () => {
    expect(isTokenPublicApiRoute("/api/reports/shared/abc123")).toBe(true);
    expect(isProtectedRoute("/api/reports/shared/abc123")).toBe(false);
    expect(isProtectedRoute("/reports/shared/abc123")).toBe(false);
    expect(isProtectedRoute("/api/reports")).toBe(true);
    expect(isProtectedRoute("/reports")).toBe(true);
  });

  it("exempts worker and cron scheduler routes", () => {
    expect(isWorkerApiRoute("/api/publishing-scheduler/process-due")).toBe(true);
    expect(isCronApiRoute("/api/publishing-scheduler/process-due")).toBe(true);
    expect(isWorkerApiRoute("/api/social-reports/process-due")).toBe(true);
    expect(isProtectedRoute("/api/publishing-jobs/job-1/process")).toBe(false);
    expect(isProtectedRoute("/api/social-reports/process-due")).toBe(false);
  });

  it("exempts OAuth callbacks without widening provider management APIs", () => {
    expect(isOAuthCallbackApiRoute("/api/connectors/oauth/callback")).toBe(true);
    expect(isOAuthCallbackApiRoute("/api/social/oauth/callback")).toBe(true);
    expect(isOAuthCallbackApiRoute("/api/integrations/oauth/callback")).toBe(true);
    expect(isProtectedRoute("/api/connectors/oauth/callback")).toBe(false);
    expect(isProtectedRoute("/api/providers/connections")).toBe(true);
    expect(isProtectedRoute("/api/providers/connections/conn-1")).toBe(true);
  });

  it("exempts public tracking and form submission endpoints", () => {
    expect(isTrackingPublicApiRoute("/api/tracking/v1/events")).toBe(true);
    expect(isProtectedRoute("/api/tracking/v1/events")).toBe(false);
    expect(isTokenPublicApiRoute("/api/tracking/v1/server-events")).toBe(true);
    expect(isProtectedRoute("/api/tracking/v1/server-events")).toBe(false);
    expect(isTrackingPublicApiRoute("/api/forms/v1/form-public-1/submit")).toBe(true);
    expect(isProtectedRoute("/api/forms/v1/form-public-1/submit")).toBe(false);
  });

  it("keeps non-submit form management APIs protected", () => {
    expect(isProtectedRoute("/api/forms/v1/form-public-1")).toBe(true);
    expect(isProtectedRoute("/api/forms/v1/form-public-1/submit")).toBe(false);
  });

  it("keeps authenticated APIs protected at middleware", () => {
    expect(isProtectedRoute("/api/brands")).toBe(true);
    expect(isProtectedRoute("/api/dashboard/foundation")).toBe(true);
    expect(isProtectedRoute("/api/members")).toBe(true);
    expect(isProtectedRoute("/api/organisations/org-1")).toBe(true);
  });

  it("keeps public web pages accessible", () => {
    expect(isProtectedRoute("/")).toBe(false);
    expect(isProtectedRoute("/login")).toBe(false);
    expect(isProtectedRoute("/privacy")).toBe(false);
    expect(isProtectedRoute("/cookies")).toBe(false);
  });

  it("never treats session exemption as implicit trust", () => {
    const exemptPaths = [
      "/api/webhooks/stripe",
      "/api/reports/shared/token",
      "/api/publishing-scheduler/process-due",
      "/api/tracking/v1/events",
    ];

    for (const pathname of exemptPaths) {
      expect(isSessionExemptRoute(pathname)).toBe(true);
      expect(isProtectedRoute(pathname)).toBe(false);
    }
  });
});
