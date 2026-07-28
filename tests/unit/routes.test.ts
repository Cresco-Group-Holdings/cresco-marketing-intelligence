import { describe, expect, it } from "vitest";
import { isProtectedRoute, isPublicRoute } from "@/lib/auth/routes";

describe("route protection rules", () => {
  it("marks public routes as accessible without authentication", () => {
    expect(isPublicRoute("/")).toBe(true);
    expect(isPublicRoute("/login")).toBe(true);
    expect(isProtectedRoute("/")).toBe(false);
    expect(isProtectedRoute("/login")).toBe(false);
  });

  it("marks dashboard routes as protected", () => {
    expect(isProtectedRoute("/dashboard")).toBe(true);
    expect(isProtectedRoute("/brands")).toBe(true);
    expect(isProtectedRoute("/settings")).toBe(true);
  });

  it("allows health and auth callback routes", () => {
    expect(isProtectedRoute("/api/health")).toBe(false);
    expect(isProtectedRoute("/auth/callback")).toBe(false);
  });
});
