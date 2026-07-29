import type { GrowthInsightType } from "@prisma/client";
import { computeConfidence } from "@/lib/growth/confidence";
import {
  type BenchmarkResult,
  type PostSnapshot,
  collectMetricValues,
  deriveMetric,
  getBenchmarkValue,
  median,
} from "@/lib/growth/baselines";
import {
  CORRELATION_DISCLAIMER,
  HIGH_PERFORMER_LIFT,
  INSUFFICIENT_DATA_MESSAGE,
  LOW_ENGAGEMENT_DROP,
  MIN_BRAND_POSTS,
  MIN_CHANNEL_POSTS,
  MIN_SEGMENT_POSTS,
} from "@/lib/growth/constants";
import { clickThroughRate, publishingConsistency } from "@/lib/social/derived-metrics";

export type EvidenceRecord = {
  evidenceKey: string;
  evidenceLabel?: string;
  evidenceValue: Record<string, unknown>;
  contentItemId?: string | null;
  contentVariantId?: string | null;
  providerPostId?: string | null;
  sortOrder?: number;
};

export type DraftInsight = {
  insightType: GrowthInsightType;
  title: string;
  summary: string;
  dataStatus: "SUFFICIENT" | "INSUFFICIENT";
  confidenceLevel: "LOW" | "MEDIUM" | "HIGH";
  comparedPeriodStart: Date | null;
  comparedPeriodEnd: Date | null;
  minimumDataThreshold: Record<string, unknown>;
  sourceMetrics: Record<string, unknown>;
  supportingContentIds: string[];
  evidence: EvidenceRecord[];
};

export type AnalysisContext = {
  currentPosts: PostSnapshot[];
  previousPosts: PostSnapshot[];
  benchmarks: BenchmarkResult[];
  analysisPeriodStart: Date;
  analysisPeriodEnd: Date;
  comparedPeriodStart: Date | null;
  comparedPeriodEnd: Date | null;
  periodDays: number;
  followerGrowth: number | null;
  previousFollowerGrowth: number | null;
};

function insufficient(
  insightType: GrowthInsightType,
  title: string,
  threshold: Record<string, unknown>,
  ctx: AnalysisContext,
): DraftInsight {
  return {
    insightType,
    title,
    summary: INSUFFICIENT_DATA_MESSAGE,
    dataStatus: "INSUFFICIENT",
    confidenceLevel: "LOW",
    comparedPeriodStart: ctx.comparedPeriodStart,
    comparedPeriodEnd: ctx.comparedPeriodEnd,
    minimumDataThreshold: threshold,
    sourceMetrics: { postCount: ctx.currentPosts.length },
    supportingContentIds: [],
    evidence: [],
  };
}

function groupBy<T>(items: T[], keyFn: (item: T) => string | null | undefined): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    const key = keyFn(item);
    if (!key) return acc;
    (acc[key] ??= []).push(item);
    return acc;
  }, {});
}

function contentIds(posts: PostSnapshot[]): string[] {
  return [...new Set(posts.map((p) => p.contentItemId).filter((id): id is string => Boolean(id)))];
}

