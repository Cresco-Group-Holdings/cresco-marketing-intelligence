import type { SocialProvider } from "@prisma/client";
import { normaliseMetricRecord } from "@/lib/social/metric-registry";

export type MetricObservation = {
  metricType: string;
  metricValue: number;
  measuredAt: Date;
  metricPeriod: string;
  sourceField: string;
};

export type AnalyticsFetchResult = {
  observations: MetricObservation[];
  unavailableMetrics: string[];
  cursor?: string;
  raw: unknown;
};

export type DiscoveredPost = {
  providerPostId: string;
  publishedAt?: Date;
};

export type PostDiscoveryResult = {
  posts: DiscoveredPost[];
  cursor?: string;
  hasMore: boolean;
};

export type HistoricalBackfillSupport = {
  supported: boolean;
  /** Operator-facing explanation stored alongside sync results when coverage is limited. */
  limitation: string;
};

export class SocialAnalyticsProviderError extends Error {
  constructor(
    readonly code:
      | "RATE_LIMITED"
      | "TOKEN_EXPIRED"
      | "PERMISSION_MISSING"
      | "DELETED_POST"
      | "UNAVAILABLE"
      | "TRANSIENT"
      | "PROVIDER_ERROR",
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "SocialAnalyticsProviderError";
  }
}

export interface SocialAnalyticsAdapter {
  readonly provider: SocialProvider;
  readonly historicalBackfill: HistoricalBackfillSupport;
  fetchPostMetrics(input: {
    accessToken: string;
    providerAccountId: string;
    providerPostId: string;
    cursor?: string;
  }): Promise<AnalyticsFetchResult>;
  fetchAccountMetrics(input: {
    accessToken: string;
    providerAccountId: string;
    cursor?: string;
  }): Promise<AnalyticsFetchResult>;
  /**
   * Lists posts the provider itself reports for a date range. Adapters without provider history
   * omit this so the sync engine falls back to platform publishing records only.
   */
  discoverPosts?(input: {
    accessToken: string;
    providerAccountId: string;
    from: Date;
    to: Date;
    cursor?: string;
  }): Promise<PostDiscoveryResult>;
}

function observations(
  provider: SocialProvider,
  scope: "POST" | "ACCOUNT",
  record: Record<string, unknown>,
  measuredAt = new Date(),
  period = "LIFETIME",
): AnalyticsFetchResult {
  const normalised = normaliseMetricRecord(provider, scope, record).map((metric) => ({
    ...metric,
    measuredAt,
    metricPeriod: period,
  }));
  return { observations: normalised, unavailableMetrics: [], raw: record };
}

async function providerJson(url: string, accessToken: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(30_000),
  }).catch(() => {
    throw new SocialAnalyticsProviderError(
      "TRANSIENT",
      "Analytics provider request timed out.",
      true,
    );
  });
  if (response.status === 401) {
    throw new SocialAnalyticsProviderError("TOKEN_EXPIRED", "Analytics credentials expired.", true);
  }
  if (response.status === 403) {
    throw new SocialAnalyticsProviderError(
      "PERMISSION_MISSING",
      "Analytics permission is missing.",
      false,
    );
  }
  if (response.status === 404) {
    throw new SocialAnalyticsProviderError(
      "DELETED_POST",
      "Provider post was deleted or is unavailable.",
      false,
    );
  }
  if (response.status === 429) {
    throw new SocialAnalyticsProviderError(
      "RATE_LIMITED",
      "Provider analytics rate limit reached.",
      true,
    );
  }
  if (response.status >= 500) {
    throw new SocialAnalyticsProviderError(
      "TRANSIENT",
      "Analytics provider is temporarily unavailable.",
      true,
    );
  }
  if (!response.ok)
    throw new SocialAnalyticsProviderError("PROVIDER_ERROR", "Analytics request failed.", false);
  return response.json() as Promise<Record<string, unknown>>;
}

function metaRecord(payload: Record<string, unknown>) {
  const record: Record<string, unknown> = {};
  for (const metric of (payload.data as
    Array<{ name?: string; values?: Array<{ value?: unknown; end_time?: string }> }> | undefined) ??
    []) {
    if (metric.name && metric.values?.length) record[metric.name] = metric.values.at(-1)?.value;
  }
  return record;
}

