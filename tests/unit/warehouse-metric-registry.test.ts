import { describe, expect, it } from "vitest";
import {
  DEFAULT_METRIC_DEFINITIONS,
  metricDefinitionByKey,
} from "@/lib/warehouse/metric-registry";

describe("warehouse metric registry", () => {
  it("defines exactly 10 default canonical metrics", () => {
    expect(DEFAULT_METRIC_DEFINITIONS).toHaveLength(10);
  });

  it("defines canonical metric keys with aggregation metadata", () => {
    const keys = DEFAULT_METRIC_DEFINITIONS.map((definition) => definition.canonicalKey);
    expect(keys).toContain("sessions");
    expect(keys).toContain("revenue");
    expect(keys).toContain("ctr");
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("marks non-additive rate metrics as averages", () => {
    const ctr = metricDefinitionByKey("ctr");
    const impressions = metricDefinitionByKey("impressions");
    expect(ctr?.aggregation).toBe("AVG");
    expect(impressions?.aggregation).toBe("SUM");
    expect(ctr?.isCumulative).toBe(false);
    expect(impressions?.isCumulative).toBe(true);
  });

  it("returns undefined for unknown metric keys", () => {
    expect(metricDefinitionByKey("not-a-real-metric")).toBeUndefined();
  });
});
