import { AI_RECOMMENDATION_DISCLAIMER, AI_RECOMMENDATION_TYPES } from "./constants";

export type AiRecommendationInput = {
  recommendationType: string;
  evidence: string;
  uncertainty: string;
  budgetImpact: string;
  measurementPlan: string;
};

export type AiRecommendation = AiRecommendationInput & {
  requiresHumanApproval: true;
  disclaimer: string;
  canAutoApply: false;
};

export function validateAiRecommendation(input: AiRecommendationInput): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!(AI_RECOMMENDATION_TYPES as readonly string[]).includes(input.recommendationType)) {
    errors.push(`Invalid recommendation type: ${input.recommendationType}`);
  }
  if (!input.evidence?.trim()) errors.push("Evidence is required.");
  if (!input.uncertainty?.trim()) errors.push("Uncertainty disclosure is required.");
  if (!input.budgetImpact?.trim()) errors.push("Budget impact is required.");
  if (!input.measurementPlan?.trim()) errors.push("Measurement plan is required.");

  return { valid: errors.length === 0, errors };
}

export function buildAiRecommendation(input: AiRecommendationInput): AiRecommendation {
  const increaseTypes = ["INCREASE_THROUGH_APPROVAL"];
  if (increaseTypes.includes(input.recommendationType)) {
    return {
      ...input,
      requiresHumanApproval: true,
      disclaimer: `${AI_RECOMMENDATION_DISCLAIMER} Increase recommendations must be submitted as change requests.`,
      canAutoApply: false,
    };
  }

  return {
    ...input,
    requiresHumanApproval: true,
    disclaimer: AI_RECOMMENDATION_DISCLAIMER,
    canAutoApply: false,
  };
}

export function canAutoApplyRecommendation(): false {
  return false;
}
