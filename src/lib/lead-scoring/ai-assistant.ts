import { AI_ASSISTANT_DISCLAIMER } from "./constants";
import { SIGNAL_DEFINITIONS } from "./signals";
import { detectMissingInfo, type QualificationResult } from "./qualification";
import type { ComputedScores, ScoringModel } from "./scoring";
import type { LeadSnapshot } from "./signals";

export type ScoreExplanation = {
  summary: string;
  fitSummary: string;
  engagementSummary: string;
  negativeSummary: string;
  topContributors: Array<{ signal: string; label: string; points: number }>;
  topDetractors: Array<{ signal: string; label: string; points: number }>;
  evidence: Record<string, unknown>;
  grounded: true;
  modifiesScore: false;
  disclaimer: string;
};

export type FollowUpSuggestion = {
  suggestionType: string;
  title: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  recommendedAction: string;
  evidence: Record<string, unknown>;
  grounded: true;
  autoApplyBlocked: true;
  disclaimer: string;
};

export type RuleImprovement = {
  ruleId?: string;
  signal?: string;
  improvementType: string;
  title: string;
  description: string;
  rationale: string;
  evidence: Record<string, unknown>;
  grounded: true;
  modifiesScore: false;
  disclaimer: string;
};

export function generateScoreExplanation(
  scores: ComputedScores,
  qualification: QualificationResult,
  snapshot: LeadSnapshot,
): ScoreExplanation {
  const matchedEvidence = scores.evidence.filter((e) => e.matched);

  const contributors = matchedEvidence
    .filter((e) => e.cappedPoints > 0)
    .sort((a, b) => b.cappedPoints - a.cappedPoints)
    .slice(0, 5)
    .map((e) => ({
      signal: e.signal,
      label: e.label ?? SIGNAL_DEFINITIONS[e.signal]?.label ?? e.signal,
      points: e.cappedPoints,
    }));

  const detractors = matchedEvidence
    .filter((e) => e.cappedPoints < 0)
    .sort((a, b) => a.cappedPoints - b.cappedPoints)
    .slice(0, 5)
    .map((e) => ({
      signal: e.signal,
      label: e.label ?? SIGNAL_DEFINITIONS[e.signal]?.label ?? e.signal,
      points: e.cappedPoints,
    }));

  const fitSummary = `Fit score: ${scores.fitScore} (${scores.breakdown.fit.evidence.filter((e) => e.matched).length} rules matched).`;
  const engagementSummary = `Engagement score: ${scores.engagementScore} (${scores.breakdown.engagement.evidence.filter((e) => e.matched).length} rules matched).`;
  const negativeSummary = `Negative score: ${scores.negativeScore} (${scores.breakdown.negative.evidence.filter((e) => e.matched).length} rules matched).`;

  const summary = [
    `Lead ${snapshot.leadId} has a composite score of ${scores.compositeScore}.`,
    `Qualification status: ${qualification.status} (confidence: ${qualification.confidence}).`,
    qualification.reasons[0] ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    summary,
    fitSummary,
    engagementSummary,
    negativeSummary,
    topContributors: contributors,
    topDetractors: detractors,
    evidence: {
      leadId: snapshot.leadId,
      compositeScore: scores.compositeScore,
      fitScore: scores.fitScore,
      engagementScore: scores.engagementScore,
      negativeScore: scores.negativeScore,
      qualificationStatus: qualification.status,
      matchedRuleCount: matchedEvidence.length,
      capsApplied: scores.capsApplied,
      missingFields: qualification.missingFields,
    },
    grounded: true,
    modifiesScore: false,
    disclaimer: AI_ASSISTANT_DISCLAIMER,
  };
}

