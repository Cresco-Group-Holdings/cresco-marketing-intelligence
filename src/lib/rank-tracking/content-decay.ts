import { DECAY_MIN_SIGNALS } from "@/lib/rank-tracking/constants";

export type DecaySignal = {
  signal: string;
  weight: number;
  evidence: Record<string, unknown>;
};

export type PageDecayInput = {
  url: string;
  title?: string;
  clicksTrend?: number | null;
  impressionsTrend?: number | null;
  rankTrend?: number | null;
  ctrTrend?: number | null;
  contentAgeDays?: number | null;
  brokenLinkCount?: number;
  outdatedReferenceCount?: number;
  competitorCoverageIncrease?: boolean;
  unresolvedOnPageIssues?: number;
  internalLinkLoss?: number;
  lastModifiedDays?: number | null;
};

export function evaluateContentDecay(input: PageDecayInput): {
  decayScore: number;
  signals: DecaySignal[];
  isCandidate: boolean;
} {
  const signals: DecaySignal[] = [];

  if (input.clicksTrend != null && input.clicksTrend < -0.2) {
    signals.push({ signal: "declining_clicks", weight: 0.25, evidence: { trend: input.clicksTrend } });
  }
  if (input.impressionsTrend != null && input.impressionsTrend < -0.2) {
    signals.push({ signal: "declining_impressions", weight: 0.2, evidence: { trend: input.impressionsTrend } });
  }
  if (input.rankTrend != null && input.rankTrend > 3) {
    signals.push({ signal: "declining_ranking", weight: 0.25, evidence: { trend: input.rankTrend } });
  }
  if (input.ctrTrend != null && input.ctrTrend < -0.15) {
    signals.push({ signal: "lower_ctr", weight: 0.15, evidence: { trend: input.ctrTrend } });
  }
  if (input.lastModifiedDays != null && input.lastModifiedDays > 365 && signals.length > 0) {
    signals.push({ signal: "stale_content", weight: 0.1, evidence: { lastModifiedDays: input.lastModifiedDays } });
  }
  if ((input.brokenLinkCount ?? 0) > 0) {
    signals.push({ signal: "broken_links", weight: 0.1, evidence: { count: input.brokenLinkCount } });
  }
  if ((input.outdatedReferenceCount ?? 0) > 0) {
    signals.push({ signal: "outdated_references", weight: 0.1, evidence: { count: input.outdatedReferenceCount } });
  }
  if (input.competitorCoverageIncrease) {
    signals.push({ signal: "competitor_coverage_increase", weight: 0.15, evidence: {} });
  }
  if ((input.unresolvedOnPageIssues ?? 0) > 0) {
    signals.push({ signal: "unresolved_on_page_issues", weight: 0.1, evidence: { count: input.unresolvedOnPageIssues } });
  }
  if ((input.internalLinkLoss ?? 0) > 0) {
    signals.push({ signal: "internal_link_loss", weight: 0.1, evidence: { loss: input.internalLinkLoss } });
  }

  const decayScore = Math.min(1, signals.reduce((sum, s) => sum + s.weight, 0));
  return {
    decayScore,
    signals,
    isCandidate: signals.length >= DECAY_MIN_SIGNALS,
  };
}
