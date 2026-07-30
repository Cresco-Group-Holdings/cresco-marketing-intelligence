import { describe, expect, it } from "vitest";
import { mapPaidAdsMetric, PAID_ADS_RATE_METRICS } from "@/lib/paid-ads/metric-map";

describe("paid ads metric map", () => {
  it("maps provider spend to canonical cost", () => {
    expect(mapPaidAdsMetric("spend")).toBe("cost");
    expect(mapPaidAdsMetric("cost_micros")).toBe("cost");
  });

  it("maps engagement metrics", () => {
    expect(mapPaidAdsMetric("impressions")).toBe("impressions");
    expect(mapPaidAdsMetric("link_clicks")).toBe("link_clicks");
    expect(mapPaidAdsMetric("video_views")).toBe("video_views");
  });

  it("marks rate metrics", () => {
    expect(PAID_ADS_RATE_METRICS.has("ctr")).toBe(true);
    expect(PAID_ADS_RATE_METRICS.has("roas")).toBe(true);
  });

  it("returns null for unknown metrics", () => {
    expect(mapPaidAdsMetric("unknown_metric")).toBeNull();
  });
});
