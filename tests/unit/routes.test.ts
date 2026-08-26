import { describe, expect, it, vi } from "vitest";
import { isProtectedRoute, isPublicRoute, isAuthRoute } from "@/lib/auth/routes";

describe("route protection rules", () => {
  it("marks public routes as accessible without authentication", () => {
    expect(isPublicRoute("/")).toBe(true);
    expect(isPublicRoute("/login")).toBe(true);
    expect(isPublicRoute("/verify-email")).toBe(true);
    expect(isPublicRoute("/reset-password")).toBe(true);
    expect(isProtectedRoute("/")).toBe(false);
    expect(isProtectedRoute("/login")).toBe(false);
  });

  it("marks dashboard routes as protected", () => {
    expect(isProtectedRoute("/dashboard")).toBe(true);
    expect(isProtectedRoute("/brands")).toBe(true);
    expect(isProtectedRoute("/settings")).toBe(true);
    expect(isProtectedRoute("/settings/account")).toBe(true);
  });

  it("allows health, readiness, auth callback, and auth API routes", () => {
    expect(isProtectedRoute("/api/health")).toBe(false);
    expect(isProtectedRoute("/api/readiness")).toBe(false);
    expect(isProtectedRoute("/auth/callback")).toBe(false);
    expect(isProtectedRoute("/api/auth/login")).toBe(false);
    expect(isPublicApiRoute("/api/auth/login")).toBe(true);
  });

  it("allows external webhooks and public forms without session", () => {
    expect(isProtectedRoute("/api/webhooks/stripe")).toBe(false);
    expect(isProtectedRoute("/api/webhooks/billing/stripe")).toBe(false);
    expect(isProtectedRoute("/api/forms/v1/public-form/submit")).toBe(false);
    expect(isProtectedRoute("/api/tracking/v1/server-events")).toBe(false);
  });

  it("identifies auth routes", () => {
    expect(isAuthRoute("/login")).toBe(true);
    expect(isAuthRoute("/verify-email")).toBe(true);
    expect(isAuthRoute("/dashboard")).toBe(false);
  });

  it("exempts content intelligence dev preview routes in development only", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(isProtectedRoute("/dev/content-intelligence-preview/create")).toBe(false);
    vi.stubEnv("NODE_ENV", "production");
    expect(isProtectedRoute("/dev/content-intelligence-preview/create")).toBe(true);
    vi.unstubAllEnvs();
  });
});