function pagingCursor(payload: Record<string, unknown>) {
  return (payload.paging as { cursors?: { after?: string } } | undefined)?.cursors?.after;
}

const unixSeconds = (date: Date) => Math.floor(date.getTime() / 1000);

function metaDiscovery(payload: Record<string, unknown>, timestampField: string) {
  const rows =
    (payload.data as Array<Record<string, unknown>> | undefined)?.filter((row) =>
      Boolean(row.id),
    ) ?? [];
  const cursor = pagingCursor(payload);
  return {
    posts: rows.map((row) => ({
      providerPostId: String(row.id),
      publishedAt: row[timestampField] ? new Date(String(row[timestampField])) : undefined,
    })),
    cursor,
    hasMore: Boolean(cursor && rows.length > 0),
  };
}

export class InstagramAnalyticsAdapter implements SocialAnalyticsAdapter {
  readonly provider = "INSTAGRAM" as const;
  readonly historicalBackfill = {
    supported: true,
    limitation:
      "Instagram history covers media on the connected professional account; insight retention and metric availability vary by media type.",
  };
  constructor(private readonly base = "https://graph.facebook.com/v22.0") {}
  async fetchPostMetrics(input: Parameters<SocialAnalyticsAdapter["fetchPostMetrics"]>[0]) {
    const raw = await providerJson(
      `${this.base}/${input.providerPostId}/insights?metric=impressions,reach,views,likes,comments,shares,saved${input.cursor ? `&after=${encodeURIComponent(input.cursor)}` : ""}`,
      input.accessToken,
    );
    return {
      ...observations(this.provider, "POST", metaRecord(raw)),
      raw,
      cursor: pagingCursor(raw),
    };
  }
  async fetchAccountMetrics(input: Parameters<SocialAnalyticsAdapter["fetchAccountMetrics"]>[0]) {
    const raw = await providerJson(
      `${this.base}/${input.providerAccountId}/insights?metric=follower_count,profile_views&period=day${input.cursor ? `&after=${encodeURIComponent(input.cursor)}` : ""}`,
      input.accessToken,
    );
    return {
      ...observations(this.provider, "ACCOUNT", metaRecord(raw), new Date(), "DAY"),
      raw,
      cursor: pagingCursor(raw),
    };
  }
  async discoverPosts(input: Parameters<NonNullable<SocialAnalyticsAdapter["discoverPosts"]>>[0]) {
    const raw = await providerJson(
      `${this.base}/${input.providerAccountId}/media?fields=id,timestamp&limit=50&since=${unixSeconds(input.from)}&until=${unixSeconds(input.to)}${input.cursor ? `&after=${encodeURIComponent(input.cursor)}` : ""}`,
      input.accessToken,
    );
    return metaDiscovery(raw, "timestamp");
  }
}

export class FacebookAnalyticsAdapter implements SocialAnalyticsAdapter {
  readonly provider = "FACEBOOK" as const;
  readonly historicalBackfill = {
    supported: true,
    limitation:
      "Facebook Page history covers Page-owned posts; several insight metrics are deprecated or restricted by Page category and API version.",
  };
  constructor(private readonly base = "https://graph.facebook.com/v22.0") {}
  async fetchPostMetrics(input: Parameters<SocialAnalyticsAdapter["fetchPostMetrics"]>[0]) {
    const raw = await providerJson(
      `${this.base}/${input.providerPostId}/insights?metric=post_impressions,post_impressions_unique,post_clicks,post_reactions_by_type_total,post_video_views${input.cursor ? `&after=${encodeURIComponent(input.cursor)}` : ""}`,
      input.accessToken,
    );
    return {
      ...observations(this.provider, "POST", metaRecord(raw)),
      raw,
      cursor: pagingCursor(raw),
    };
  }
  async fetchAccountMetrics(input: Parameters<SocialAnalyticsAdapter["fetchAccountMetrics"]>[0]) {
    const raw = await providerJson(
      `${this.base}/${input.providerAccountId}/insights?metric=page_follows,page_impressions_unique&period=day${input.cursor ? `&after=${encodeURIComponent(input.cursor)}` : ""}`,
      input.accessToken,
    );
    return {
      ...observations(this.provider, "ACCOUNT", metaRecord(raw), new Date(), "DAY"),
      raw,
      cursor: pagingCursor(raw),
    };
  }
  async discoverPosts(input: Parameters<NonNullable<SocialAnalyticsAdapter["discoverPosts"]>>[0]) {
    const raw = await providerJson(
      `${this.base}/${input.providerAccountId}/posts?fields=id,created_time&limit=50&since=${unixSeconds(input.from)}&until=${unixSeconds(input.to)}${input.cursor ? `&after=${encodeURIComponent(input.cursor)}` : ""}`,
      input.accessToken,
    );
    return metaDiscovery(raw, "created_time");
  }
}

