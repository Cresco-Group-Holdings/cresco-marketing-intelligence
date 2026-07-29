import { describe, expect, it } from "vitest";
import {
  collectDataLimitations,
  rankContentPerformance,
  resolveReportPeriod,
} from "@/lib/reports/calculations";

describe("report calculations", () => {
  it("ranks top and weak content by metric", () => {
    const groups = [
      {
        key: "a",
        label: "Post A",
        postsMeasured: 1,
        totals: { engagements: 100 },
        derived: { engagementRate: 0.1 },
      },
      {
        key: "b",
        label: "Post B",
        postsMeasured: 1,
        totals: { engagements: 20 },
        derived: { engagementRate: 0.02 },
      },
    ];
    const ranked = rankContentPerformance(groups, "engagements", 1);
    expect(ranked.top[0]?.label).toBe("Post A");
    expect(ranked.weak[0]?.label).toBe("Post B");
  });

  it("collects missing metric limitations", () => {
    expect(
      collectDataLimitations({
        postsMeasured: 0,
        accountsMeasured: 0,
        unavailableMetrics: ["reach"],
        syncIncomplete: true,
      }),
    ).toEqual(
      expect.arrayContaining([
        "No post-level metrics were available for the selected period.",
        "No account-level metrics were available for the selected period.",
        "reach was unavailable from connected providers for this period.",
        "Analytics sync had not completed for all selected accounts before this report was generated.",
      ]),
    );
  });

  it("resolves weekly and monthly periods", () => {
    const reference = new Date("2026-07-29T12:00:00.000Z");
    const weekly = resolveReportPeriod("WEEKLY_PERFORMANCE", "UTC", reference);
    expect(weekly.to.toISOString()).toBe(reference.toISOString());
    expect(weekly.from.getUTCDate()).toBe(22);

    const monthly = resolveReportPeriod("MONTHLY_PERFORMANCE", "UTC", reference);
    expect(monthly.from.getUTCMonth()).toBe(5);
  });
});
