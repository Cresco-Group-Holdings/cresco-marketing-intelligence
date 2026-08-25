import { describe, expect, it } from "vitest";
import { resolveOnboardingRouteDecision } from "@/lib/onboarding/redirect-policy";

describe("onboarding redirect policy with activation routes", () => {
  it("allows getting-started during incomplete onboarding", () => {
    expect(
      resolveOnboardingRouteDecision({
        pathname: "/getting-started",
        status: "incomplete",
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

  it("allows demo workspace during incomplete onboarding", () => {
    expect(
      resolveOnboardingRouteDecision({
        pathname: "/demo",
        status: "incomplete",
      }),
    ).toBe("allow");
  });
});
