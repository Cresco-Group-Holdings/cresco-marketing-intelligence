import { describe, expect, it } from "vitest";
import { computeBaselines, median, type PostSnapshot } from "@/lib/growth/baselines";
import { computeConfidence } from "@/lib/growth/confidence";
import { INSUFFICIENT_DATA_MESSAGE, MIN_BRAND_POSTS } from "@/lib/growth/constants";
import { generateInsights } from "@/lib/growth/insight-engine";

const post = (
  id: string,
  overrides: Partial<PostSnapshot> = {},
): PostSnapshot => ({
  providerPostId: id,
  provider: "INSTAGRAM",
  contentItemId: `content-${id}`,
  publishedAt: new Date("2026-07-15T14:00:00Z"),
  values: {
    impressions: 1000,
    likes: 50,
    comments: 10,
    shares: 5,
    saves: 5,
    reach: 800,
    clicks: 20,
  },
  attribution: {
    contentPillar: "Education",
    contentType: "REEL",
    campaignName: "Launch",
    primaryCTA: "Learn more",
    targetAudienceId: "aud-1",
    hook: "Did you know?",
    captionLength: 120,
    durationSeconds: 45,
    hashtags: ["grant", "funding"],
  },
  ...overrides,
});

describe("growth baselines", () => {
  it("computes brand median and previous period benchmarks", () => {
    const current = Array.from({ length: 6 }, (_, i) => post(String(i)));
    const previous = Array.from({ length: 6 }, (_, i) =>
      post(`p-${i}`, { values: { impressions: 500, likes: 10, comments: 2, shares: 1, saves: 1 } }),
    );
    const benchmarks = computeBaselines(current, previous);
    expect(benchmarks.some((b) => b.benchmarkType === "BRAND_MEDIAN")).toBe(true);
    expect(benchmarks.some((b) => b.benchmarkType === "PREVIOUS_PERIOD")).toBe(true);
  });

  it("returns null median for empty values", () => {
    expect(median([])).toBeNull();
  });
});

describe("growth confidence", () => {
  it("returns LOW when sample size is below threshold", () => {
    expect(
      computeConfidence({ sampleSize: MIN_BRAND_POSTS - 1, hasComparisonPeriod: true }),
    ).toBe("LOW");
  });

  it("returns HIGH for large samples with strong lift", () => {
    expect(
      computeConfidence({
        sampleSize: MIN_BRAND_POSTS * 2,
        segmentSampleSize: 4,
        hasComparisonPeriod: true,
        liftMagnitude: 1.6,
      }),
    ).toBe("HIGH");
  });
});

describe("growth insight engine", () => {
  it("returns insufficient data message when post count is too low", () => {
    const insights = generateInsights({
      currentPosts: [post("1"), post("2")],
      previousPosts: [],
      benchmarks: [],
      analysisPeriodStart: new Date("2026-07-01"),
      analysisPeriodEnd: new Date("2026-07-31"),
      comparedPeriodStart: null,
      comparedPeriodEnd: null,
      periodDays: 30,
      followerGrowth: null,
      previousFollowerGrowth: null,
    });
    expect(insights.every((i) => i.summary === INSUFFICIENT_DATA_MESSAGE || i.dataStatus === "SUFFICIENT")).toBe(true);
    expect(insights.filter((i) => i.dataStatus === "INSUFFICIENT").length).toBeGreaterThan(0);
  });

  it("produces sufficient high-performing topic insight with enough data", () => {
    const educationPosts = Array.from({ length: 3 }, (_, i) =>
      post(`e-${i}`, {
        attribution: {
          ...post("x").attribution!,
          contentPillar: "Education",
        },
        values: { impressions: 1000, likes: 200, comments: 40, shares: 10, saves: 0 },
      }),
    );
    const otherPosts = Array.from({ length: 5 }, (_, i) =>
      post(`o-${i}`, {
        attribution: {
          ...post("x").attribution!,
          contentPillar: "News",
        },
        values: { impressions: 1000, likes: 5, comments: 2, shares: 1, saves: 0 },
      }),
    );

    const currentPosts = [...educationPosts, ...otherPosts];
    const benchmarks = computeBaselines(currentPosts, []);
    const insights = generateInsights({
      currentPosts,
      previousPosts: [],
      benchmarks,
      analysisPeriodStart: new Date("2026-07-01"),
      analysisPeriodEnd: new Date("2026-07-31"),
      comparedPeriodStart: new Date("2026-06-01"),
      comparedPeriodEnd: new Date("2026-06-30"),
      periodDays: 30,
      followerGrowth: null,
      previousFollowerGrowth: null,
    });

    const topicInsight = insights.find((i) => i.insightType === "HIGH_PERFORMING_TOPIC");
    expect(topicInsight?.dataStatus).toBe("SUFFICIENT");
    expect(topicInsight?.supportingContentIds.length).toBeGreaterThan(0);
    expect(topicInsight?.evidence.length).toBeGreaterThan(0);
  });
});
