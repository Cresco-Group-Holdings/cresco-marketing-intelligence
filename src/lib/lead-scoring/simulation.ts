import type { QualificationStatus } from "./constants";
import { mapScoreToQualificationStatus } from "./qualification";
import { computeScores, type ScoringModel } from "./scoring";
import type { LeadSnapshot } from "./signals";

export type SimulationLeadInput = {
  snapshot: LeadSnapshot;
  previousStatus?: QualificationStatus;
  previousCompositeScore?: number;
};

export type ScoreDistributionBucket = {
  range: string;
  min: number;
  max: number;
  count: number;
};

export type HighImpactRule = {
  ruleId: string;
  signal: string;
  label?: string;
  matchCount: number;
  totalPointsContributed: number;
  affectedLeadIds: string[];
};

export type StatusChange = {
  leadId: string;
  previousStatus: QualificationStatus;
  newStatus: QualificationStatus;
  previousScore: number;
  newScore: number;
};

export type SimulationResult = {
  totalLeads: number;
  affectedLeadCount: number;
  unaffectedLeadCount: number;
  statusChanges: StatusChange[];
  scoreDistribution: ScoreDistributionBucket[];
  highImpactRules: HighImpactRule[];
  averageCompositeScore: number;
  medianCompositeScore: number;
};

const DISTRIBUTION_BUCKETS: Array<{ range: string; min: number; max: number }> = [
  { range: "0-24", min: 0, max: 24 },
  { range: "25-49", min: 25, max: 49 },
  { range: "50-74", min: 50, max: 74 },
  { range: "75-100", min: 75, max: 100 },
];

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function buildScoreDistribution(scores: number[]): ScoreDistributionBucket[] {
  return DISTRIBUTION_BUCKETS.map((bucket) => ({
    ...bucket,
    count: scores.filter((s) => s >= bucket.min && s <= bucket.max).length,
  }));
}

function identifyHighImpactRules(
  leads: SimulationLeadInput[],
  model: ScoringModel,
): HighImpactRule[] {
  const ruleMap = new Map<string, HighImpactRule>();

  for (const lead of leads) {
    const scores = computeScores(model, lead.snapshot);
    for (const evidence of scores.evidence) {
      if (!evidence.matched) continue;

      const existing = ruleMap.get(evidence.ruleId) ?? {
        ruleId: evidence.ruleId,
        signal: evidence.signal,
        label: evidence.label,
        matchCount: 0,
        totalPointsContributed: 0,
        affectedLeadIds: [],
      };

      existing.matchCount += 1;
      existing.totalPointsContributed += evidence.cappedPoints;
      if (!existing.affectedLeadIds.includes(lead.snapshot.leadId)) {
        existing.affectedLeadIds.push(lead.snapshot.leadId);
      }
      ruleMap.set(evidence.ruleId, existing);
    }
  }

  return [...ruleMap.values()]
    .sort((a, b) => b.totalPointsContributed - a.totalPointsContributed)
    .slice(0, 10);
}

export function simulateModel(
  model: ScoringModel,
  leads: SimulationLeadInput[],
): SimulationResult {
  const statusChanges: StatusChange[] = [];
  const compositeScores: number[] = [];
  let affectedLeadCount = 0;

  for (const lead of leads) {
    const scores = computeScores(model, lead.snapshot);
    const qualification = mapScoreToQualificationStatus(scores, lead.snapshot);
    compositeScores.push(scores.compositeScore);

    const previousStatus = lead.previousStatus ?? "UNASSESSED";
    const previousScore = lead.previousCompositeScore ?? 0;
    const scoreChanged = scores.compositeScore !== previousScore;
    const statusChanged = qualification.status !== previousStatus;

    if (scoreChanged || statusChanged) {
      affectedLeadCount += 1;
    }

    if (statusChanged) {
      statusChanges.push({
        leadId: lead.snapshot.leadId,
        previousStatus,
        newStatus: qualification.status,
        previousScore,
        newScore: scores.compositeScore,
      });
    }
  }

  const totalScore = compositeScores.reduce((sum, s) => sum + s, 0);

  return {
    totalLeads: leads.length,
    affectedLeadCount,
    unaffectedLeadCount: leads.length - affectedLeadCount,
    statusChanges,
    scoreDistribution: buildScoreDistribution(compositeScores),
    highImpactRules: identifyHighImpactRules(leads, model),
    averageCompositeScore:
      leads.length > 0 ? Math.round((totalScore / leads.length) * 1000) / 1000 : 0,
    medianCompositeScore: Math.round(median(compositeScores) * 1000) / 1000,
  };
}
