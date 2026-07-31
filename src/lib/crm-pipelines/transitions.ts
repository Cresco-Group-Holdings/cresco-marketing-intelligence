import { STAGE_CATEGORIES, WON_EVIDENCE_TYPES } from "./constants";

export type PipelineStage = {
  id: string;
  name: string;
  sortOrder: number;
  category: string;
  probability: number;
  requiredFields?: string[];
  exitCriteria?: Record<string, unknown>;
  entryCriteria?: Record<string, unknown>;
  requiresApproval?: boolean;
  maxDurationDays?: number;
};

export type OpportunitySnapshot = {
  id: string;
  name: string;
  status: string;
  ownerUserId?: string | null;
  companyId?: string | null;
  product?: string | null;
  plan?: string | null;
  expectedCloseDate?: Date | null;
  probability: number;
  expectedValue?: number;
  recurringValue?: number;
  currency?: string;
  nextAction?: string | null;
  stageEnteredAt?: Date;
  lastActivityAt?: Date;
  currentStageId: string;
  hasDecisionMaker?: boolean;
};

export type TransitionInput = {
  opportunity: OpportunitySnapshot;
  fromStage: PipelineStage;
  toStage: PipelineStage;
  reason?: string;
  actorUserId?: string;
  hasApproval?: boolean;
  activeTaskCount?: number;
  duplicateOpenOpportunity?: boolean;
  aiRecommended?: boolean;
};

export function validateStageTransition(input: TransitionInput): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const { opportunity, fromStage, toStage, reason } = input;

  if (opportunity.status !== "OPEN") {
    errors.push("Cannot move a closed opportunity.");
  }

  if (toStage.category === "WON") {
    errors.push("Use markWon with evidence — do not move directly to WON stage without evidence.");
  }

  if (toStage.category === "LOST") {
    errors.push("Use markLost with reason — do not move directly to LOST stage without reason.");
  }

  if (fromStage.requiresApproval && !input.hasApproval) {
    errors.push(`Stage "${fromStage.name}" requires approval before exit.`);
  }

  if (toStage.entryCriteria) {
    const criteria = toStage.entryCriteria as { requiredFields?: string[] };
    if (criteria.requiredFields?.length) {
      for (const field of criteria.requiredFields) {
        const val = (opportunity as Record<string, unknown>)[field];
        if (val === undefined || val === null || val === "") {
          errors.push(`Entry criteria not met: ${field} is required.`);
        }
      }
    }
  }

  const required = toStage.requiredFields ?? [];
  for (const field of required) {
    const val = (opportunity as Record<string, unknown>)[field];
    if (val === undefined || val === null || val === "") {
      errors.push(`Required field missing for stage "${toStage.name}": ${field}`);
    }
  }

  if (fromStage.exitCriteria) {
    const exit = fromStage.exitCriteria as { minProbability?: number };
    if (exit.minProbability !== undefined && opportunity.probability < exit.minProbability) {
      errors.push(`Exit criteria not met: probability must be at least ${exit.minProbability}%.`);
    }
  }

  if (!reason?.trim() && toStage.sortOrder < fromStage.sortOrder) {
    errors.push("Reason required for backward stage movement.");
  }

  if (input.activeTaskCount && input.activeTaskCount > 0 && toStage.sortOrder < fromStage.sortOrder) {
    errors.push("Cannot reverse stage while active tasks remain.");
  }

  if (input.duplicateOpenOpportunity) {
    errors.push("Duplicate open opportunity policy violation.");
  }

  if (input.aiRecommended && toStage.category === "WON") {
    errors.push("Cannot mark won based solely on AI recommendation.");
  }

  if (toStage.sortOrder <= fromStage.sortOrder + 1 || reason) {
    // forward or justified backward — ok
  } else if (toStage.sortOrder > fromStage.sortOrder + 1) {
    errors.push("Cannot skip stages without sequential progression.");
  }

  return { valid: errors.length === 0, errors };
}

export function validateMarkWon(evidenceType: string, evidenceReference?: string): { valid: boolean; error?: string } {
  if (!(WON_EVIDENCE_TYPES as readonly string[]).includes(evidenceType)) {
    return { valid: false, error: `Invalid won evidence type: ${evidenceType}` };
  }
  if (!evidenceReference?.trim()) {
    return { valid: false, error: "Won evidence reference is required." };
  }
  return { valid: true };
}

export function validateMarkLost(lossReasonId?: string, notes?: string): { valid: boolean; error?: string } {
  if (!lossReasonId) return { valid: false, error: "Loss reason is required." };
  return { valid: true };
}

export function isTerminalCategory(category: string): boolean {
  return category === "WON" || category === "LOST";
}

export function categoryToStatus(category: string): string {
  if (category === "WON") return "WON";
  if (category === "LOST") return "LOST";
  return "OPEN";
}

export function buildTransitionRecord(input: {
  previousStageId: string | null;
  newStageId: string;
  previousCategory: string | null;
  newCategory: string;
  actorUserId?: string;
  reason?: string;
  source?: string;
}) {
  return {
    previousStageId: input.previousStageId,
    newStageId: input.newStageId,
    previousCategory: input.previousCategory,
    newCategory: input.newCategory,
    actorUserId: input.actorUserId ?? null,
    reason: input.reason ?? null,
    source: input.source ?? "MANUAL",
    createdAt: new Date(),
  };
}
