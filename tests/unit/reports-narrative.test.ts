import { describe, expect, it } from "vitest";
import {
  buildDeterministicReportNarrative,
  validateSocialReportNarrative,
} from "@/lib/reports/narrative-validation";

describe("social report narrative grounding", () => {
  it("accepts hedged narrative with supported metrics", () => {
    const narrative = buildDeterministicReportNarrative({
      overview: {
        totals: { engagements: 120 },
        derived: { engagementRate: 0.05, followerGrowth: 12 },
        postsMeasured: 4,
        accountsMeasured: 2,
      },
      topContent: [{ label: "Launch post", score: 80 }],
      weakContent: [{ label: "Reminder post", score: 10 }],
      leadsCreated: 3,
      dataLimitations: ["reach was unavailable from connected providers for this period."],
    });

    expect(() =>
      validateSocialReportNarrative(narrative, {
        overview: {
          totals: { engagements: 120 },
          derived: { engagementRate: 0.05, followerGrowth: 12 },
          postsMeasured: 4,
          accountsMeasured: 2,
        },
        topContent: [{ label: "Launch post", score: 80 }],
        weakContent: [{ label: "Reminder post", score: 10 }],
        leadsCreated: 3,
      }),
    ).not.toThrow();
    expect(narrative.executiveSummary).toMatch(/the data suggests/i);
  });

  it("rejects unsupported invented metrics", () => {
    expect(() =>
      validateSocialReportNarrative(
        {
          executiveSummary: "Engagement jumped to 99999 overnight.",
          keyImprovements: [],
          keyDeclines: [],
          notableContent: [],
          recommendedActions: [],
          dataLimitations: [],
        },
        { overview: { totals: { engagements: 10 } } },
      ),
    ).toThrow();
  });

  it("rejects unhedged causal claims", () => {
    expect(() =>
      validateSocialReportNarrative(
        {
          executiveSummary: "Engagement increased because of the new campaign.",
          keyImprovements: [],
          keyDeclines: [],
          notableContent: [],
          recommendedActions: [],
          dataLimitations: [],
        },
        { overview: { totals: { engagements: 10 } } },
      ),
    ).toThrow();
  });
});
