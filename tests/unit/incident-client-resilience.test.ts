import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_API_FETCH_RETRY_POLICY } from "@/lib/api/fetch-policy";
import { getMaxClientAttempts } from "@/hooks/use-api-resource";

const root = resolve(__dirname, "../..");

function readSource(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), "utf8");
}

describe("production incident client resilience contracts", () => {
  it("A: activation route delegates to activationService.getState", () => {
    const source = readSource("src/app/api/activation/route.ts");
    expect(source).toContain("activationService.getState");
    expect(source).toContain("apiSuccess");
  });

  it("D: client retries are bounded to the shared fetch policy", () => {
    expect(getMaxClientAttempts()).toBe(DEFAULT_API_FETCH_RETRY_POLICY.maxAttempts);
    expect(DEFAULT_API_FETCH_RETRY_POLICY.maxAttempts).toBe(3);
  });

  it("E: calendar view handles workspace and API failures locally", () => {
    const source = readSource("src/components/calendar/calendar-view.tsx");
    expect(source).toContain("workspaceError");
    expect(source).toContain("eventsError");
    expect(source).toContain("setEventsError");
    expect(source).not.toContain("useActivationState");
  });

  it("F: command centre decouples activation fetch from dashboard load", () => {
    const source = readSource("src/components/marketing/command-centre-dashboard.tsx");
    expect(source).toContain("useActivationState");
    expect(source).toContain("apiFetch<{ dashboard: MarketingCommandCentreData }>");
    expect(source).toContain("queryString");
    expect(source).not.toContain("searchParams, resetTimeout]");
  });

  it("G: dashboard shell isolates route failures behind RouteErrorBoundary", () => {
    const shell = readSource("src/components/layout/dashboard-shell.tsx");
    const boundary = readSource("src/components/layout/route-error-boundary.tsx");

    expect(shell).toContain("RouteErrorBoundary");
    expect(boundary).toContain("Other areas of the app remain available");
  });

  it("retry storm fix: useLoadingTimeout reset callback is stable", () => {
    const source = readSource("src/hooks/use-loading-timeout.ts");
    expect(source).toContain("const reset = useCallback(() => {");
    expect(source).toContain("}, []);");
  });

  it("useApiResource ignores stale responses via request generation", () => {
    const source = readSource("src/hooks/use-api-resource.ts");
    expect(source).toContain("requestGenerationRef");
    expect(source).toContain("requestGenerationRef.current !== generation");
  });

  it("notification bell disables automatic API retries", () => {
    const source = readSource("src/components/notifications/notification-bell.tsx");
    expect(source).toMatch(/retry:\s*false/);
  });
});