export class LinkedInAnalyticsAdapter implements SocialAnalyticsAdapter {
  readonly provider = "LINKEDIN" as const;
  readonly historicalBackfill = {
    supported: false,
    limitation:
      "LinkedIn does not expose an organisation post history feed under the standard Community Management permissions, so analytics covers posts published through this platform only.",
  };
  constructor(private readonly base = "https://api.linkedin.com/rest") {}
  private headers() {
    return { "Linkedin-Version": "202607", "X-Restli-Protocol-Version": "2.0.0" };
  }
  async fetchPostMetrics(input: Parameters<SocialAnalyticsAdapter["fetchPostMetrics"]>[0]) {
    // LinkedIn pages Rest.li collections with a numeric `start` index rather than an opaque token.
    const start = Number(input.cursor ?? "0");
    const raw = await providerJson(
      `${this.base}/socialActions/${encodeURIComponent(input.providerPostId)}?start=${Number.isFinite(start) ? start : 0}&count=50`,
      input.accessToken,
      { headers: this.headers() },
    );
    const record = {
      likeCount: (raw.likesSummary as { totalLikes?: number } | undefined)?.totalLikes,
      commentCount: (raw.commentsSummary as { totalFirstLevelComments?: number } | undefined)
        ?.totalFirstLevelComments,
      ...(raw as Record<string, unknown>),
    };
    const paging = raw.paging as { start?: number; count?: number; total?: number } | undefined;
    const nextStart =
      paging && paging.total !== undefined && (paging.start ?? 0) + (paging.count ?? 0) < paging.total
        ? String((paging.start ?? 0) + (paging.count ?? 0))
        : undefined;
    return { ...observations(this.provider, "POST", record), raw, cursor: nextStart };
  }
  async fetchAccountMetrics(input: Parameters<SocialAnalyticsAdapter["fetchAccountMetrics"]>[0]) {
    const raw = await providerJson(
      `${this.base}/networkSizes/${encodeURIComponent(`urn:li:organization:${input.providerAccountId}`)}?edgeType=CompanyFollowedByMember`,
      input.accessToken,
      { headers: this.headers() },
    );
    return {
      ...observations(this.provider, "ACCOUNT", { followerCount: raw.firstDegreeSize }),
      raw,
    };
  }
}

