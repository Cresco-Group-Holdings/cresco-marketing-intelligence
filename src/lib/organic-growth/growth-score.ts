import type { OrganicGrowthScore, OrganicGrowthScoreDimension } from "@/lib/organic-growth/types";

export type OrganicGrowthScoreInput = {
  publishingConsistencyScore: number | null;
  engagementRate: number | null;
  previousEngagementRate: number | null;
  followerGrowthRate: number | null;
  formatDiversityCount: number;
  formatCount: number;
  connectedChannelCount: number;
  totalChannelSlots: number;
  conversionContribution: number | null;
  communityEngagementScore: number | null;
  experimentCount: number;
  scheduledUpcoming: number;
  daysWithoutScheduled: number | null;
};

function clampScore(value: number, max: number): number {
  return Math.max(0, Math.min(max, Math.round(value)));
}

function unavailableDimension(
  key: string,
  label: string,
  maxScore: number,
  reason: string,
): OrganicGrowthScoreDimension {
  return {
    key,
    label,
    score: 0,
    maxScore,
    explanation: reason,
    unavailable: true,
  };
}

export function calculateOrganicGrowthScore(input: OrganicGrowthScoreInput): OrganicGrowthScore {
  const dimensions: OrganicGrowthScoreDimension[] = [];

  if (input.publishingConsistencyScore != null) {
    const max = 15;
    const score = clampScore((input.publishingConsistencyScore / 100) * max, max);
    dimensions.push({
      key: "publishing_consistency",
      label: "Publishing consistency",
      score,
      maxScore: max,
      explanation:
        input.daysWithoutScheduled != null && input.daysWithoutScheduled > 0
          ? `${input.daysWithoutScheduled} day(s) without scheduled content in the near term.`
          : `${input.scheduledUpcoming} post(s) scheduled upcoming.`,
      recommendedImprovement:
        input.scheduledUpcoming < 2
          ? "Schedule at least 2 additional posts this week to maintain cadence."
          : undefined,
    });
  } else {
    dimensions.push(
      unavailableDimension(
        "publishing_consistency",
        "Publishing consistency",
        15,
        "Connect an organic channel and publish content to measure publishing consistency.",
      ),
    );
  }

  if (input.engagementRate != null) {
    const max = 15;
    const baseline = input.previousEngagementRate ?? input.engagementRate;
    const momentum =
      baseline > 0 ? ((input.engagementRate - baseline) / baseline) * 100 : 0;
    const qualityBase = Math.min(input.engagementRate * 4, max);
    const momentumBonus = momentum > 0 ? Math.min(momentum / 10, 3) : 0;
    const score = clampScore(qualityBase + momentumBonus, max);
    dimensions.push({
      key: "engagement_quality",
      label: "Engagement quality",
      score,
      maxScore: max,
      explanation: `Engagement rate is ${input.engagementRate.toFixed(2)}% for the selected period.`,
      recommendedImprovement:
        momentum < -10
          ? "Review recent posts with declining engagement and test a higher-performing format."
          : undefined,
    });
  } else {
    dimensions.push(
      unavailableDimension(
        "engagement_quality",
        "Engagement quality",
        15,
        "Engagement data is not yet available for connected accounts.",
      ),
    );
  }

  if (input.followerGrowthRate != null) {
    const max = 15;
    const score = clampScore(
      input.followerGrowthRate > 0
        ? Math.min(max, 8 + input.followerGrowthRate * 2)
        : Math.max(0, 8 + input.followerGrowthRate),
      max,
    );
    dimensions.push({
      key: "audience_growth",
      label: "Audience growth",
      score,
      maxScore: max,
      explanation: `Net follower growth rate is ${input.followerGrowthRate >= 0 ? "+" : ""}${input.followerGrowthRate.toFixed(1)}%.`,
      recommendedImprovement:
        input.followerGrowthRate < 2
          ? "Increase posting frequency on your fastest-growing channel."
          : undefined,
    });
  } else {
    dimensions.push(
      unavailableDimension(
        "audience_growth",
        "Audience growth",
        15,
        "Follower growth is not tracked until account analytics sync completes.",
      ),
    );
  }

  if (input.formatCount > 0) {
    const max = 10;
    const diversityRatio =
      input.formatDiversityCount / Math.max(1, input.formatCount);
    const score = clampScore(diversityRatio * max, max);
    dimensions.push({
      key: "content_diversity",
      label: "Content diversity",
      score,
      maxScore: max,
      explanation: `${input.formatDiversityCount} distinct format(s) used across ${input.formatCount} published item(s).`,
      recommendedImprovement:
        input.formatDiversityCount < 2
          ? "Test a second content format such as short video or carousel."
          : undefined,
    });
  } else {
    dimensions.push(
      unavailableDimension(
        "content_diversity",
        "Content diversity",
        10,
        "Publish content to measure format diversity.",
      ),
    );
  }

  if (input.totalChannelSlots > 0) {
    const max = 10;
    const coverageRatio = input.connectedChannelCount / input.totalChannelSlots;
    const score = clampScore(coverageRatio * max, max);
    dimensions.push({
      key: "channel_coverage",
      label: "Channel coverage",
      score,
      maxScore: max,
      explanation: `${input.connectedChannelCount} of ${input.totalChannelSlots} core channels connected.`,
      recommendedImprovement:
        input.connectedChannelCount < 2
          ? "Connect LinkedIn or another core channel to expand organic reach."
          : undefined,
    });
  }

  if (input.conversionContribution != null) {
    const max = 10;
    const score = clampScore(Math.min(max, input.conversionContribution / 5), max);
    dimensions.push({
      key: "conversion_contribution",
      label: "Conversion contribution",
      score,
      maxScore: max,
      explanation: `Organic social influenced ${input.conversionContribution.toFixed(0)}% of attributed conversions in period.`,
    });
  } else {
    dimensions.push(
      unavailableDimension(
        "conversion_contribution",
        "Conversion contribution",
        10,
        "Conversion attribution for organic social is not yet configured.",
      ),
    );
  }

  if (input.communityEngagementScore != null) {
    const max = 10;
    dimensions.push({
      key: "community_engagement",
      label: "Community engagement",
      score: clampScore(input.communityEngagementScore, max),
      maxScore: max,
      explanation: "Based on reviewed community opportunities and response velocity.",
    });
  } else {
    dimensions.push(
      unavailableDimension(
        "community_engagement",
        "Community engagement",
        10,
        "Community intelligence sources are not connected.",
      ),
    );
  }

  if (input.experimentCount > 0) {
    const max = 10;
    dimensions.push({
      key: "experiment_velocity",
      label: "Experiment velocity",
      score: clampScore(Math.min(max, input.experimentCount * 3), max),
      maxScore: max,
      explanation: `${input.experimentCount} organic experiment(s) active or recently completed.`,
    });
  } else {
    dimensions.push(
      unavailableDimension(
        "experiment_velocity",
        "Experiment velocity",
        10,
        "No organic experiments recorded for this brand.",
      ),
    );
  }

  const availableDimensions = dimensions.filter((d) => !d.unavailable);
  const total = availableDimensions.reduce((sum, d) => sum + d.score, 0);
  const maxTotal = dimensions.reduce((sum, d) => sum + d.maxScore, 0);

  return {
    total,
    maxTotal,
    dimensions,
  };
}
