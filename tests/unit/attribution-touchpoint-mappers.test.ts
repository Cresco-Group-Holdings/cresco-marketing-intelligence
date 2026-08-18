import { describe, expect, it } from "vitest";
import { mapAttributionTouchpointToInput } from "@/lib/attribution/mappers";
import { computeAttributionFromJourneys } from "@/lib/unified-analytics/attribution";

describe("mapAttributionTouchpointToInput", () => {
  it("normalizes null position to undefined", () => {
    const result = mapAttributionTouchpointToInput({
      id: "tp-1",
      occurredAt: "2026-01-25T00:00:00Z",
      channel: "Meta Ads",
      position: null,
      isExcluded: false,
    });

    expect(result.position).toBeUndefined();
  });

  it("preserves numeric position including zero", () => {
    const zero = mapAttributionTouchpointToInput({
      id: "tp-zero",
      occurredAt: "2026-01-25T00:00:00Z",
      channel: "Meta Ads",
      position: 0,
      isExcluded: false,
    });
    const normal = mapAttributionTouchpointToInput({
      id: "tp-two",
      occurredAt: "2026-01-26T00:00:00Z",
      channel: "Meta Ads",
      position: 2,
      isExcluded: false,
    });

    expect(zero.position).toBe(0);
    expect(normal.position).toBe(2);
  });
});

describe("computeAttributionFromJourneys touchpoint boundaries", () => {
  it("accepts journeys with null touchpoint positions", () => {
    const result = computeAttributionFromJourneys(
      [
        {
          journeyStart: "2026-01-20T00:00:00Z",
          journeyEnd: "2026-02-01T12:00:00Z",
          revenueValue: 500,
          status: "CONVERTED",
          touchpoints: [
            {
              id: "tp-1",
              occurredAt: "2026-01-25T00:00:00Z",
              channel: "Instagram Organic",
              position: null,
              isExcluded: false,
            },
            {
              id: "tp-2",
              occurredAt: "2026-01-31T00:00:00Z",
              channel: "Meta Ads",
              position: 2,
              isExcluded: false,
            },
          ],
        },
      ],
      "LAST_TOUCH",
      30,
    );

    expect(result.attributedRevenue).toBeGreaterThan(0);
    expect(result.channelBreakdown.length).toBeGreaterThan(0);
  });
});
