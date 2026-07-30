import { describe, expect, it } from "vitest";
import { calculateAttributionCredits } from "@/lib/attribution/models";
import type { AttributionTouchpointInput } from "@/lib/attribution/types";

function touchpoints(ids: string[], baseDate = new Date("2026-01-01T00:00:00Z")): AttributionTouchpointInput[] {
  return ids.map((id, index) => ({
    id,
    occurredAt: new Date(baseDate.getTime() + index * 86_400_000),
    channel: id === "direct" ? "DIRECT" : `CH-${id}`,
    campaign: `camp-${id}`,
    position: index + 1,
    isDirect: id === "direct",
  }));
}

const conversionAt = new Date("2026-01-10T00:00:00Z");

describe("attribution credit formulas", () => {
  it("assigns 100% to first touch", () => {
    const result = calculateAttributionCredits({
      modelType: "FIRST_TOUCH",
      touchpoints: touchpoints(["a", "b", "c"]),
      revenueValue: 100,
      directTrafficPolicy: "RETAIN",
      conversionAt,
    });
    expect(result.credits[0]?.creditPercent).toBe(100);
    expect(result.totalCreditPercent).toBe(100);
    expect(result.credits[0]?.creditValue).toBe(100);
  });

  it("assigns 100% to last touch", () => {
    const result = calculateAttributionCredits({
      modelType: "LAST_TOUCH",
      touchpoints: touchpoints(["a", "b", "c"]),
      revenueValue: 200,
      directTrafficPolicy: "RETAIN",
      conversionAt,
    });
    expect(result.credits[2]?.creditPercent).toBe(100);
    expect(result.credits[2]?.creditValue).toBe(200);
  });

  it("splits linearly across touchpoints", () => {
    const result = calculateAttributionCredits({
      modelType: "LINEAR",
      touchpoints: touchpoints(["a", "b", "c"]),
      revenueValue: 300,
      directTrafficPolicy: "RETAIN",
      conversionAt,
    });
    expect(result.credits).toHaveLength(3);
    expect(result.totalCreditPercent).toBe(100);
    for (const credit of result.credits) {
      expect(credit.creditPercent).toBeCloseTo(33.3333, 2);
    }
  });

  it("applies position-based weighting", () => {
    const result = calculateAttributionCredits({
      modelType: "POSITION_BASED",
      touchpoints: touchpoints(["a", "b", "c"]),
      revenueValue: 100,
      directTrafficPolicy: "RETAIN",
      conversionAt,
    });
    expect(result.credits[0]?.creditPercent).toBe(40);
    expect(result.credits[1]?.creditPercent).toBe(20);
    expect(result.credits[2]?.creditPercent).toBe(40);
    expect(result.totalCreditPercent).toBe(100);
  });

  it("applies time decay favouring recent touchpoints", () => {
    const result = calculateAttributionCredits({
      modelType: "TIME_DECAY",
      touchpoints: touchpoints(["a", "b", "c"]),
      revenueValue: 100,
      directTrafficPolicy: "RETAIN",
      conversionAt,
      config: { timeDecayHalfLifeDays: 7 },
    });
    expect(result.credits[2]!.creditPercent).toBeGreaterThan(result.credits[0]!.creditPercent);
    expect(result.totalCreditPercent).toBe(100);
  });

  it("returns zero credit when no touchpoints", () => {
    const result = calculateAttributionCredits({
      modelType: "LINEAR",
      touchpoints: [],
      revenueValue: 50,
      directTrafficPolicy: "RETAIN",
      conversionAt,
    });
    expect(result.credits).toHaveLength(0);
    expect(result.totalCreditPercent).toBe(0);
    expect(result.limitations).toContain("No eligible touchpoints within lookback window.");
  });
});

describe("credit totals", () => {
  it("totals 100% for two-touch journeys across all models", () => {
    const models = ["FIRST_TOUCH", "LAST_TOUCH", "LINEAR", "POSITION_BASED", "TIME_DECAY"] as const;
    for (const modelType of models) {
      const result = calculateAttributionCredits({
        modelType,
        touchpoints: touchpoints(["x", "y"]),
        revenueValue: 150,
        directTrafficPolicy: "RETAIN",
        conversionAt,
      });
      expect(result.totalCreditPercent).toBe(100);
    }
  });
});
