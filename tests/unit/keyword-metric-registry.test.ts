import { describe, expect, it } from "vitest";
import { formatMetricDisplay } from "@/lib/keywords/metric-registry";

describe("keyword metric registry", () => {
  it("returns null for missing values", () => {
    expect(
      formatMetricDisplay({
        metricType: "IMPRESSIONS",
        provider: "TEST",
        source: "MANUAL",
        measuredAt: new Date(),
        value: null,
      }),
    ).toBeNull();
  });

  it("formats CTR as percentage", () => {
    expect(
      formatMetricDisplay({
        metricType: "CTR",
        provider: "GSC",
        source: "SEARCH_CONSOLE",
        measuredAt: new Date(),
        value: 0.0523,
      }),
    ).toBe("5.2%");
  });

  it("does not treat zero as null", () => {
    expect(
      formatMetricDisplay({
        metricType: "CLICKS",
        provider: "GSC",
        source: "SEARCH_CONSOLE",
        measuredAt: new Date(),
        value: 0,
      }),
    ).toBe("0");
  });
});
