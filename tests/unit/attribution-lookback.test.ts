import { describe, expect, it } from "vitest";
import { filterTouchpointsByLookback } from "@/lib/attribution/models";
import type { AttributionTouchpointInput } from "@/lib/attribution/types";

function tp(id: string, iso: string): AttributionTouchpointInput {
  return { id, occurredAt: new Date(iso), channel: "EMAIL" };
}

describe("lookback windows", () => {
  const conversionAt = new Date("2026-02-01T00:00:00Z");

  it("includes touchpoints within lookback window", () => {
    const { included, excluded } = filterTouchpointsByLookback(
      [tp("1", "2026-01-15T00:00:00Z"), tp("2", "2026-01-20T00:00:00Z")],
      conversionAt,
      30,
    );
    expect(included).toHaveLength(2);
    expect(excluded).toHaveLength(0);
  });

  it("excludes touchpoints before lookback window", () => {
    const { included, excluded } = filterTouchpointsByLookback(
      [tp("old", "2025-10-01T00:00:00Z"), tp("new", "2026-01-20T00:00:00Z")],
      conversionAt,
      30,
    );
    expect(included.map((t) => t.id)).toEqual(["new"]);
    expect(excluded[0]?.exclusionReason).toBe("outside_lookback_window");
  });

  it("excludes touchpoints after conversion", () => {
    const { excluded } = filterTouchpointsByLookback(
      [tp("late", "2026-02-05T00:00:00Z")],
      conversionAt,
      90,
    );
    expect(excluded[0]?.exclusionReason).toBe("after_conversion");
  });
});

describe("late touchpoints", () => {
  it("excludes events arriving after conversion timestamp", () => {
    const conversionAt = new Date("2026-03-01T12:00:00Z");
    const { included } = filterTouchpointsByLookback(
      [
        tp("on-time", "2026-02-28T12:00:00Z"),
        tp("late", "2026-03-02T12:00:00Z"),
      ],
      conversionAt,
      90,
    );
    expect(included).toHaveLength(1);
    expect(included[0]?.id).toBe("on-time");
  });
});
