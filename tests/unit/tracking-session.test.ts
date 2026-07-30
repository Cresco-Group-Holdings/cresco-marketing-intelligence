import { describe, expect, it } from "vitest";
import { deviceCategoryFromUserAgent, shouldStartNewSession } from "@/lib/tracking/session";

describe("tracking sessionisation", () => {
  it("starts a new session after inactivity timeout", () => {
    const last = new Date("2026-07-30T10:00:00Z");
    const now = new Date("2026-07-30T11:00:00Z");
    expect(shouldStartNewSession({ lastActivityAt: last, now, timeoutMinutes: 30 })).toBe(true);
  });

  it("keeps the same session within the timeout window", () => {
    const last = new Date("2026-07-30T10:00:00Z");
    const now = new Date("2026-07-30T10:15:00Z");
    expect(shouldStartNewSession({ lastActivityAt: last, now, timeoutMinutes: 30 })).toBe(false);
  });

  it("starts a new session when campaign changes and policy is enabled", () => {
    const last = new Date("2026-07-30T10:00:00Z");
    const now = new Date("2026-07-30T10:05:00Z");
    expect(
      shouldStartNewSession({
        lastActivityAt: last,
        now,
        timeoutMinutes: 30,
        previousCampaign: "spring",
        nextCampaign: "summer",
        campaignChangeStartsSession: true,
      }),
    ).toBe(true);
  });

  it("classifies device categories from user agent", () => {
    expect(deviceCategoryFromUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe(
      "mobile",
    );
    expect(deviceCategoryFromUserAgent("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)")).toBe(
      "tablet",
    );
    expect(deviceCategoryFromUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe(
      "desktop",
    );
  });
});
