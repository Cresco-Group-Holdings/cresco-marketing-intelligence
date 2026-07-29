# Unified social analytics

Only observations returned by official provider APIs are persisted. Missing metrics remain unavailable and are never written as zero or substituted with a semantically different metric.

## Deterministic formulas

- Engagement rate: `(likes + reactions + comments + shares + saves) / impressions × 100`, only when impressions and at least one interaction metric exist.
- Click-through rate: `clicks / impressions × 100`, only when both fields exist and impressions are positive.
- Follower growth: latest compatible follower/subscriber count minus the earliest count in the range. Followers and subscribers are not combined.
- Average views per post: sum of available post view observations divided by posts that expose views.
- Publishing consistency: completed publishing occurrences divided by whole days in the selected range.
- Video completion rate: completed-view count divided by compatible video-view count. It is omitted when the provider supplies only an average-view percentage.
- Cost per result is intentionally unavailable until real spend and compatible result observations are integrated.

Provider source fields, units, cumulative/periodic behavior, scope, aggregation rules, and limitations are defined in `src/lib/social/metric-registry.ts` and mirrored into `SocialMetricDefinition`.
