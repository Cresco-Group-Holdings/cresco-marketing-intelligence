import type { SocialProvider } from "@prisma/client";

export type CanonicalMetric =
  | "impressions"
  | "reach"
  | "views"
  | "videoViews"
  | "watchTime"
  | "averageWatchTime"
  | "completionRate"
  | "likes"
  | "reactions"
  | "comments"
  | "shares"
  | "saves"
  | "clicks"
  | "profileVisits"
  | "follows"
  | "unfollows"
  | "subscribers"
  | "engagementRate";

export type MetricDefinition = {
  canonicalName: CanonicalMetric;
  provider: SocialProvider;
  providerSourceField: string;
  unit: "count" | "seconds" | "percentage";
  aggregationRule: "sum" | "latest" | "weighted_average";
  cumulative: boolean;
  scope: "POST" | "ACCOUNT";
  limitations: string;
};

const definitions = (
  provider: SocialProvider,
  scope: "POST" | "ACCOUNT",
  mappings: Array<[CanonicalMetric, string, MetricDefinition["unit"], boolean, string]>,
): MetricDefinition[] =>
  mappings.map(([canonicalName, providerSourceField, unit, cumulative, limitations]) => ({
    canonicalName,
    provider,
    providerSourceField,
    unit,
    cumulative,
    scope,
    aggregationRule: unit === "percentage" ? "weighted_average" : cumulative ? "latest" : "sum",
    limitations,
  }));

export const SOCIAL_METRIC_REGISTRY: MetricDefinition[] = [
  ...definitions("INSTAGRAM", "POST", [
    [
      "impressions",
      "impressions",
      "count",
      true,
      "Availability varies by media type and API version.",
    ],
    [
      "reach",
      "reach",
      "count",
      true,
      "Unique-account estimate; never interchangeable with impressions.",
    ],
    ["views", "views", "count", true, "Provider-defined views; not unique viewers."],
    ["likes", "likes", "count", true, "Like count returned for the media."],
    ["comments", "comments", "count", true, "Comment count returned for the media."],
    ["shares", "shares", "count", true, "Only stored when returned by Insights."],
    ["saves", "saved", "count", true, "Only available for eligible media."],
  ]),
  ...definitions("FACEBOOK", "POST", [
    ["impressions", "post_impressions", "count", true, "Page post impressions."],
    ["reach", "post_impressions_unique", "count", true, "Unique reach estimate."],
    ["clicks", "post_clicks", "count", true, "All provider-defined post clicks."],
    [
      "reactions",
      "post_reactions_by_type_total",
      "count",
      true,
      "All reactions; not treated as likes.",
    ],
    ["videoViews", "post_video_views", "count", true, "Video posts only."],
  ]),
  ...definitions("LINKEDIN", "POST", [
    [
      "impressions",
      "impressionCount",
      "count",
      true,
      "Organisation analytics availability depends on role and product access.",
    ],
    ["likes", "likeCount", "count", true, "LinkedIn social action likes."],
    ["comments", "commentCount", "count", true, "LinkedIn social action comments."],
    ["shares", "shareCount", "count", true, "Only returned for eligible organisation analytics."],
    ["clicks", "clickCount", "count", true, "Organisation share statistics only."],
  ]),
  ...definitions("TIKTOK", "POST", [
    ["views", "view_count", "count", true, "Not unique viewers."],
    ["likes", "like_count", "count", true, "Public video metric."],
    ["comments", "comment_count", "count", true, "Public video metric."],
    ["shares", "share_count", "count", true, "Public video metric."],
  ]),
  ...definitions("YOUTUBE", "POST", [
    ["views", "viewCount", "count", true, "Video statistics views; not unique viewers."],
    ["likes", "likeCount", "count", true, "May be unavailable where ratings are disabled."],
    ["comments", "commentCount", "count", true, "May be unavailable where comments are disabled."],
    [
      "watchTime",
      "estimatedMinutesWatched",
      "seconds",
      false,
      "Analytics API minutes converted to seconds.",
    ],
    ["averageWatchTime", "averageViewDuration", "seconds", false, "Analytics API only."],
    [
      "completionRate",
      "averageViewPercentage",
      "percentage",
      false,
      "Average percentage viewed, not a count of completed views.",
    ],
  ]),
  ...definitions("X", "POST", [
    [
      "impressions",
      "impression_count",
      "count",
      true,
      "Requires the appropriate X API entitlement.",
    ],
    ["likes", "like_count", "count", true, "Public metric."],
    ["comments", "reply_count", "count", true, "Replies are canonical comments."],
    [
      "shares",
      "retweet_count",
      "count",
      true,
      "Retweets only; quote posts remain provider metadata.",
    ],
    [
      "clicks",
      "url_link_clicks",
      "count",
      true,
      "Non-public/organic metrics entitlement required.",
    ],
  ]),
  ...definitions("INSTAGRAM", "ACCOUNT", [
    ["follows", "follower_count", "count", true, "Current follower count snapshot."],
    ["profileVisits", "profile_views", "count", false, "Periodic account insight."],
  ]),
  ...definitions("FACEBOOK", "ACCOUNT", [
    ["follows", "page_follows", "count", true, "Current Page followers."],
    ["reach", "page_impressions_unique", "count", false, "Periodic Page reach estimate."],
  ]),
  ...definitions("LINKEDIN", "ACCOUNT", [
    ["follows", "followerCount", "count", true, "Organisation follower count."],
  ]),
  ...definitions("TIKTOK", "ACCOUNT", [
    ["follows", "follower_count", "count", true, "Creator follower count."],
    ["profileVisits", "profile_view_count", "count", false, "Only where returned."],
  ]),
  ...definitions("YOUTUBE", "ACCOUNT", [
    [
      "subscribers",
      "subscriberCount",
      "count",
      true,
      "Subscribers are not normalised as followers.",
    ],
    ["views", "viewCount", "count", true, "Channel cumulative views."],
  ]),
  ...definitions("X", "ACCOUNT", [
    ["follows", "followers_count", "count", true, "Current X followers."],
  ]),
];

export function definitionsFor(provider: SocialProvider, scope: "POST" | "ACCOUNT") {
  return SOCIAL_METRIC_REGISTRY.filter(
    (definition) => definition.provider === provider && definition.scope === scope,
  );
}

export function normaliseMetricRecord(
  provider: SocialProvider,
  scope: "POST" | "ACCOUNT",
  record: Record<string, unknown>,
) {
  return definitionsFor(provider, scope).flatMap((definition) => {
    const raw = record[definition.providerSourceField];
    const value =
      typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() ? Number(raw) : NaN;
    if (!Number.isFinite(value)) return [];
    return [
      {
        metricType: definition.canonicalName,
        metricValue: value,
        sourceField: definition.providerSourceField,
      },
    ];
  });
}
