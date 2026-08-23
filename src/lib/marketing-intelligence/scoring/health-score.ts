import type { MarketingHealthBreakdown, MarketingIntelligenceContext } from "@/lib/marketing-intelligence/types";
import { buildHealthRecommendedImprovement } from "@/lib/marketing-intelligence/scoring/health-improvements";

const WEIGHTS = {
  paid: 25,
  organic: 25,
  publishing: 20,
  connectivity: 15,
  dataQuality: 15,
} as const;

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) {
    return current > 0 ? 100 : null;
  }
  return ((current - previous) / previous) * 100;
}

function scorePaidPerformance(context: MarketingIntelligenceContext): {
  score: number;
  detail: string;
} {
  if (context.paid.connectedCount === 0) {
    return { score: 0, detail: "No paid channels connected." };
  }

  let score = 8;
  const roas = context.paid.roas;
  const cpaChange = pctChange(context.paid.cpa ?? 0, context.paid.previousCpa ?? 0);
  const conversionChange = pctChange(context.paid.conversions, context.paid.previousConversions);

  if (roas != null && roas >= 3) score += 8;
  else if (roas != null && roas >= 2) score += 5;
  else if (roas != null && roas >= 1) score += 2;

  if (conversionChange != null && conversionChange > 5) score += 5;
  else if (conversionChange != null && conversionChange >= 0) score += 3;

  if (cpaChange != null && cpaChange < -5) score += 4;
  else if (cpaChange != null && cpaChange <= 0) score += 2;

  if (context.paid.conversions > 0) score += 4;

  return {
    score: clamp(score, 0, WEIGHTS.paid),
    detail:
      roas != null
        ? `Blended ROAS ${roas.toFixed(2)}x across ${context.paid.connectedCount} connected paid channel(s).`
        : `Paid conversions tracked across ${context.paid.connectedCount} connected channel(s).`,
  };
}

function scoreOrganicPerformance(context: MarketingIntelligenceContext): {
  score: number;
  detail: string;
} {
  if (context.organic.connectedCount === 0) {
    return { score: 0, detail: "No organic channels connected." };
  }

  let score = 8;
  const engagementChange = pctChange(
    context.organic.engagement ?? 0,
    context.organic.previousEngagement ?? 0,
  );
  const reachChange = pctChange(context.organic.reach ?? 0, context.organic.previousReach ?? 0);

  if (context.organic.engagementRate != null && context.organic.engagementRate >= 3) score += 7;
  else if (context.organic.engagementRate != null && context.organic.engagementRate >= 1.5) score += 4;

  if (engagementChange != null && engagementChange > 5) score += 5;
  if (reachChange != null && reachChange > 5) score += 5;

  if ((context.organic.published ?? 0) > 0) score += 5;

  return {
    score: clamp(score, 0, WEIGHTS.organic),
    detail: `Organic activity across ${context.organic.connectedCount} connected channel(s).`,
  };
}

function scorePublishingConsistency(context: MarketingIntelligenceContext): {
  score: number;
  detail: string;
} {
  let score = 4;
  if (context.publishing.publishedInRange >= 4) score += 8;
  else if (context.publishing.publishedInRange >= 1) score += 5;

  if (context.publishing.scheduledUpcoming >= 3) score += 6;
  else if (context.publishing.scheduledUpcoming >= 1) score += 3;

  if (context.publishing.daysWithoutScheduled != null && context.publishing.daysWithoutScheduled <= 2) {
    score += 2;
  }

  return {
    score: clamp(score, 0, WEIGHTS.publishing),
    detail: `${context.publishing.publishedInRange} published and ${context.publishing.scheduledUpcoming} scheduled in the selected period.`,
  };
}

function scoreConnectivity(context: MarketingIntelligenceContext): {
  score: number;
  detail: string;
} {
  const paidRatio =
    context.connectivity.paidTotal > 0
      ? context.connectivity.paidConnected / context.connectivity.paidTotal
      : 0;
  const organicRatio =
    context.connectivity.organicTotal > 0
      ? context.connectivity.organicConnected / context.connectivity.organicTotal
      : 0;
  const blended = (paidRatio + organicRatio) / 2;
  const score = clamp(Math.round(blended * WEIGHTS.connectivity), 0, WEIGHTS.connectivity);

  return {
    score,
    detail: `${context.connectivity.paidConnected} of ${context.connectivity.paidTotal} paid and ${context.connectivity.organicConnected} of ${context.connectivity.organicTotal} organic channels connected.`,
  };
}

function scoreDataQuality(context: MarketingIntelligenceContext): {
  score: number;
  detail: string;
} {
  const states = [context.paid.freshness, context.organic.freshness];
  let score = 0;
  for (const state of states) {
    if (state === "fresh") score += 7;
    else if (state === "delayed") score += 4;
    else if (state === "stale") score += 2;
  }

  return {
    score: clamp(score, 0, WEIGHTS.dataQuality),
    detail: `Paid data is ${context.paid.freshness}; organic data is ${context.organic.freshness}.`,
  };
}

export function calculateMarketingHealth(
  context: MarketingIntelligenceContext,
): MarketingHealthBreakdown {
  const paid = scorePaidPerformance(context);
  const organic = scoreOrganicPerformance(context);
  const publishing = scorePublishingConsistency(context);
  const connectivity = scoreConnectivity(context);
  const dataQuality = scoreDataQuality(context);

  const componentInputs = [
    { key: "paid", label: "Paid performance", ...paid, maxScore: WEIGHTS.paid },
    { key: "organic", label: "Organic performance", ...organic, maxScore: WEIGHTS.organic },
    { key: "publishing", label: "Publishing consistency", ...publishing, maxScore: WEIGHTS.publishing },
    { key: "connectivity", label: "Channel connectivity", ...connectivity, maxScore: WEIGHTS.connectivity },
    { key: "dataQuality", label: "Data quality", ...dataQuality, maxScore: WEIGHTS.dataQuality },
  ];

  const components = componentInputs.map((component) => ({
    key: component.key,
    label: component.label,
    score: component.score,
    maxScore: component.maxScore,
    detail: component.detail,
    recommendedImprovement: buildHealthRecommendedImprovement(
      component.key,
      component.score,
      component.maxScore,
      context,
    ),
  }));

  const total = components.reduce((sum, item) => sum + item.score, 0);

  return {
    total: clamp(Math.round(total), 0, 100),
    components,
  };
}