export class TikTokAnalyticsAdapter implements SocialAnalyticsAdapter {
  readonly provider = "TIKTOK" as const;
  readonly historicalBackfill = {
    supported: true,
    limitation:
      "TikTok video history is limited to videos the connected creator account exposes to the Display API and does not include private or deleted videos.",
  };
  constructor(private readonly base = "https://open.tiktokapis.com/v2") {}
  async fetchPostMetrics(input: Parameters<SocialAnalyticsAdapter["fetchPostMetrics"]>[0]) {
    const raw = await providerJson(
      `${this.base}/video/query/?fields=id,view_count,like_count,comment_count,share_count`,
      input.accessToken,
      {
        method: "POST",
        body: JSON.stringify({
          filters: { video_ids: [input.providerPostId] },
          ...(input.cursor ? { cursor: input.cursor } : {}),
        }),
      },
    );
    const record =
      ((raw.data as { videos?: Array<Record<string, unknown>> } | undefined)?.videos ?? [])[0] ??
      {};
    return {
      ...observations(this.provider, "POST", record),
      raw,
      cursor: (raw.data as { cursor?: string } | undefined)?.cursor,
    };
  }
  async fetchAccountMetrics(input: Parameters<SocialAnalyticsAdapter["fetchAccountMetrics"]>[0]) {
    const raw = await providerJson(
      `${this.base}/user/info/?fields=follower_count,profile_view_count`,
      input.accessToken,
    );
    const record = (raw.data as { user?: Record<string, unknown> } | undefined)?.user ?? {};
    return { ...observations(this.provider, "ACCOUNT", record), raw };
  }
  async discoverPosts(input: Parameters<NonNullable<SocialAnalyticsAdapter["discoverPosts"]>>[0]) {
    const raw = await providerJson(`${this.base}/video/list/?fields=id,create_time`, input.accessToken, {
      method: "POST",
      body: JSON.stringify({
        max_count: 20,
        ...(input.cursor ? { cursor: Number(input.cursor) } : {}),
      }),
    });
    const data = (raw.data as
      | { videos?: Array<Record<string, unknown>>; cursor?: number; has_more?: boolean }
      | undefined) ?? {};
    const posts = (data.videos ?? [])
      .filter((video) => Boolean(video.id))
      .map((video) => ({
        providerPostId: String(video.id),
        publishedAt: video.create_time ? new Date(Number(video.create_time) * 1000) : undefined,
      }))
      // The list endpoint is not date-filterable, so the range is applied client-side.
      .filter(
        (post) => !post.publishedAt || (post.publishedAt >= input.from && post.publishedAt <= input.to),
      );
    return {
      posts,
      cursor: data.cursor === undefined ? undefined : String(data.cursor),
      hasMore: Boolean(data.has_more),
    };
  }
}

export class YouTubeAnalyticsAdapter implements SocialAnalyticsAdapter {
  readonly provider = "YOUTUBE" as const;
  readonly historicalBackfill = {
    supported: true,
    limitation:
      "YouTube history uses the public search index for the connected channel; unlisted and private uploads are not returned.",
  };
  constructor(private readonly base = "https://www.googleapis.com/youtube/v3") {}
  async fetchPostMetrics(input: Parameters<SocialAnalyticsAdapter["fetchPostMetrics"]>[0]) {
    const raw = await providerJson(
      `${this.base}/videos?part=statistics&id=${encodeURIComponent(input.providerPostId)}${input.cursor ? `&pageToken=${encodeURIComponent(input.cursor)}` : ""}`,
      input.accessToken,
    );
    const record =
      ((raw.items as Array<{ statistics?: Record<string, unknown> }> | undefined) ?? [])[0]
        ?.statistics ?? {};
    return {
      ...observations(this.provider, "POST", record),
      raw,
      cursor: raw.nextPageToken ? String(raw.nextPageToken) : undefined,
    };
  }
  async fetchAccountMetrics(input: Parameters<SocialAnalyticsAdapter["fetchAccountMetrics"]>[0]) {
    const raw = await providerJson(
      `${this.base}/channels?part=statistics&id=${encodeURIComponent(input.providerAccountId)}${input.cursor ? `&pageToken=${encodeURIComponent(input.cursor)}` : ""}`,
      input.accessToken,
    );
    const record =
      ((raw.items as Array<{ statistics?: Record<string, unknown> }> | undefined) ?? [])[0]
        ?.statistics ?? {};
    return {
      ...observations(this.provider, "ACCOUNT", record),
      raw,
      cursor: raw.nextPageToken ? String(raw.nextPageToken) : undefined,
    };
  }
  async discoverPosts(input: Parameters<NonNullable<SocialAnalyticsAdapter["discoverPosts"]>>[0]) {
    const raw = await providerJson(
      `${this.base}/search?part=snippet&type=video&order=date&maxResults=50&channelId=${encodeURIComponent(input.providerAccountId)}&publishedAfter=${input.from.toISOString()}&publishedBefore=${input.to.toISOString()}${input.cursor ? `&pageToken=${encodeURIComponent(input.cursor)}` : ""}`,
      input.accessToken,
    );
    const items =
      (raw.items as
        | Array<{ id?: { videoId?: string }; snippet?: { publishedAt?: string } }>
        | undefined) ?? [];
    const cursor = raw.nextPageToken ? String(raw.nextPageToken) : undefined;
    return {
      posts: items
        .filter((item) => Boolean(item.id?.videoId))
        .map((item) => ({
          providerPostId: String(item.id?.videoId),
          publishedAt: item.snippet?.publishedAt ? new Date(item.snippet.publishedAt) : undefined,
        })),
      cursor,
      hasMore: Boolean(cursor),
    };
  }
}

