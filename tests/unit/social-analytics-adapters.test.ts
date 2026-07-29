import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FacebookAnalyticsAdapter,
  InstagramAnalyticsAdapter,
  LinkedInAnalyticsAdapter,
  TikTokAnalyticsAdapter,
  XAnalyticsAdapter,
  YouTubeAnalyticsAdapter,
  getSocialAnalyticsAdapter,
} from "@/lib/social/analytics-adapters";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const range = {
  accessToken: "token",
  providerAccountId: "account",
  from: new Date("2026-06-01T00:00:00Z"),
  to: new Date("2026-07-01T00:00:00Z"),
};

describe("provider pagination cursors", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("round-trips Facebook paging cursors on post insights", async () => {
    const fetch = vi.fn().mockResolvedValue(
      json({
        data: [{ name: "post_impressions", values: [{ value: 12 }] }],
        paging: { cursors: { after: "fb-next" } },
      }),
    );
    vi.stubGlobal("fetch", fetch);
    const result = await new FacebookAnalyticsAdapter("https://meta.test").fetchPostMetrics({
      accessToken: "token",
      providerAccountId: "page",
      providerPostId: "post",
      cursor: "fb-prev",
    });
    expect(String(fetch.mock.calls[0]![0])).toContain("after=fb-prev");
    expect(result.cursor).toBe("fb-next");
  });

  it("advances the LinkedIn Rest.li start index only while more rows remain", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          json({ likesSummary: { totalLikes: 3 }, paging: { start: 0, count: 50, total: 120 } }),
        )
        .mockResolvedValueOnce(
          json({ likesSummary: { totalLikes: 3 }, paging: { start: 100, count: 50, total: 120 } }),
        ),
    );
    const adapter = new LinkedInAnalyticsAdapter("https://li.test");
    const input = { accessToken: "token", providerAccountId: "org", providerPostId: "urn:post" };
    expect((await adapter.fetchPostMetrics(input)).cursor).toBe("50");
    expect((await adapter.fetchPostMetrics({ ...input, cursor: "100" })).cursor).toBeUndefined();
  });

  it("returns the YouTube page token and forwards it on the next call", async () => {
    const fetch = vi.fn().mockResolvedValue(
      json({ items: [{ statistics: { viewCount: "40" } }], nextPageToken: "yt-next" }),
    );
    vi.stubGlobal("fetch", fetch);
    const result = await new YouTubeAnalyticsAdapter("https://yt.test").fetchPostMetrics({
      accessToken: "token",
      providerAccountId: "channel",
      providerPostId: "video",
      cursor: "yt-prev",
    });
    expect(String(fetch.mock.calls[0]![0])).toContain("pageToken=yt-prev");
    expect(result.cursor).toBe("yt-next");
  });

  it("returns the X pagination token and forwards it on the next call", async () => {
    const fetch = vi.fn().mockResolvedValue(
      json({ data: { public_metrics: { like_count: 2 } }, meta: { next_token: "x-next" } }),
    );
    vi.stubGlobal("fetch", fetch);
    const result = await new XAnalyticsAdapter("https://x.test").fetchPostMetrics({
      accessToken: "token",
      providerAccountId: "user",
      providerPostId: "tweet",
      cursor: "x-prev",
    });
    expect(String(fetch.mock.calls[0]![0])).toContain("pagination_token=x-prev");
    expect(result.cursor).toBe("x-next");
  });
});

describe("provider historical discovery", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("lists Instagram media inside the requested window", async () => {
    const fetch = vi.fn().mockResolvedValue(
      json({
        data: [{ id: "media-1", timestamp: "2026-06-10T09:00:00Z" }],
        paging: { cursors: { after: "ig-next" } },
      }),
    );
    vi.stubGlobal("fetch", fetch);
    const result = await new InstagramAnalyticsAdapter("https://meta.test").discoverPosts(range);
    const url = String(fetch.mock.calls[0]![0]);
    expect(url).toContain("since=");
    expect(url).toContain("until=");
    expect(result.posts).toEqual([
      { providerPostId: "media-1", publishedAt: new Date("2026-06-10T09:00:00Z") },
    ]);
    expect(result.hasMore).toBe(true);
  });

  it("lists Facebook Page posts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(json({ data: [{ id: "p1", created_time: "2026-06-02T00:00:00Z" }] })),
    );
    const result = await new FacebookAnalyticsAdapter("https://meta.test").discoverPosts(range);
    expect(result.posts[0]?.providerPostId).toBe("p1");
    expect(result.hasMore).toBe(false);
  });

  it("applies the window client-side for TikTok because the list endpoint is not date filtered", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        json({
          data: {
            videos: [
              { id: "in-range", create_time: 1_781_000_000 },
              { id: "out-of-range", create_time: 1_600_000_000 },
            ],
            cursor: 42,
            has_more: true,
          },
        }),
      ),
    );
    const result = await new TikTokAnalyticsAdapter("https://tt.test").discoverPosts({
      ...range,
      from: new Date("2026-06-01T00:00:00Z"),
      to: new Date("2026-06-30T00:00:00Z"),
    });
    expect(result.posts.map((post) => post.providerPostId)).toEqual(["in-range"]);
    expect(result.cursor).toBe("42");
    expect(result.hasMore).toBe(true);
  });

  it("lists YouTube uploads and X posts with provider tokens", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          json({
            items: [{ id: { videoId: "v1" }, snippet: { publishedAt: "2026-06-05T00:00:00Z" } }],
            nextPageToken: "page-2",
          }),
        )
        .mockResolvedValueOnce(
          json({
            data: [{ id: "t1", created_at: "2026-06-06T00:00:00Z" }],
            meta: { next_token: "token-2" },
          }),
        ),
    );
    const youtube = await new YouTubeAnalyticsAdapter("https://yt.test").discoverPosts(range);
    const x = await new XAnalyticsAdapter("https://x.test").discoverPosts(range);
    expect(youtube.posts[0]?.providerPostId).toBe("v1");
    expect(youtube.cursor).toBe("page-2");
    expect(x.posts[0]?.providerPostId).toBe("t1");
    expect(x.cursor).toBe("token-2");
  });

  it("declares LinkedIn history unsupported instead of implying coverage", () => {
    const linkedin = getSocialAnalyticsAdapter("LINKEDIN");
    expect(linkedin.historicalBackfill.supported).toBe(false);
    expect(linkedin.discoverPosts).toBeUndefined();
    expect(linkedin.historicalBackfill.limitation).toMatch(/published through this platform/i);
    for (const provider of ["INSTAGRAM", "FACEBOOK", "TIKTOK", "YOUTUBE", "X"] as const) {
      const adapter = getSocialAnalyticsAdapter(provider);
      expect(adapter.historicalBackfill.supported).toBe(true);
      expect(typeof adapter.discoverPosts).toBe("function");
    }
  });
});
