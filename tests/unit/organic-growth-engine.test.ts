import { describe, expect, it } from "vitest";
import { calculateOrganicGrowthScore } from "@/lib/organic-growth/growth-score";
import { detectWinningContent } from "@/lib/organic-growth/winning-content";
import {
  buildVariantDraftsFromSource,
  validateChannelVariant,
} from "@/lib/organic-growth/validation";
import { unavailableValue } from "@/lib/marketing-intelligence/format";

describe("organic growth score", () => {
  it("scores only dimensions backed by real data", () => {
    const score = calculateOrganicGrowthScore({
      publishingConsistencyScore: 80,
      engagementRate: 4.2,
      previousEngagementRate: 3.8,
      followerGrowthRate: null,
      formatDiversityCount: 2,
      formatCount: 8,
      connectedChannelCount: 3,
      totalChannelSlots: 9,
      conversionContribution: null,
      communityEngagementScore: null,
      experimentCount: 0,
      scheduledUpcoming: 1,
      daysWithoutScheduled: 3,
    });

    expect(score.total).toBeGreaterThan(0);
    expect(score.dimensions.find((d) => d.key === "audience_growth")?.unavailable).toBe(true);
    expect(score.dimensions.find((d) => d.key === "conversion_contribution")?.unavailable).toBe(true);
  });

  it("returns zero total when no dimensions are available", () => {
    const score = calculateOrganicGrowthScore({
      publishingConsistencyScore: null,
      engagementRate: null,
      previousEngagementRate: null,
      followerGrowthRate: null,
      formatDiversityCount: 0,
      formatCount: 0,
      connectedChannelCount: 0,
      totalChannelSlots: 9,
      conversionContribution: null,
      communityEngagementScore: null,
      experimentCount: 0,
      scheduledUpcoming: 0,
      daysWithoutScheduled: null,
    });

    expect(score.total).toBe(0);
    expect(score.dimensions.find((dimension) => dimension.key === "channel_coverage")?.score).toBe(0);
    expect(
      score.dimensions.filter((dimension) => dimension.unavailable).length,
    ).toBeGreaterThanOrEqual(6);
  });
});

describe("winning content detection", () => {
  const sampleItems = [
    {
      id: "1",
      title: "Baseline post",
      channel: "LinkedIn",
      format: "TEXT_POST",
      theme: null,
      publishedAt: "2026-08-01T00:00:00.000Z",
      reach: 1000,
      engagements: 20,
      engagementRate: 0.02,
      profileVisits: 10,
      clicks: 5,
    },
    {
      id: "2",
      title: "Strong post",
      channel: "LinkedIn",
      format: "TEXT_POST",
      theme: null,
      publishedAt: "2026-08-02T00:00:00.000Z",
      reach: 2000,
      engagements: 80,
      engagementRate: 0.06,
      profileVisits: 40,
      clicks: 20,
    },
    {
      id: "3",
      title: "Average post",
      channel: "LinkedIn",
      format: "TEXT_POST",
      theme: null,
      publishedAt: "2026-08-03T00:00:00.000Z",
      reach: 1200,
      engagements: 24,
      engagementRate: 0.02,
      profileVisits: 12,
      clicks: 6,
    },
  ];

  it("returns empty when sample size is insufficient", () => {
    expect(detectWinningContent(sampleItems.slice(0, 2))).toEqual([]);
  });

  it("detects content above baseline with evidence labels", () => {
    const winners = detectWinningContent(sampleItems);
    expect(winners).toHaveLength(1);
    expect(winners[0]?.id).toBe("2");
    expect(winners[0]?.engagementLift).toBeGreaterThan(1.5);
    expect(winners[0]?.evidenceLabel).toContain("× account median engagement");
  });
});

describe("channel variant validation", () => {
  it("requires media for instagram carousel", () => {
    const issues = validateChannelVariant({
      provider: "INSTAGRAM",
      format: "CAROUSEL",
      copy: "Caption",
      hasMedia: false,
      accountConnected: true,
    });

    expect(issues.some((issue) => issue.code === "missing_media")).toBe(true);
    expect(issues[0]?.message).toContain("at least one image asset");
  });

  it("builds channel-native variant drafts with lineage", () => {
    const drafts = buildVariantDraftsFromSource({
      sourceContentId: "content-1",
      title: "Grants update",
      body: "Five UK grants startups should apply for this month.",
      targetProviders: ["LINKEDIN", "X"],
    });

    expect(drafts.length).toBe(2);
    expect(drafts[0]?.lineage.sourceContentId).toBe("content-1");
    expect(drafts.some((draft) => draft.provider === "X")).toBe(true);
  });
});

describe("metric unavailable handling", () => {
  it("uses em dash for unavailable values without coercing to zero", () => {
    expect(unavailableValue()).toBe("—");
  });
});

describe("organic social routing", () => {
  it("exposes organic social under execute navigation", async () => {
    const { dashboardNavigationSections } = await import("@/components/navigation/dashboard-nav");
    const execute = dashboardNavigationSections.find((section) => section.id === "execute");
    expect(execute?.items.some((item) => item.href === "/organic-social")).toBe(true);
  });
});