export class XAnalyticsAdapter implements SocialAnalyticsAdapter {
  readonly provider = "X" as const;
  readonly historicalBackfill = {
    supported: true,
    limitation:
      "X history is bounded by the access tier of the connected app; non-public and organic metrics require elevated entitlements.",
  };
  constructor(private readonly base = "https://api.x.com/2") {}
  async fetchPostMetrics(input: Parameters<SocialAnalyticsAdapter["fetchPostMetrics"]>[0]) {
    const raw = await providerJson(
      `${this.base}/tweets/${input.providerPostId}?tweet.fields=public_metrics,non_public_metrics,organic_metrics${input.cursor ? `&pagination_token=${encodeURIComponent(input.cursor)}` : ""}`,
      input.accessToken,
    );
    const data = (raw.data as Record<string, unknown> | undefined) ?? {};
    const record = {
      ...((data.public_metrics as Record<string, unknown> | undefined) ?? {}),
      ...((data.non_public_metrics as Record<string, unknown> | undefined) ?? {}),
      ...((data.organic_metrics as Record<string, unknown> | undefined) ?? {}),
    };
    const nextToken = (raw.meta as { next_token?: string } | undefined)?.next_token;
    return { ...observations(this.provider, "POST", record), raw, cursor: nextToken };
  }
  async fetchAccountMetrics(input: Parameters<SocialAnalyticsAdapter["fetchAccountMetrics"]>[0]) {
    const raw = await providerJson(
      `${this.base}/users/${input.providerAccountId}?user.fields=public_metrics`,
      input.accessToken,
    );
    const data =
      (raw.data as { public_metrics?: Record<string, unknown> } | undefined)?.public_metrics ?? {};
    return { ...observations(this.provider, "ACCOUNT", data), raw };
  }
  async discoverPosts(input: Parameters<NonNullable<SocialAnalyticsAdapter["discoverPosts"]>>[0]) {
    const raw = await providerJson(
      `${this.base}/users/${input.providerAccountId}/tweets?max_results=100&tweet.fields=created_at&start_time=${input.from.toISOString()}&end_time=${input.to.toISOString()}${input.cursor ? `&pagination_token=${encodeURIComponent(input.cursor)}` : ""}`,
      input.accessToken,
    );
    const rows = (raw.data as Array<Record<string, unknown>> | undefined) ?? [];
    const cursor = (raw.meta as { next_token?: string } | undefined)?.next_token;
    return {
      posts: rows
        .filter((row) => Boolean(row.id))
        .map((row) => ({
          providerPostId: String(row.id),
          publishedAt: row.created_at ? new Date(String(row.created_at)) : undefined,
        })),
      cursor,
      hasMore: Boolean(cursor),
    };
  }
}

const adapters: Record<SocialProvider, SocialAnalyticsAdapter> = {
  INSTAGRAM: new InstagramAnalyticsAdapter(),
  FACEBOOK: new FacebookAnalyticsAdapter(),
  LINKEDIN: new LinkedInAnalyticsAdapter(),
  TIKTOK: new TikTokAnalyticsAdapter(),
  YOUTUBE: new YouTubeAnalyticsAdapter(),
  X: new XAnalyticsAdapter(),
};

export function getSocialAnalyticsAdapter(provider: SocialProvider) {
  return adapters[provider];
}
