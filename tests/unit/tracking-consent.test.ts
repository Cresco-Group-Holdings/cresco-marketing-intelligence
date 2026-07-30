import { describe, expect, it } from "vitest";
import { isEventAllowedByConsent } from "@/lib/tracking/consent";

describe("tracking consent gating", () => {
  it("always allows essential events", () => {
    expect(isEventAllowedByConsent("session_start", { ANALYTICS: false }, false)).toBe(true);
  });

  it("suppresses analytics events when analytics consent is false", () => {
    expect(isEventAllowedByConsent("page_view", { ANALYTICS: false }, false)).toBe(false);
  });

  it("requires explicit analytics consent in cookieless mode", () => {
    expect(isEventAllowedByConsent("page_view", {}, true)).toBe(false);
    expect(isEventAllowedByConsent("page_view", { ANALYTICS: true }, true)).toBe(true);
  });

  it("suppresses marketing conversions when marketing consent is false", () => {
    expect(isEventAllowedByConsent("purchase", { ANALYTICS: true, MARKETING: false }, false)).toBe(
      false,
    );
  });
});
