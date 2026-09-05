import { describe, expect, it } from "vitest";
import {
  isAuthRoute,
  isProtectedRoute,
  isPublicRoute,
  isWebhookApiRoute,
  isWorkerApiRoute,
} from "@/lib/auth/routes";

describe("route protection rules", () => {
  it("marks public routes as accessible without authentication", () => {
    expect(isPublicRoute("/")).toBe(true);
    expect(isPublicRoute("/login")).toBe(true);
    expect(isPublicRoute("/verify-email")).toBe(true);
    expect(isPublicRoute("/reset-password")).toBe(true);
    expect(isPublicRoute("/cookies")).toBe(true);
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
  });

  it("allows webhook, shared report, worker, and tracking routes", () => {
    expect(isWebhookApiRoute("/api/webhooks/stripe")).toBe(true);
    expect(isProtectedRoute("/api/webhooks/stripe")).toBe(false);
    expect(isProtectedRoute("/api/reports/shared/token-abc")).toBe(false);
    expect(isProtectedRoute("/reports/shared/token-abc")).toBe(false);
    expect(isWorkerApiRoute("/api/publishing-scheduler/process-due")).toBe(true);
    expect(isProtectedRoute("/api/publishing-scheduler/process-due")).toBe(false);
    expect(isProtectedRoute("/api/tracking/v1/events")).toBe(false);
    expect(isProtectedRoute("/api/forms/v1/public-form/submit")).toBe(false);
  });

  it("keeps provider management APIs protected", () => {
    expect(isProtectedRoute("/api/providers/connections")).toBe(true);
    expect(isProtectedRoute("/api/providers/connections/conn-1")).toBe(true);
  });

  it("identifies auth routes", () => {
    expect(isAuthRoute("/login")).toBe(true);
    expect(isAuthRoute("/verify-email")).toBe(true);
    expect(isAuthRoute("/dashboard")).toBe(false);
  });
});
