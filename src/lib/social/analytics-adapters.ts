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

export class InstagramAnalyticsAdapter implements SocialAnalyticsAdapter {
  readonly provider = "INSTAGRAM" as const;
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
}

export class FacebookAnalyticsAdapter implements SocialAnalyticsAdapter {
  readonly provider = "FACEBOOK" as const;
  constructor(private readonly base = "https://graph.facebook.com/v22.0") {}
  async fetchPostMetrics(input: Parameters<SocialAnalyticsAdapter["fetchPostMetrics"]>[0]) {
    const raw = await providerJson(
      `${this.base}/${input.providerPostId}/insights?metric=post_impressions,post_impressions_unique,post_clicks,post_reactions_by_type_total,post_video_views`,
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
      `${this.base}/${input.providerAccountId}/insights?metric=page_follows,page_impressions_unique&period=day`,
      input.accessToken,
    );
    return {
      ...observations(this.provider, "ACCOUNT", metaRecord(raw), new Date(), "DAY"),
      raw,
      cursor: pagingCursor(raw),
    };
  }
}

export class LinkedInAnalyticsAdapter implements SocialAnalyticsAdapter {
  readonly provider = "LINKEDIN" as const;
  constructor(private readonly base = "https://api.linkedin.com/rest") {}
  async fetchPostMetrics(input: Parameters<SocialAnalyticsAdapter["fetchPostMetrics"]>[0]) {
    const raw = await providerJson(
      `${this.base}/socialActions/${encodeURIComponent(input.providerPostId)}`,
      input.accessToken,
      { headers: { "Linkedin-Version": "202607", "X-Restli-Protocol-Version": "2.0.0" } },
    );
    const record = {
      likeCount: (raw.likesSummary as { totalLikes?: number } | undefined)?.totalLikes,
      commentCount: (raw.commentsSummary as { totalFirstLevelComments?: number } | undefined)
        ?.totalFirstLevelComments,
      ...(raw as Record<string, unknown>),
    };
    return { ...observations(this.provider, "POST", record), raw };
  }
  async fetchAccountMetrics(input: Parameters<SocialAnalyticsAdapter["fetchAccountMetrics"]>[0]) {
    const raw = await providerJson(
      `${this.base}/networkSizes/${encodeURIComponent(`urn:li:organization:${input.providerAccountId}`)}?edgeType=CompanyFollowedByMember`,
      input.accessToken,
      { headers: { "Linkedin-Version": "202607", "X-Restli-Protocol-Version": "2.0.0" } },
    );
    return {
      ...observations(this.provider, "ACCOUNT", { followerCount: raw.firstDegreeSize }),
      raw,
    };
  }
}

export class TikTokAnalyticsAdapter implements SocialAnalyticsAdapter {
  readonly provider = "TIKTOK" as const;
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
}

export class YouTubeAnalyticsAdapter implements SocialAnalyticsAdapter {
  readonly provider = "YOUTUBE" as const;
  constructor(private readonly base = "https://www.googleapis.com/youtube/v3") {}
  async fetchPostMetrics(input: Parameters<SocialAnalyticsAdapter["fetchPostMetrics"]>[0]) {
    const raw = await providerJson(
      `${this.base}/videos?part=statistics&id=${encodeURIComponent(input.providerPostId)}`,
      input.accessToken,
    );
    const record =
      ((raw.items as Array<{ statistics?: Record<string, unknown> }> | undefined) ?? [])[0]
        ?.statistics ?? {};
    return { ...observations(this.provider, "POST", record), raw };
  }
  async fetchAccountMetrics(input: Parameters<SocialAnalyticsAdapter["fetchAccountMetrics"]>[0]) {
    const raw = await providerJson(
      `${this.base}/channels?part=statistics&id=${encodeURIComponent(input.providerAccountId)}`,
      input.accessToken,
    );
    const record =
      ((raw.items as Array<{ statistics?: Record<string, unknown> }> | undefined) ?? [])[0]
        ?.statistics ?? {};
    return { ...observations(this.provider, "ACCOUNT", record), raw };
  }
}

export class XAnalyticsAdapter implements SocialAnalyticsAdapter {
  readonly provider = "X" as const;
  constructor(private readonly base = "https://api.x.com/2") {}
  async fetchPostMetrics(input: Parameters<SocialAnalyticsAdapter["fetchPostMetrics"]>[0]) {
    const raw = await providerJson(
      `${this.base}/tweets/${input.providerPostId}?tweet.fields=public_metrics,non_public_metrics,organic_metrics`,
      input.accessToken,
    );
    const data = (raw.data as Record<string, unknown> | undefined) ?? {};
    const record = {
      ...((data.public_metrics as Record<string, unknown> | undefined) ?? {}),
      ...((data.non_public_metrics as Record<string, unknown> | undefined) ?? {}),
      ...((data.organic_metrics as Record<string, unknown> | undefined) ?? {}),
    };
    return { ...observations(this.provider, "POST", record), raw };
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
