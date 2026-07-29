import { afterEach, describe, expect, it, vi } from "vitest";
import { SOCIAL_METRIC_REGISTRY, normaliseMetricRecord } from "@/lib/social/metric-registry";
import {
  averageViewsPerPost,
  clickThroughRate,
  engagementRate,
  followerGrowth,
  publishingConsistency,
  videoCompletionRate,
} from "@/lib/social/derived-metrics";
import {
  FacebookAnalyticsAdapter,
  InstagramAnalyticsAdapter,
  LinkedInAnalyticsAdapter,
  TikTokAnalyticsAdapter,
  XAnalyticsAdapter,
  YouTubeAnalyticsAdapter,
} from "@/lib/social/analytics-adapters";
import { hasPermission, PERMISSIONS } from "@/lib/tenancy/permissions";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("canonical social metric registry", () => {
  it("grants analytics read to analysts but restricts manual sync", () => {
    expect(hasPermission("ANALYST", PERMISSIONS["analytics.read"])).toBe(true);
    expect(hasPermission("ANALYST", PERMISSIONS["analytics.sync"])).toBe(false);
    expect(hasPermission("ADMIN", PERMISSIONS["analytics.sync"])).toBe(true);
  });
  it("keeps semantically different metrics distinct", () => {
    expect(SOCIAL_METRIC_REGISTRY.some((metric) => metric.canonicalName === "reach")).toBe(true);
    expect(SOCIAL_METRIC_REGISTRY.some((metric) => metric.canonicalName === "impressions")).toBe(
      true,
    );
    expect(
      SOCIAL_METRIC_REGISTRY.find(
        (metric) =>
          metric.provider === "FACEBOOK" &&
          metric.providerSourceField === "post_reactions_by_type_total",
      )?.canonicalName,
    ).toBe("reactions");
    expect(
      SOCIAL_METRIC_REGISTRY.find(
        (metric) =>
          metric.provider === "YOUTUBE" && metric.providerSourceField === "subscriberCount",
      )?.canonicalName,
    ).toBe("subscribers");
  });

  it("stores only numeric fields actually returned by the provider", () => {
    expect(
      normaliseMetricRecord("X", "POST", {
        impression_count: 100,
        like_count: "5",
      }),
    ).toEqual([
      {
        metricType: "impressions",
        metricValue: 100,
        sourceField: "impression_count",
      },
      {
        metricType: "likes",
        metricValue: 5,
        sourceField: "like_count",
      },
    ]);
  });
});

describe("deterministic derived metrics", () => {
  it("calculates engagement only with a compatible denominator", () => {
    expect(
      engagementRate({
        impressions: 100,
        likes: 5,
        comments: 2,
        shares: 3,
      }),
    ).toBe(10);
    expect(engagementRate({ likes: 5 })).toBeNull();
    expect(engagementRate({ impressions: 0, likes: 5 })).toBeNull();
  });

  it("calculates CTR, growth, views, consistency and completion", () => {
    expect(clickThroughRate({ clicks: 5, impressions: 100 })).toBe(5);
    expect(followerGrowth(100, 115)).toBe(15);
    expect(averageViewsPerPost([10, undefined, 30])).toBe(20);
    expect(publishingConsistency(14, 7)).toBe(2);
    expect(videoCompletionRate(25, 100)).toBe(25);
  });

  it("returns null instead of misleading percentages", () => {
    expect(clickThroughRate({ clicks: 4 })).toBeNull();
    expect(followerGrowth(undefined, 10)).toBeNull();
    expect(averageViewsPerPost([undefined])).toBeNull();
    expect(videoCompletionRate(undefined, 100)).toBeNull();
  });
});

describe("provider analytics mappings", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("maps Instagram and Facebook insights without substituting metrics", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          json({
            data: [
              { name: "impressions", values: [{ value: 100 }] },
              { name: "reach", values: [{ value: 70 }] },
            ],
          }),
        )
        .mockResolvedValueOnce(
          json({
            data: [
              { name: "post_impressions", values: [{ value: 120 }] },
              {
                name: "post_reactions_by_type_total",
                values: [{ value: 9 }],
              },
            ],
          }),
        ),
    );
    const instagram = await new InstagramAnalyticsAdapter("https://meta.test").fetchPostMetrics({
      accessToken: "token",
      providerAccountId: "ig",
      providerPostId: "post",
    });
    const facebook = await new FacebookAnalyticsAdapter("https://meta.test").fetchPostMetrics({
      accessToken: "token",
      providerAccountId: "page",
      providerPostId: "post",
    });
    expect(instagram.observations.map((metric) => metric.metricType)).toEqual([
      "impressions",
      "reach",
    ]);
    expect(facebook.observations.map((metric) => metric.metricType)).toEqual([
      "impressions",
      "reactions",
    ]);
  });

  it("passes and returns provider cursors for incremental sync", async () => {
    const fetch = vi.fn().mockResolvedValue(
      json({
        data: [{ name: "impressions", values: [{ value: 10 }] }],
        paging: { cursors: { after: "next-page" } },
      }),
    );
    vi.stubGlobal("fetch", fetch);
    const result = await new InstagramAnalyticsAdapter("https://meta.test").fetchPostMetrics({
      accessToken: "token",
      providerAccountId: "ig",
      providerPostId: "post",
      cursor: "previous-page",
    });
    expect(String(fetch.mock.calls[0]![0])).toContain("after=previous-page");
    expect(result.cursor).toBe("next-page");
  });

  it("maps LinkedIn, TikTok, YouTube and X source fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          json({
            likesSummary: { totalLikes: 4 },
            commentsSummary: { totalFirstLevelComments: 2 },
          }),
        )
        .mockResolvedValueOnce(
          json({
            data: {
              videos: [
                {
                  view_count: 50,
                  like_count: 3,
                  comment_count: 1,
                  share_count: 2,
                },
              ],
            },
          }),
        )
        .mockResolvedValueOnce(
          json({
            items: [
              {
                statistics: {
                  viewCount: "80",
                  likeCount: "5",
                },
              },
            ],
          }),
        )
        .mockResolvedValueOnce(
          json({
            data: {
              public_metrics: {
                impression_count: 90,
                like_count: 6,
                reply_count: 2,
                retweet_count: 1,
              },
            },
          }),
        ),
    );
    const input = {
      accessToken: "token",
      providerAccountId: "account",
      providerPostId: "post",
    };
    expect(
      (await new LinkedInAnalyticsAdapter("https://li.test").fetchPostMetrics(input)).observations
        .length,
    ).toBe(2);
    expect(
      (await new TikTokAnalyticsAdapter("https://tt.test").fetchPostMetrics(input)).observations
        .length,
    ).toBe(4);
    expect(
      (await new YouTubeAnalyticsAdapter("https://yt.test").fetchPostMetrics(input)).observations
        .length,
    ).toBe(2);
    expect(
      (await new XAnalyticsAdapter("https://x.test").fetchPostMetrics(input)).observations.length,
    ).toBe(4);
  });

  it("normalises deleted posts and rate limits", async () => {
    const adapter = new XAnalyticsAdapter("https://x.test");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json({}, 404)));
    await expect(
      adapter.fetchPostMetrics({
        accessToken: "token",
        providerAccountId: "account",
        providerPostId: "deleted",
      }),
    ).rejects.toMatchObject({ code: "DELETED_POST" });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json({}, 429)));
    await expect(
      adapter.fetchPostMetrics({
        accessToken: "token",
        providerAccountId: "account",
        providerPostId: "limited",
      }),
    ).rejects.toMatchObject({
      code: "RATE_LIMITED",
      retryable: true,
    });
  });
});
