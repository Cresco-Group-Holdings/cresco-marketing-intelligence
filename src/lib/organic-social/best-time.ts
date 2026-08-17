import type { PostingWindowInsight } from "@/lib/organic-social/types";

const MIN_SAMPLE_SIZE = 8;

type PostObservation = {
  publishedAt: Date;
  engagement: number;
  impressions: number;
  channel: string;
  format: string;
};

export function calculateBestPostingWindows(
  posts: PostObservation[],
  baselineEngagementRate: number | null,
): PostingWindowInsight[] {
  if (posts.length < MIN_SAMPLE_SIZE || baselineEngagementRate == null || baselineEngagementRate <= 0) {
    return [];
  }

  const buckets = new Map<
    string,
    { channel: string; format: string; day: number; hour: number; engagements: number[]; impressions: number[] }
  >();

  for (const post of posts) {
    const day = post.publishedAt.getDay();
    const hour = post.publishedAt.getHours();
    const key = `${post.channel}|${post.format}|${day}|${hour}`;
    const bucket = buckets.get(key) ?? {
      channel: post.channel,
      format: post.format,
      day,
      hour,
      engagements: [],
      impressions: [],
    };
    bucket.engagements.push(post.engagement);
    bucket.impressions.push(post.impressions);
    buckets.set(key, bucket);
  }

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const insights: PostingWindowInsight[] = [];

  for (const bucket of buckets.values()) {
    if (bucket.engagements.length < 5) continue;

    const totalEngagement = bucket.engagements.reduce((sum, value) => sum + value, 0);
    const totalImpressions = bucket.impressions.reduce((sum, value) => sum + value, 0);
    if (totalImpressions <= 0) continue;

    const windowRate = (totalEngagement / totalImpressions) * 100;
    const lift = ((windowRate - baselineEngagementRate) / baselineEngagementRate) * 100;
    if (lift < 15) continue;

    insights.push({
      channel: bucket.channel,
      format: bucket.format,
      dayOfWeek: dayNames[bucket.day] ?? "Unknown",
      hourRange: `${String(bucket.hour).padStart(2, "0")}:00–${String(bucket.hour + 1).padStart(2, "0")}:00`,
      engagementLift: lift,
      sampleSize: bucket.engagements.length,
    });
  }

  return insights.sort((a, b) => b.engagementLift - a.engagementLift).slice(0, 3);
}

export { MIN_SAMPLE_SIZE };
