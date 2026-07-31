import type { SeoKeywordOpportunityType } from "@prisma/client";
import {
  KEYWORD_MIN_CTR_THRESHOLD,
  KEYWORD_MIN_IMPRESSIONS_FOR_OPPORTUNITY,
  KEYWORD_POSITION_OPPORTUNITY_MAX,
  KEYWORD_POSITION_OPPORTUNITY_MIN,
} from "@/lib/keywords/constants";

export type OpportunityCandidate = {
  opportunityType: SeoKeywordOpportunityType;
  severity: string;
  title: string;
  explanation: string;
  evidence: Record<string, unknown>;
  recommendedAction: string;
};

export type KeywordMetrics = {
  impressions?: number | null;
  clicks?: number | null;
  ctr?: number | null;
  averagePosition?: number | null;
  previousPosition?: number | null;
  previousImpressions?: number | null;
  hasTargetPage?: boolean;
  targetPageWeak?: boolean;
  isBranded?: boolean;
  hasSuitableResult?: boolean;
  clusterCoverage?: number;
};

export function evaluateOpportunities(
  keyword: string,
  metrics: KeywordMetrics,
): OpportunityCandidate[] {
  const opportunities: OpportunityCandidate[] = [];

  if (
    metrics.impressions != null &&
    metrics.impressions >= KEYWORD_MIN_IMPRESSIONS_FOR_OPPORTUNITY &&
    metrics.ctr != null &&
    metrics.ctr < KEYWORD_MIN_CTR_THRESHOLD
  ) {
    opportunities.push({
      opportunityType: "HIGH_IMPRESSIONS_LOW_CTR",
      severity: "MEDIUM",
      title: "High impressions, low CTR",
      explanation: `"${keyword}" has ${metrics.impressions} impressions but CTR of ${(metrics.ctr * 100).toFixed(1)}%.`,
      evidence: { impressions: metrics.impressions, ctr: metrics.ctr },
      recommendedAction: "Review title tag and meta description for the ranking page.",
    });
  }

  if (
    metrics.averagePosition != null &&
    metrics.averagePosition >= KEYWORD_POSITION_OPPORTUNITY_MIN &&
    metrics.averagePosition <= KEYWORD_POSITION_OPPORTUNITY_MAX
  ) {
    opportunities.push({
      opportunityType: "POSITION_4_TO_20",
      severity: "MEDIUM",
      title: "Striking distance ranking",
      explanation: `"${keyword}" averages position ${metrics.averagePosition.toFixed(1)} — within striking distance of page 1.`,
      evidence: { averagePosition: metrics.averagePosition },
      recommendedAction: "Optimise on-page content and internal links for this keyword.",
    });
  }

  if (
    metrics.impressions != null &&
    metrics.previousImpressions != null &&
    metrics.impressions > metrics.previousImpressions * 1.2
  ) {
    opportunities.push({
      opportunityType: "INCREASING_IMPRESSIONS",
      severity: "LOW",
      title: "Increasing impressions",
      explanation: `Impressions grew from ${metrics.previousImpressions} to ${metrics.impressions}.`,
      evidence: { impressions: metrics.impressions, previousImpressions: metrics.previousImpressions },
      recommendedAction: "Capitalise on growing demand with targeted content.",
    });
  }

  if (
    metrics.averagePosition != null &&
    metrics.previousPosition != null &&
    metrics.averagePosition > metrics.previousPosition + 2
  ) {
    opportunities.push({
      opportunityType: "DECLINING_POSITION",
      severity: "HIGH",
      title: "Declining position",
      explanation: `Position dropped from ${metrics.previousPosition.toFixed(1)} to ${metrics.averagePosition.toFixed(1)}.`,
      evidence: { averagePosition: metrics.averagePosition, previousPosition: metrics.previousPosition },
      recommendedAction: "Investigate content freshness and competitor changes.",
    });
  }

  if (metrics.hasTargetPage === false) {
    opportunities.push({
      opportunityType: "NO_TARGET_PAGE",
      severity: "MEDIUM",
      title: "No target page mapped",
      explanation: `"${keyword}" has no mapped target page.`,
      evidence: { keyword },
      recommendedAction: "Map to an existing page or plan new content.",
    });
  }

  if (metrics.targetPageWeak) {
    opportunities.push({
      opportunityType: "WEAK_TARGET_PAGE",
      severity: "MEDIUM",
      title: "Weak target page",
      explanation: `Mapped target page may be under-optimised for "${keyword}".`,
      evidence: { keyword },
      recommendedAction: "Strengthen on-page signals on the target page.",
    });
  }

  if (metrics.isBranded && metrics.hasSuitableResult === false) {
    opportunities.push({
      opportunityType: "BRANDED_NO_RESULT",
      severity: "HIGH",
      title: "Branded query without suitable result",
      explanation: `Branded query "${keyword}" lacks a suitable ranking page.`,
      evidence: { keyword, isBranded: true },
      recommendedAction: "Ensure branded landing page ranks for this query.",
    });
  }

  if (metrics.clusterCoverage != null && metrics.clusterCoverage < 0.5) {
    opportunities.push({
      opportunityType: "INCOMPLETE_CLUSTER",
      severity: "LOW",
      title: "Incomplete topic cluster",
      explanation: `Topic cluster coverage is ${(metrics.clusterCoverage * 100).toFixed(0)}%.`,
      evidence: { clusterCoverage: metrics.clusterCoverage },
      recommendedAction: "Add supporting content to complete the topic cluster.",
    });
  }

  return opportunities;
}
