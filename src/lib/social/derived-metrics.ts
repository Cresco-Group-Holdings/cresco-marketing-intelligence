export type MetricValues = Partial<Record<string, number>>;

const ratio = (numerator: number | undefined, denominator: number | undefined) =>
  numerator === undefined || denominator === undefined || denominator <= 0
    ? null
    : (numerator / denominator) * 100;

/** (likes + reactions + comments + shares + saves) / impressions × 100. */
export function engagementRate(values: MetricValues) {
  const interactions = ["likes", "reactions", "comments", "shares", "saves"]
    .map((key) => values[key])
    .filter((value): value is number => value !== undefined)
    .reduce((sum, value) => sum + value, 0);
  const hasInteraction = ["likes", "reactions", "comments", "shares", "saves"].some(
    (key) => values[key] !== undefined,
  );
  return hasInteraction ? ratio(interactions, values.impressions) : null;
}

/** clicks / impressions × 100. */
export const clickThroughRate = (values: MetricValues) => ratio(values.clicks, values.impressions);

/** Latest follower/subscriber count minus the earliest compatible count. */
export function followerGrowth(earliest: number | undefined, latest: number | undefined) {
  return earliest === undefined || latest === undefined ? null : latest - earliest;
}

/** Sum of views divided by the number of posts that actually expose views. */
export function averageViewsPerPost(viewValues: Array<number | undefined>) {
  const available = viewValues.filter((value): value is number => value !== undefined);
  return available.length
    ? available.reduce((sum, value) => sum + value, 0) / available.length
    : null;
}

/** Posts published per whole day in the selected period. */
export function publishingConsistency(postCount: number, periodDays: number) {
  return periodDays > 0 ? postCount / periodDays : null;
}

/** Provider completion observations / views × 100 when both are compatible counts. */
export const videoCompletionRate = (completedViews?: number, videoViews?: number) =>
  ratio(completedViews, videoViews);
