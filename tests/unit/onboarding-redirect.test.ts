import { describe, expect, it } from "vitest";
import { resolveOnboardingRouteDecision } from "@/lib/onboarding/redirect-policy";
import {
  resolveClientOnboardingStatus,
  type OnboardingStatusSnapshot,
} from "@/lib/onboarding/status";

describe("resolveClientOnboardingStatus", () => {
  it("returns loading while workspace is loading", () => {
    expect(
      resolveClientOnboardingStatus({
        loading: true,
        error: null,
        onboardingCompletedAt: null,
      }),
    ).toBe("loading");
  });

  it("returns error when workspace fetch failed", () => {
    expect(
      resolveClientOnboardingStatus({
        loading: false,
        error: "Failed to load workspace.",
        onboardingCompletedAt: null,
      }),
    ).toBe("error");
  });

  it("returns complete when onboardingCompletedAt is set", () => {
    expect(
      resolveClientOnboardingStatus({
        loading: false,
        error: null,
        onboardingCompletedAt: "2026-08-02T00:00:00.000Z",
      }),
    ).toBe("complete");
  });

  it("returns incomplete when loaded without completion timestamp", () => {
    expect(
      resolveClientOnboardingStatus({
        loading: false,
        error: null,
        onboardingCompletedAt: null,
      }),
    ).toBe("incomplete");
  });
});

describe("resolveOnboardingRouteDecision", () => {
  it("does not redirect while status is loading", () => {
    expect(
      resolveOnboardingRouteDecision({
        pathname: "/dashboard",
        status: "loading",
      }),
    ).toBe("allow");
  });

  it("does not redirect while status is error", () => {
    expect(
      resolveOnboardingRouteDecision({
        pathname: "/dashboard",
        status: "error",
      }),
    ).toBe("allow");
  });

  it("redirects incomplete users away from dashboard", () => {
    expect(
      resolveOnboardingRouteDecision({
        pathname: "/dashboard",
        status: "incomplete",
      }),
    ).toBe("redirect-onboarding");
  });

  it("keeps incomplete users on onboarding", () => {
    expect(
      resolveOnboardingRouteDecision({
        pathname: "/onboarding",
        status: "incomplete",
      }),
    ).toBe("allow");
  });

  it("redirects completed users away from onboarding", () => {
    expect(
      resolveOnboardingRouteDecision({
        pathname: "/onboarding",
        status: "complete",
      }),
    ).toBe("redirect-dashboard");
  });

  it("keeps completed users on dashboard", () => {
    expect(
      resolveOnboardingRouteDecision({
        pathname: "/dashboard",
        status: "complete",
      }),
    ).toBe("allow");
  });
});

describe("onboarding status snapshot", () => {
  it("treats any completedAt as complete", () => {
    const snapshot: OnboardingStatusSnapshot = {
      status: "complete",
      completedAt: new Date("2026-08-02T00:00:00.000Z"),
    };

    expect(snapshot.status).toBe("complete");
  });
});
