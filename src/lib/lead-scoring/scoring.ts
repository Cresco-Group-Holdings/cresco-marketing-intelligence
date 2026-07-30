import {
  DEFAULT_CATEGORY_CAPS,
  DEFAULT_SCORE_CAPS,
  SCORE_VERSION,
  type DecayFormula,
  type ScoreType,
  type SignalCategory,
} from "./constants";
import { applyEvidenceDecay } from "./decay";
import { evaluateRuleGroup, type RuleEvidence, type RuleGroup, type ScoringRule } from "./rules";
import type { LeadSnapshot } from "./signals";

export type ScoringModel = {
  id: string;
  name: string;
  version?: string;
  ruleGroups: RuleGroup[];
  scoreCaps?: Partial<Record<ScoreType, number>>;
  categoryCaps?: Partial<Record<SignalCategory, number>>;
  decay?: {
    enabled: boolean;
    formula: DecayFormula;
    halfLifeDays?: number;
    minFactor?: number;
  };
};

export type CategoryScore = {
  category: SignalCategory;
  rawPoints: number;
  cappedPoints: number;
  decayedPoints: number;
  capApplied: boolean;
  evidence: RuleEvidence[];
};

export type ScoreBreakdown = {
  fit: CategoryScore;
  engagement: CategoryScore;
  negative: CategoryScore;
};

export type ComputedScores = {
  scoreVersion: string;
  leadId: string;
  fitScore: number;
  engagementScore: number;
  negativeScore: number;
  compositeScore: number;
  breakdown: ScoreBreakdown;
  evidence: RuleEvidence[];
  capsApplied: string[];
  computedAt: string;
};

function emptyCategoryScore(category: SignalCategory): CategoryScore {
  return {
    category,
    rawPoints: 0,
    cappedPoints: 0,
    decayedPoints: 0,
    capApplied: false,
    evidence: [],
  };
}

function capScore(value: number, cap: number, category: SignalCategory): {
  capped: number;
  applied: boolean;
} {
  if (category === "NEGATIVE") {
    const capped = Math.max(value, cap);
    return { capped, applied: capped !== value };
  }
  const capped = Math.min(value, cap);
  return { capped, applied: capped !== value };
}

function combineCategoryScores(
  fit: number,
  engagement: number,
  negative: number,
  compositeCap: number,
): number {
  const raw = fit + engagement + negative;
  return Math.max(0, Math.min(compositeCap, Math.round(raw * 1000) / 1000));
}

export function computeScores(
  model: ScoringModel,
  snapshot: LeadSnapshot,
  now = new Date(),
): ComputedScores {
  const scoreCaps = { ...DEFAULT_SCORE_CAPS, ...model.scoreCaps };
  const categoryCaps = { ...DEFAULT_CATEGORY_CAPS, ...model.categoryCaps };
  const capsApplied: string[] = [];
  const allEvidence: RuleEvidence[] = [];

  const categoryResults: Record<SignalCategory, CategoryScore> = {
    FIT: emptyCategoryScore("FIT"),
    ENGAGEMENT: emptyCategoryScore("ENGAGEMENT"),
    NEGATIVE: emptyCategoryScore("NEGATIVE"),
  };

  for (const group of model.ruleGroups) {
    const result = evaluateRuleGroup(group, snapshot);
    const category = categoryResults[group.category];

    category.rawPoints += result.rawPoints;
    category.cappedPoints += result.cappedPoints;
    category.evidence.push(...result.evidence);
    allEvidence.push(...result.evidence);

    if (result.capApplied) {
      capsApplied.push(`group:${group.id}`);
    }
  }

  for (const category of ["FIT", "ENGAGEMENT", "NEGATIVE"] as const) {
    const score = categoryResults[category];
    const cap = categoryCaps[category];
    const { capped, applied } = capScore(score.cappedPoints, cap, category);
    score.cappedPoints = capped;
    if (applied) capsApplied.push(`category:${category}`);

    if (model.decay?.enabled) {
      const decayedEvidence = applyEvidenceDecay(
        score.evidence.filter((e) => e.matched),
        snapshot,
        {
          formula: model.decay.formula,
          halfLifeDays: model.decay.halfLifeDays,
          minFactor: model.decay.minFactor,
        },
        now,
      );
      score.decayedPoints = decayedEvidence.reduce((sum, item) => sum + item.decayedPoints, 0);
      const { capped: decayCapped, applied: decayCapApplied } = capScore(
        score.decayedPoints,
        cap,
        category,
      );
      score.decayedPoints = decayCapped;
      if (decayCapApplied) capsApplied.push(`decay-category:${category}`);
    } else {
      score.decayedPoints = score.cappedPoints;
    }
  }

  const fitScore = capScore(
    categoryResults.FIT.decayedPoints,
    scoreCaps.FIT,
    "FIT",
  );
  const engagementScore = capScore(
    categoryResults.ENGAGEMENT.decayedPoints,
    scoreCaps.ENGAGEMENT,
    "ENGAGEMENT",
  );
  const negativeScore = capScore(
    categoryResults.NEGATIVE.decayedPoints,
    scoreCaps.NEGATIVE,
    "NEGATIVE",
  );

  if (fitScore.applied) capsApplied.push("score:FIT");
  if (engagementScore.applied) capsApplied.push("score:ENGAGEMENT");
  if (negativeScore.applied) capsApplied.push("score:NEGATIVE");

  const compositeScore = combineCategoryScores(
    fitScore.capped,
    engagementScore.capped,
    negativeScore.capped,
    scoreCaps.COMPOSITE,
  );

  if (compositeScore === scoreCaps.COMPOSITE) {
    capsApplied.push("score:COMPOSITE");
  }

  return {
    scoreVersion: model.version ?? SCORE_VERSION,
    leadId: snapshot.leadId,
    fitScore: fitScore.capped,
    engagementScore: engagementScore.capped,
    negativeScore: negativeScore.capped,
    compositeScore,
    breakdown: {
      fit: categoryResults.FIT,
      engagement: categoryResults.ENGAGEMENT,
      negative: categoryResults.NEGATIVE,
    },
    evidence: allEvidence,
    capsApplied: [...new Set(capsApplied)],
    computedAt: now.toISOString(),
  };
}

export type { ScoringRule, RuleGroup };