export function suggestFollowUp(
  scores: ComputedScores,
  qualification: QualificationResult,
  snapshot: LeadSnapshot,
): FollowUpSuggestion | null {
  if (snapshot.suppressed || snapshot.unsubscribed) return null;

  const missingFields = detectMissingInfo(snapshot);

  if (qualification.status === "SALES_REVIEW_REQUIRED" && missingFields.length > 0) {
    return {
      suggestionType: "COLLECT_MISSING_INFO",
      title: "Collect missing lead information",
      description: `Lead is missing: ${missingFields.join(", ")}. Gather data before re-scoring.`,
      priority: "HIGH",
      recommendedAction: "Create a data enrichment or qualification task.",
      evidence: {
        leadId: snapshot.leadId,
        missingFields,
        compositeScore: scores.compositeScore,
      },
      grounded: true,
      autoApplyBlocked: true,
      disclaimer: AI_ASSISTANT_DISCLAIMER,
    };
  }

  if (qualification.status === "MARKETING_QUALIFIED" || qualification.status === "SALES_QUALIFIED") {
    return {
      suggestionType: "SALES_OUTREACH",
      title: "Prioritise sales outreach",
      description: `Lead scores ${scores.compositeScore} with ${qualification.status} status. Schedule timely follow-up.`,
      priority: "HIGH",
      recommendedAction: "Assign to sales owner and schedule a discovery call.",
      evidence: {
        leadId: snapshot.leadId,
        compositeScore: scores.compositeScore,
        status: qualification.status,
        topContributors: scores.evidence
          .filter((e) => e.matched && e.cappedPoints > 0)
          .slice(0, 3)
          .map((e) => e.signal),
      },
      grounded: true,
      autoApplyBlocked: true,
      disclaimer: AI_ASSISTANT_DISCLAIMER,
    };
  }

  if (qualification.status === "SALES_REVIEW_REQUIRED" && missingFields.length === 0) {
    return {
      suggestionType: "NURTURE",
      title: "Continue nurture sequence",
      description: "Lead shows moderate fit and engagement. Maintain nurture cadence.",
      priority: "MEDIUM",
      recommendedAction: "Enrol in relevant nurture automation if not already active.",
      evidence: {
        leadId: snapshot.leadId,
        compositeScore: scores.compositeScore,
        engagementScore: scores.engagementScore,
      },
      grounded: true,
      autoApplyBlocked: true,
      disclaimer: AI_ASSISTANT_DISCLAIMER,
    };
  }

  if (qualification.status === "LOW_PRIORITY") {
    return {
      suggestionType: "RE_ENGAGE",
      title: "Consider re-engagement campaign",
      description: "Low composite score suggests limited buying intent. Evaluate re-engagement options.",
      priority: "LOW",
      recommendedAction: "Review fit criteria or trigger a re-engagement email.",
      evidence: {
        leadId: snapshot.leadId,
        compositeScore: scores.compositeScore,
        fitScore: scores.fitScore,
        engagementScore: scores.engagementScore,
      },
      grounded: true,
      autoApplyBlocked: true,
      disclaimer: AI_ASSISTANT_DISCLAIMER,
    };
  }

  return null;
}

export function proposeRuleImprovements(
  model: ScoringModel,
  scores: ComputedScores,
  snapshot: LeadSnapshot,
): RuleImprovement[] {
  const improvements: RuleImprovement[] = [];
  const unmatchedGroups = model.ruleGroups.filter((group) => {
    const categoryScore = scores.breakdown[group.category.toLowerCase() as "fit" | "engagement" | "negative"];
    return categoryScore.evidence.every((e) => !e.matched);
  });

  for (const group of unmatchedGroups) {
    improvements.push({
      improvementType: "UNMATCHED_GROUP",
      title: `Review ${group.category} rule group "${group.id}"`,
      description: `No rules in this group matched for lead ${snapshot.leadId}. Consider adjusting thresholds or values.`,
      rationale: "Unmatched rule groups contribute zero points and may indicate overly strict criteria.",
      evidence: {
        groupId: group.id,
        category: group.category,
        ruleCount: group.rules.length,
        leadId: snapshot.leadId,
      },
      grounded: true,
      modifiesScore: false,
      disclaimer: AI_ASSISTANT_DISCLAIMER,
    });
  }

  const zeroPointRules = scores.evidence.filter((e) => e.matched && e.points === 0);
  for (const rule of zeroPointRules) {
    improvements.push({
      ruleId: rule.ruleId,
      signal: rule.signal,
      improvementType: "ZERO_POINT_RULE",
      title: `Rule ${rule.ruleId} matches but awards zero points`,
      description: "Matched rules with zero points have no scoring effect.",
      rationale: "Assign meaningful point values or disable unused rules.",
      evidence: {
        ruleId: rule.ruleId,
        signal: rule.signal,
        actualValue: rule.actualValue,
      },
      grounded: true,
      modifiesScore: false,
      disclaimer: AI_ASSISTANT_DISCLAIMER,
    });
  }

  if (scores.capsApplied.length > 0) {
    improvements.push({
      improvementType: "CAPS_REACHED",
      title: "Score caps were applied",
      description: `Caps applied: ${scores.capsApplied.join(", ")}. Some rules may be redundant.`,
      rationale: "When caps are frequently hit, consider redistributing points across rules.",
      evidence: {
        capsApplied: scores.capsApplied,
        compositeScore: scores.compositeScore,
        leadId: snapshot.leadId,
      },
      grounded: true,
      modifiesScore: false,
      disclaimer: AI_ASSISTANT_DISCLAIMER,
    });
  }

  const missingFields = detectMissingInfo(snapshot);
  if (missingFields.length > 0) {
    improvements.push({
      improvementType: "MISSING_DATA",
      title: "Lead data gaps limit scoring accuracy",
      description: `Missing fields: ${missingFields.join(", ")}.`,
      rationale: "Incomplete CRM data prevents fit and engagement rules from firing.",
      evidence: { missingFields, leadId: snapshot.leadId },
      grounded: true,
      modifiesScore: false,
      disclaimer: AI_ASSISTANT_DISCLAIMER,
    });
  }

  return improvements;
}
