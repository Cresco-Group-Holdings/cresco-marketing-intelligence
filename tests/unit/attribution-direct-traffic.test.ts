import { describe, expect, it } from "vitest";
import { applyDirectTrafficPolicy, applyShowBothVariants } from "@/lib/attribution/direct-traffic";
import type { AttributionTouchpointInput } from "@/lib/attribution/types";

function tp(id: string, channel: string, day: number): AttributionTouchpointInput {
  return {
    id,
    channel,
    occurredAt: new Date(`2026-01-0${day}T00:00:00Z`),
    isDirect: channel === "DIRECT",
  };
}

describe("direct traffic policy", () => {
  it("retains direct touchpoints", () => {
    const result = applyDirectTrafficPolicy(
      [tp("1", "PAID_SEARCH", 1), tp("2", "DIRECT", 2)],
      "RETAIN",
    );
    expect(result.included).toHaveLength(2);
    expect(result.excluded).toHaveLength(0);
    expect(result.variant).toBe("retain");
  });

  it("ignores direct when prior known channel exists", () => {
    const result = applyDirectTrafficPolicy(
      [tp("1", "EMAIL", 1), tp("2", "DIRECT", 2), tp("3", "ORGANIC_SEARCH", 3)],
      "IGNORE_WHEN_PRIOR_KNOWN",
    );
    expect(result.included.map((t) => t.id)).toEqual(["1", "3"]);
    expect(result.excluded).toHaveLength(1);
    expect(result.excluded[0]?.exclusionReason).toBe("direct_ignored_prior_known");
    expect(result.variant).toBe("ignore_direct");
  });

  it("keeps direct when it is the only touchpoint", () => {
    const result = applyDirectTrafficPolicy([tp("1", "DIRECT", 1)], "IGNORE_WHEN_PRIOR_KNOWN");
    expect(result.included).toHaveLength(1);
    expect(result.excluded).toHaveLength(0);
  });

  it("provides both analytical variants", () => {
    const variants = applyShowBothVariants([tp("1", "PAID_SOCIAL", 1), tp("2", "DIRECT", 2)]);
    expect(variants.retain.included).toHaveLength(2);
    expect(variants.ignoreDirect.included).toHaveLength(1);
    expect(variants.ignoreDirect.excluded).toHaveLength(1);
  });
});

describe("direct traffic in credit calculation", () => {
  it("excludes direct touchpoints under IGNORE_WHEN_PRIOR_KNOWN policy", async () => {
    const { calculateAttributionCredits } = await import("@/lib/attribution/models");
    const result = calculateAttributionCredits({
      modelType: "LAST_TOUCH",
      touchpoints: [tp("1", "EMAIL", 1), tp("2", "DIRECT", 2)],
      revenueValue: 100,
      directTrafficPolicy: "IGNORE_WHEN_PRIOR_KNOWN",
      conversionAt: new Date("2026-01-05T00:00:00Z"),
    });
    expect(result.credits[0]?.touchpointId).toBe("1");
    expect(result.excludedTouchpoints).toHaveLength(1);
  });
});