function avgEngagement(posts: PostSnapshot[]): number | null {
  const values = collectMetricValues(posts, "engagementRate");
  if (!values.length) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function generateInsights(ctx: AnalysisContext): DraftInsight[] {
  const insights: DraftInsight[] = [];
  const brandMedian = getBenchmarkValue(ctx.benchmarks, "BRAND_MEDIAN", "engagementRate");

  insights.push(analyzeHighPerformingTopic(ctx, brandMedian));
  insights.push(analyzeHighPerformingFormat(ctx, brandMedian));
  insights.push(analyzeLowEngagement(ctx, brandMedian));
  insights.push(analyzeStrongHook(ctx, brandMedian));
  insights.push(analyzeWeakCta(ctx));
  insights.push(analyzePostingGap(ctx));
  insights.push(analyzeBestPublishingWindow(ctx));
  insights.push(analyzeAudienceGrowth(ctx));
  insights.push(analyzeDecliningReach(ctx));
  insights.push(analyzeVideoRetentionDrop(ctx));
  insights.push(analyzeChannelOpportunity(ctx, brandMedian));
  insights.push(analyzeRepurposingOpportunity(ctx, brandMedian));

  return insights;
}

function analyzeHighPerformingTopic(
  ctx: AnalysisContext,
  brandMedian: number | null,
): DraftInsight {
  const threshold = { minBrandPosts: MIN_BRAND_POSTS, minSegmentPosts: MIN_SEGMENT_POSTS };
  if (ctx.currentPosts.length < MIN_BRAND_POSTS || brandMedian === null) {
    return insufficient("HIGH_PERFORMING_TOPIC", "High-performing topics", threshold, ctx);
  }

  const byPillar = groupBy(
    ctx.currentPosts.filter((p) => p.attribution?.contentPillar),
    (p) => p.attribution!.contentPillar,
  );

  let bestPillar: string | null = null;
  let bestAvg: number | null = null;
  let bestPosts: PostSnapshot[] = [];

  for (const [pillar, posts] of Object.entries(byPillar)) {
    if (posts.length < MIN_SEGMENT_POSTS) continue;
    const avg = avgEngagement(posts);
    if (avg !== null && avg >= brandMedian * HIGH_PERFORMER_LIFT) {
      if (bestAvg === null || avg > bestAvg) {
        bestPillar = pillar;
        bestAvg = avg;
        bestPosts = posts;
      }
    }
  }

  if (!bestPillar || bestAvg === null) {
    return insufficient("HIGH_PERFORMING_TOPIC", "High-performing topics", threshold, ctx);
  }

  return {
    insightType: "HIGH_PERFORMING_TOPIC",
    title: `Topic "${bestPillar}" outperforms brand median`,
    summary: `Content pillar "${bestPillar}" averages ${bestAvg.toFixed(2)}% engagement vs brand median ${brandMedian.toFixed(2)}% across ${bestPosts.length} posts.`,
    dataStatus: "SUFFICIENT",
    confidenceLevel: computeConfidence({
      sampleSize: ctx.currentPosts.length,
      segmentSampleSize: bestPosts.length,
      hasComparisonPeriod: Boolean(ctx.comparedPeriodStart),
      liftMagnitude: bestAvg / brandMedian,
    }),
    comparedPeriodStart: ctx.comparedPeriodStart,
    comparedPeriodEnd: ctx.comparedPeriodEnd,
    minimumDataThreshold: threshold,
    sourceMetrics: {
      pillar: bestPillar,
      segmentEngagementRate: bestAvg,
      brandMedianEngagementRate: brandMedian,
      postCount: bestPosts.length,
    },
    supportingContentIds: contentIds(bestPosts),
    evidence: [
      {
        evidenceKey: "engagementRate",
        evidenceLabel: `Pillar: ${bestPillar}`,
        evidenceValue: { value: bestAvg, benchmark: brandMedian, lift: bestAvg / brandMedian },
        sortOrder: 0,
      },
    ],
  };
}

function analyzeHighPerformingFormat(
  ctx: AnalysisContext,
  brandMedian: number | null,
): DraftInsight {
  const threshold = { minBrandPosts: MIN_BRAND_POSTS, minSegmentPosts: MIN_SEGMENT_POSTS };
  if (ctx.currentPosts.length < MIN_BRAND_POSTS || brandMedian === null) {
    return insufficient("HIGH_PERFORMING_FORMAT", "High-performing formats", threshold, ctx);
  }

  const byFormat = groupBy(
    ctx.currentPosts.filter((p) => p.attribution?.contentType),
    (p) => p.attribution!.contentType,
  );

  let bestFormat: string | null = null;
  let bestAvg: number | null = null;
  let bestPosts: PostSnapshot[] = [];

  for (const [format, posts] of Object.entries(byFormat)) {
    if (posts.length < MIN_SEGMENT_POSTS) continue;
    const avg = avgEngagement(posts);
    if (avg !== null && avg >= brandMedian * HIGH_PERFORMER_LIFT) {
      if (bestAvg === null || avg > bestAvg) {
        bestFormat = format;
        bestAvg = avg;
        bestPosts = posts;
      }
    }
  }

  if (!bestFormat || bestAvg === null) {
    return insufficient("HIGH_PERFORMING_FORMAT", "High-performing formats", threshold, ctx);
  }

  return {
    insightType: "HIGH_PERFORMING_FORMAT",
    title: `Format "${bestFormat}" drives stronger engagement`,
    summary: `${bestFormat} content averages ${bestAvg.toFixed(2)}% engagement vs brand median ${brandMedian.toFixed(2)}%.`,
    dataStatus: "SUFFICIENT",
    confidenceLevel: computeConfidence({
      sampleSize: ctx.currentPosts.length,
      segmentSampleSize: bestPosts.length,
      hasComparisonPeriod: Boolean(ctx.comparedPeriodStart),
      liftMagnitude: bestAvg / brandMedian,
    }),
    comparedPeriodStart: ctx.comparedPeriodStart,
    comparedPeriodEnd: ctx.comparedPeriodEnd,
    minimumDataThreshold: threshold,
    sourceMetrics: {
      format: bestFormat,
      segmentEngagementRate: bestAvg,
      brandMedianEngagementRate: brandMedian,
      postCount: bestPosts.length,
    },
    supportingContentIds: contentIds(bestPosts),
    evidence: [
      {
        evidenceKey: "engagementRate",
        evidenceLabel: `Format: ${bestFormat}`,
        evidenceValue: { value: bestAvg, benchmark: brandMedian },
        sortOrder: 0,
      },
    ],
  };
}

function analyzeLowEngagement(
  ctx: AnalysisContext,
  brandMedian: number | null,
): DraftInsight {
  const threshold = { minBrandPosts: MIN_BRAND_POSTS };
  if (ctx.currentPosts.length < MIN_BRAND_POSTS || brandMedian === null) {
    return insufficient("LOW_ENGAGEMENT", "Low engagement content", threshold, ctx);
  }

  const underperformers = ctx.currentPosts.filter((post) => {
    const rate = deriveMetric("engagementRate", post.values);
    return rate !== null && rate < brandMedian * LOW_ENGAGEMENT_DROP;
  });

  if (!underperformers.length) {
    return insufficient("LOW_ENGAGEMENT", "Low engagement content", threshold, ctx);
  }

  const avgRate =
    collectMetricValues(underperformers, "engagementRate").reduce((s, v) => s + v, 0) /
    underperformers.length;

  return {
    insightType: "LOW_ENGAGEMENT",
    title: `${underperformers.length} posts below engagement baseline`,
    summary: `${underperformers.length} posts average ${avgRate.toFixed(2)}% engagement, below the brand median of ${brandMedian.toFixed(2)}%.`,
    dataStatus: "SUFFICIENT",
    confidenceLevel: computeConfidence({
      sampleSize: ctx.currentPosts.length,
      segmentSampleSize: underperformers.length,
      hasComparisonPeriod: Boolean(ctx.comparedPeriodStart),
      liftMagnitude: avgRate / brandMedian,
    }),
    comparedPeriodStart: ctx.comparedPeriodStart,
    comparedPeriodEnd: ctx.comparedPeriodEnd,
    minimumDataThreshold: threshold,
    sourceMetrics: {
      underperformerCount: underperformers.length,
      avgEngagementRate: avgRate,
      brandMedianEngagementRate: brandMedian,
    },
    supportingContentIds: contentIds(underperformers),
    evidence: underperformers.slice(0, 5).map((post, index) => ({
      evidenceKey: "engagementRate",
      evidenceLabel: post.attribution?.contentPillar ?? post.providerPostId,
      evidenceValue: {
        engagementRate: deriveMetric("engagementRate", post.values),
        brandMedian,
      },
      contentItemId: post.contentItemId,
      providerPostId: post.providerPostId,
      sortOrder: index,
    })),
  };
}

function analyzeStrongHook(ctx: AnalysisContext, brandMedian: number | null): DraftInsight {
  const threshold = { minBrandPosts: MIN_BRAND_POSTS, minSegmentPosts: MIN_SEGMENT_POSTS };
  const withHook = ctx.currentPosts.filter((p) => p.attribution?.hook);
  if (withHook.length < MIN_SEGMENT_POSTS || brandMedian === null) {
    return insufficient("STRONG_HOOK", "Strong hook patterns", threshold, ctx);
  }

  const byHook = groupBy(withHook, (p) => p.attribution!.hook);
  let bestHook: string | null = null;
  let bestAvg: number | null = null;
  let bestPosts: PostSnapshot[] = [];

  for (const [hook, posts] of Object.entries(byHook)) {
    if (posts.length < 2) continue;
    const avg = avgEngagement(posts);
    if (avg !== null && avg >= brandMedian * HIGH_PERFORMER_LIFT) {
      if (bestAvg === null || avg > bestAvg) {
        bestHook = hook;
        bestAvg = avg;
        bestPosts = posts;
      }
    }
  }

  if (!bestHook || bestAvg === null) {
    return insufficient("STRONG_HOOK", "Strong hook patterns", threshold, ctx);
  }

  return {
    insightType: "STRONG_HOOK",
    title: "Hook style correlates with higher engagement",
    summary: `Posts using a "${bestHook!.slice(0, 60)}..." hook average ${bestAvg.toFixed(2)}% engagement. ${CORRELATION_DISCLAIMER}`,
    dataStatus: "SUFFICIENT",
    confidenceLevel: computeConfidence({
      sampleSize: ctx.currentPosts.length,
      segmentSampleSize: bestPosts.length,
      hasComparisonPeriod: Boolean(ctx.comparedPeriodStart),
      liftMagnitude: bestAvg / brandMedian,
    }),
    comparedPeriodStart: ctx.comparedPeriodStart,
    comparedPeriodEnd: ctx.comparedPeriodEnd,
    minimumDataThreshold: threshold,
    sourceMetrics: { hookPreview: bestHook!.slice(0, 100), segmentEngagementRate: bestAvg, brandMedian },
    supportingContentIds: contentIds(bestPosts),
    evidence: [
      {
        evidenceKey: "hookType",
        evidenceLabel: "Hook pattern",
        evidenceValue: { hook: bestHook, engagementRate: bestAvg, disclaimer: CORRELATION_DISCLAIMER },
        sortOrder: 0,
      },
    ],
  };
}

function analyzeWeakCta(ctx: AnalysisContext): DraftInsight {
  const threshold = { minBrandPosts: MIN_BRAND_POSTS, minPostsWithCta: MIN_SEGMENT_POSTS };
  const withCta = ctx.currentPosts.filter((p) => p.attribution?.primaryCTA);
  if (withCta.length < MIN_SEGMENT_POSTS) {
    return insufficient("WEAK_CTA", "Weak call-to-action performance", threshold, ctx);
  }

  const brandCtrValues = collectMetricValues(ctx.currentPosts, "clickThroughRate");
  const brandCtrMedian = median(brandCtrValues);
  if (brandCtrMedian === null) {
    return insufficient("WEAK_CTA", "Weak call-to-action performance", threshold, ctx);
  }

  const weakCtaPosts = withCta.filter((post) => {
    const ctr = clickThroughRate(post.values);
    return ctr !== null && ctr < brandCtrMedian * LOW_ENGAGEMENT_DROP;
  });

  if (!weakCtaPosts.length) {
    return insufficient("WEAK_CTA", "Weak call-to-action performance", threshold, ctx);
  }

  return {
    insightType: "WEAK_CTA",
    title: `${weakCtaPosts.length} posts with underperforming CTAs`,
    summary: `Posts with CTAs show click-through below the brand median. Consider revising CTA copy or placement.`,
    dataStatus: "SUFFICIENT",
    confidenceLevel: computeConfidence({
      sampleSize: ctx.currentPosts.length,
      segmentSampleSize: weakCtaPosts.length,
      hasComparisonPeriod: Boolean(ctx.comparedPeriodStart),
    }),
    comparedPeriodStart: ctx.comparedPeriodStart,
    comparedPeriodEnd: ctx.comparedPeriodEnd,
    minimumDataThreshold: threshold,
    sourceMetrics: {
      weakCtaCount: weakCtaPosts.length,
      brandMedianCtr: brandCtrMedian,
    },
    supportingContentIds: contentIds(weakCtaPosts),
    evidence: weakCtaPosts.slice(0, 5).map((post, index) => ({
      evidenceKey: "clickThroughRate",
      evidenceLabel: post.attribution?.primaryCTA ?? "CTA",
      evidenceValue: {
        ctr: clickThroughRate(post.values),
        brandMedianCtr: brandCtrMedian,
        cta: post.attribution?.primaryCTA,
      },
      contentItemId: post.contentItemId,
      providerPostId: post.providerPostId,
      sortOrder: index,
    })),
  };
}

function analyzePostingGap(ctx: AnalysisContext): DraftInsight {
  const threshold = { minBrandPosts: MIN_BRAND_POSTS, minPeriodDays: 7 };
  if (ctx.currentPosts.length < MIN_BRAND_POSTS || ctx.periodDays < 7) {
    return insufficient("POSTING_GAP", "Posting consistency gaps", threshold, ctx);
  }

  const consistency = publishingConsistency(ctx.currentPosts.length, ctx.periodDays);
  const prevConsistency =
    ctx.previousPosts.length && ctx.comparedPeriodStart
      ? publishingConsistency(
          ctx.previousPosts.length,
          Math.max(
            1,
            Math.round(
              (ctx.analysisPeriodEnd.getTime() - (ctx.comparedPeriodStart?.getTime() ?? 0)) /
                86_400_000,
            ),
          ),
        )
      : null;

  if (consistency === null) {
    return insufficient("POSTING_GAP", "Posting consistency gaps", threshold, ctx);
  }

  const belowPrevious =
    prevConsistency !== null && consistency < prevConsistency * LOW_ENGAGEMENT_DROP;

  if (!belowPrevious && consistency >= 0.3) {
    return insufficient("POSTING_GAP", "Posting consistency gaps", threshold, ctx);
  }

  return {
    insightType: "POSTING_GAP",
    title: "Posting consistency below prior period",
    summary: `Publishing ${consistency.toFixed(2)} posts/day vs ${prevConsistency?.toFixed(2) ?? "N/A"} previously. Increasing consistency may improve reach.`,
    dataStatus: "SUFFICIENT",
    confidenceLevel: computeConfidence({
      sampleSize: ctx.currentPosts.length,
      hasComparisonPeriod: prevConsistency !== null,
      liftMagnitude: prevConsistency ? consistency / prevConsistency : undefined,
    }),
    comparedPeriodStart: ctx.comparedPeriodStart,
    comparedPeriodEnd: ctx.comparedPeriodEnd,
    minimumDataThreshold: threshold,
    sourceMetrics: {
      postsPerDay: consistency,
      previousPostsPerDay: prevConsistency,
      postCount: ctx.currentPosts.length,
      periodDays: ctx.periodDays,
    },
    supportingContentIds: [],
    evidence: [
      {
        evidenceKey: "publishingConsistency",
        evidenceValue: { current: consistency, previous: prevConsistency },
        sortOrder: 0,
      },
    ],
  };
}

function analyzeBestPublishingWindow(ctx: AnalysisContext): DraftInsight {
  const threshold = { minBrandPosts: MIN_BRAND_POSTS, minHourBucketPosts: MIN_SEGMENT_POSTS };
  const dated = ctx.currentPosts.filter((p) => p.publishedAt);
  if (dated.length < MIN_BRAND_POSTS) {
    return insufficient("BEST_PUBLISHING_WINDOW", "Best publishing window", threshold, ctx);
  }

  const byHour = groupBy(dated, (p) => String(p.publishedAt!.getUTCHours()));
  let bestHour: string | null = null;
  let bestAvg: number | null = null;
  let bestPosts: PostSnapshot[] = [];

  for (const [hour, posts] of Object.entries(byHour)) {
    if (posts.length < MIN_SEGMENT_POSTS) continue;
    const avg = avgEngagement(posts);
    if (avg !== null && (bestAvg === null || avg > bestAvg)) {
      bestHour = hour;
      bestAvg = avg;
      bestPosts = posts;
    }
  }

  if (bestHour === null || bestAvg === null) {
    return insufficient("BEST_PUBLISHING_WINDOW", "Best publishing window", threshold, ctx);
  }

  return {
    insightType: "BEST_PUBLISHING_WINDOW",
    title: `Hour ${bestHour}:00 UTC correlates with higher engagement`,
    summary: `Posts published around ${bestHour}:00 UTC average ${bestAvg.toFixed(2)}% engagement across ${bestPosts.length} posts. ${CORRELATION_DISCLAIMER}`,
    dataStatus: "SUFFICIENT",
    confidenceLevel: computeConfidence({
      sampleSize: ctx.currentPosts.length,
      segmentSampleSize: bestPosts.length,
      hasComparisonPeriod: Boolean(ctx.comparedPeriodStart),
    }),
    comparedPeriodStart: ctx.comparedPeriodStart,
    comparedPeriodEnd: ctx.comparedPeriodEnd,
    minimumDataThreshold: threshold,
    sourceMetrics: { hourUtc: Number(bestHour), segmentEngagementRate: bestAvg },
    supportingContentIds: contentIds(bestPosts),
    evidence: [
      {
        evidenceKey: "hour",
        evidenceLabel: `${bestHour}:00 UTC`,
        evidenceValue: { hour: bestHour, engagementRate: bestAvg, disclaimer: CORRELATION_DISCLAIMER },
        sortOrder: 0,
      },
    ],
  };
}

function analyzeAudienceGrowth(ctx: AnalysisContext): DraftInsight {
  const threshold = { requiresFollowerData: true };
  if (ctx.followerGrowth === null) {
    return insufficient("AUDIENCE_GROWTH", "Audience growth", threshold, ctx);
  }

  const growing = ctx.followerGrowth > 0;
  const accelerating =
    ctx.previousFollowerGrowth !== null && ctx.followerGrowth > ctx.previousFollowerGrowth;

  if (!growing) {
    return insufficient("AUDIENCE_GROWTH", "Audience growth", threshold, ctx);
  }

  return {
    insightType: "AUDIENCE_GROWTH",
    title: "Audience is growing",
    summary: `Net follower/subscriber growth of ${ctx.followerGrowth} in the analysis period${accelerating ? ", accelerating vs prior period" : ""}.`,
    dataStatus: "SUFFICIENT",
    confidenceLevel: computeConfidence({
      sampleSize: ctx.currentPosts.length,
      hasComparisonPeriod: ctx.previousFollowerGrowth !== null,
      liftMagnitude:
        ctx.previousFollowerGrowth && ctx.previousFollowerGrowth > 0
          ? ctx.followerGrowth / ctx.previousFollowerGrowth
          : undefined,
    }),
    comparedPeriodStart: ctx.comparedPeriodStart,
    comparedPeriodEnd: ctx.comparedPeriodEnd,
    minimumDataThreshold: threshold,
    sourceMetrics: {
      followerGrowth: ctx.followerGrowth,
      previousFollowerGrowth: ctx.previousFollowerGrowth,
    },
    supportingContentIds: [],
    evidence: [
      {
        evidenceKey: "followerGrowth",
        evidenceValue: {
          current: ctx.followerGrowth,
          previous: ctx.previousFollowerGrowth,
        },
        sortOrder: 0,
      },
    ],
  };
}

function analyzeDecliningReach(ctx: AnalysisContext): DraftInsight {
  const threshold = { minBrandPosts: MIN_BRAND_POSTS };
  if (ctx.currentPosts.length < MIN_BRAND_POSTS || !ctx.comparedPeriodStart) {
    return insufficient("DECLINING_REACH", "Declining reach", threshold, ctx);
  }

  const currentReach = ctx.currentPosts.reduce((sum, p) => sum + (p.values.reach ?? 0), 0);
  const previousReach = ctx.previousPosts.reduce((sum, p) => sum + (p.values.reach ?? 0), 0);

  if (!previousReach || currentReach >= previousReach * LOW_ENGAGEMENT_DROP) {
    return insufficient("DECLINING_REACH", "Declining reach", threshold, ctx);
  }

  const dropPct = ((previousReach - currentReach) / previousReach) * 100;

  return {
    insightType: "DECLINING_REACH",
    title: "Reach declined vs previous period",
    summary: `Total reach fell ${dropPct.toFixed(1)}% compared to the prior period (${currentReach} vs ${previousReach}).`,
    dataStatus: "SUFFICIENT",
    confidenceLevel: computeConfidence({
      sampleSize: ctx.currentPosts.length,
      hasComparisonPeriod: true,
      liftMagnitude: currentReach / previousReach,
    }),
    comparedPeriodStart: ctx.comparedPeriodStart,
    comparedPeriodEnd: ctx.comparedPeriodEnd,
    minimumDataThreshold: threshold,
    sourceMetrics: { currentReach, previousReach, dropPercent: dropPct },
    supportingContentIds: [],
    evidence: [
      {
        evidenceKey: "reach",
        evidenceValue: { current: currentReach, previous: previousReach },
        sortOrder: 0,
      },
    ],
  };
}

function analyzeVideoRetentionDrop(ctx: AnalysisContext): DraftInsight {
  const threshold = { minVideoPosts: MIN_SEGMENT_POSTS };
  const videoPosts = ctx.currentPosts.filter(
    (p) => p.values.videoViews !== undefined || p.attribution?.durationSeconds,
  );
  if (videoPosts.length < MIN_SEGMENT_POSTS) {
    return insufficient("VIDEO_RETENTION_DROP", "Video retention drop", threshold, ctx);
  }

  const lowRetention = videoPosts.filter((post) => {
    const completion =
      post.values.completedViews !== undefined && post.values.videoViews
        ? (post.values.completedViews / post.values.videoViews) * 100
        : null;
    return completion !== null && completion < 30;
  });

  if (!lowRetention.length) {
    return insufficient("VIDEO_RETENTION_DROP", "Video retention drop", threshold, ctx);
  }

  return {
    insightType: "VIDEO_RETENTION_DROP",
    title: `${lowRetention.length} videos show low completion rates`,
    summary: `${lowRetention.length} videos complete below 30%. Consider shortening introductions or strengthening opening hooks.`,
    dataStatus: "SUFFICIENT",
    confidenceLevel: computeConfidence({
      sampleSize: videoPosts.length,
      segmentSampleSize: lowRetention.length,
      hasComparisonPeriod: Boolean(ctx.comparedPeriodStart),
    }),
    comparedPeriodStart: ctx.comparedPeriodStart,
    comparedPeriodEnd: ctx.comparedPeriodEnd,
    minimumDataThreshold: threshold,
    sourceMetrics: { lowRetentionCount: lowRetention.length, videoPostCount: videoPosts.length },
    supportingContentIds: contentIds(lowRetention),
    evidence: lowRetention.slice(0, 5).map((post, index) => ({
      evidenceKey: "videoCompletionRate",
      evidenceValue: {
        completedViews: post.values.completedViews,
        videoViews: post.values.videoViews,
        durationSeconds: post.attribution?.durationSeconds,
      },
      contentItemId: post.contentItemId,
      providerPostId: post.providerPostId,
      sortOrder: index,
    })),
  };
}

function analyzeChannelOpportunity(
  ctx: AnalysisContext,
  brandMedian: number | null,
): DraftInsight {
  const threshold = { minChannelPosts: MIN_CHANNEL_POSTS };
  if (brandMedian === null) {
    return insufficient("CHANNEL_OPPORTUNITY", "Channel opportunity", threshold, ctx);
  }

  const byProvider = groupBy(ctx.currentPosts, (p) => p.provider);
  let bestChannel: string | null = null;
  let bestAvg: number | null = null;
  let bestPosts: PostSnapshot[] = [];

  for (const [provider, posts] of Object.entries(byProvider)) {
    if (posts.length < MIN_CHANNEL_POSTS) continue;
    const avg = avgEngagement(posts);
    if (avg !== null && avg >= brandMedian * HIGH_PERFORMER_LIFT && posts.length < ctx.currentPosts.length * 0.4) {
      if (bestAvg === null || avg > bestAvg) {
        bestChannel = provider;
        bestAvg = avg;
        bestPosts = posts;
      }
    }
  }

  if (!bestChannel || bestAvg === null) {
    return insufficient("CHANNEL_OPPORTUNITY", "Channel opportunity", threshold, ctx);
  }

  return {
    insightType: "CHANNEL_OPPORTUNITY",
    title: `${bestChannel} shows high engagement with low volume`,
    summary: `${bestChannel} averages ${bestAvg.toFixed(2)}% engagement across only ${bestPosts.length} posts. Increasing volume on this channel may capture more reach.`,
    dataStatus: "SUFFICIENT",
    confidenceLevel: computeConfidence({
      sampleSize: ctx.currentPosts.length,
      segmentSampleSize: bestPosts.length,
      hasComparisonPeriod: Boolean(ctx.comparedPeriodStart),
      liftMagnitude: bestAvg / brandMedian,
    }),
    comparedPeriodStart: ctx.comparedPeriodStart,
    comparedPeriodEnd: ctx.comparedPeriodEnd,
    minimumDataThreshold: threshold,
    sourceMetrics: {
      provider: bestChannel,
      segmentEngagementRate: bestAvg,
      postCount: bestPosts.length,
    },
    supportingContentIds: contentIds(bestPosts),
    evidence: [
      {
        evidenceKey: "platform",
        evidenceLabel: bestChannel,
        evidenceValue: { engagementRate: bestAvg, postCount: bestPosts.length },
        sortOrder: 0,
      },
    ],
  };
}

function analyzeRepurposingOpportunity(
  ctx: AnalysisContext,
  brandMedian: number | null,
): DraftInsight {
  const threshold = { minBrandPosts: MIN_BRAND_POSTS };
  if (ctx.currentPosts.length < MIN_BRAND_POSTS || brandMedian === null) {
    return insufficient("REPURPOSING_OPPORTUNITY", "Repurposing opportunity", threshold, ctx);
  }

  const byContent = groupBy(
    ctx.currentPosts.filter((p) => p.contentItemId),
    (p) => p.contentItemId,
  );

  for (const [contentId, posts] of Object.entries(byContent)) {
    const providers = new Set(posts.map((p) => p.provider));
    if (providers.size !== 1) continue;
    const avg = avgEngagement(posts);
    if (avg !== null && avg >= brandMedian * HIGH_PERFORMER_LIFT) {
      const sourceProvider = posts[0]!.provider;
      return {
        insightType: "REPURPOSING_OPPORTUNITY",
        title: "Strong content suitable for repurposing",
        summary: `Content performs well on ${sourceProvider} (${avg.toFixed(2)}% engagement) but is not published on other channels.`,
        dataStatus: "SUFFICIENT",
        confidenceLevel: computeConfidence({
          sampleSize: ctx.currentPosts.length,
          segmentSampleSize: posts.length,
          hasComparisonPeriod: Boolean(ctx.comparedPeriodStart),
          liftMagnitude: avg / brandMedian,
        }),
        comparedPeriodStart: ctx.comparedPeriodStart,
        comparedPeriodEnd: ctx.comparedPeriodEnd,
        minimumDataThreshold: threshold,
        sourceMetrics: {
          contentItemId: contentId,
          sourceProvider,
          engagementRate: avg,
        },
        supportingContentIds: [contentId],
        evidence: [
          {
            evidenceKey: "repurposing",
            evidenceLabel: sourceProvider,
            evidenceValue: { contentItemId: contentId, engagementRate: avg, providers: [...providers] },
            contentItemId: contentId,
            sortOrder: 0,
          },
        ],
      };
    }
  }

  return insufficient("REPURPOSING_OPPORTUNITY", "Repurposing opportunity", threshold, ctx);
}

export function insightToRecommendation(draft: DraftInsight): {
  title: string;
  description: string;
  recommendedAction: string;
} | null {
  if (draft.dataStatus !== "SUFFICIENT") return null;

  const actions: Partial<Record<GrowthInsightType, string>> = {
    HIGH_PERFORMING_TOPIC: "Create another post on this proven topic or content pillar.",
    HIGH_PERFORMING_FORMAT: "Produce more content in this high-performing format.",
    LOW_ENGAGEMENT: "Review underperforming posts and test new hooks or visuals.",
    STRONG_HOOK: "Reuse this hook style in upcoming content.",
    WEAK_CTA: "Improve the CTA on low-click content and A/B test alternatives.",
    POSTING_GAP: "Increase posting consistency to match or exceed the prior period.",
    BEST_PUBLISHING_WINDOW: "Test publishing more content in this time window.",
    AUDIENCE_GROWTH: "Double down on content themes from this growth period.",
    DECLINING_REACH: "Refresh content strategy and test new formats to recover reach.",
    VIDEO_RETENTION_DROP: "Reduce video introduction length and strengthen opening hooks.",
    CHANNEL_OPPORTUNITY: "Increase posting volume on this high-engagement channel.",
    REPURPOSING_OPPORTUNITY: "Repurpose this strong post for additional platforms.",
  };

  return {
    title: draft.title,
    description: draft.summary,
    recommendedAction: actions[draft.insightType] ?? "Review insight evidence and plan next steps.",
  };
}
