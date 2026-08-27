import {
  ACTIVATION_MILESTONE_LABELS,
  ESSENTIAL_SETUP_MILESTONES,
  type ActivationHighLevelStatus,
  type ActivationMilestoneKey,
  type ActivationMilestoneSnapshot,
  type ActivationMilestoneState,
} from "@/lib/activation/milestones";

export type ActivationStatusInput = {
  milestones: ActivationMilestoneSnapshot;
  demoModeEnabled: boolean;
  demoProductExperienced: boolean;
  onboardingCompleted: boolean;
  syncInProgress: boolean;
};

export type ActivationStatusResult = {
  status: ActivationHighLevelStatus;
  milestones: ActivationMilestoneState[];
  essentialCompleted: number;
  essentialTotal: number;
  /** Real workspace has reached meaningful first value (domain truth only). */
  isActivated: boolean;
  /** User has experienced product value in demo mode (does not imply real setup). */
  demoProductExperienced: boolean;
  readyForFirstValue: boolean;
};

/**
 * Core value actions — at least one must be true for real workspace activation.
 * Content-first: AI generation or publication. Analytics-first: observations or insight.
 */
const CORE_VALUE_MILESTONES: ActivationMilestoneKey[] = [
  "first_ai_generation_completed",
  "first_publication_scheduled",
  "first_analytics_observation",
  "first_recommendation_generated",
];

export function buildMilestoneSnapshot(input: ActivationStatusInput): ActivationMilestoneState[] {
  return Object.entries(input.milestones).map(([key, complete]) => {
    const milestoneKey = key as ActivationMilestoneKey;
    const essential = ESSENTIAL_SETUP_MILESTONES.includes(
      milestoneKey as (typeof ESSENTIAL_SETUP_MILESTONES)[number],
    );

    let inProgress = false;
    let summary: string | undefined;

    if (milestoneKey === "first_provider_connected" && input.syncInProgress && complete) {
      inProgress = true;
      summary = "Initial sync is running.";
    }

    if (milestoneKey === "minimum_brand_knowledge" && complete) {
      summary = "Essential brand context is available.";
    }

    if (milestoneKey === "first_recommendation_generated" && complete) {
      summary = "A Cresco recommendation or data-gap insight is available.";
    }

    return {
      key: milestoneKey,
      label: ACTIVATION_MILESTONE_LABELS[milestoneKey],
      complete,
      essential,
      inProgress,
      summary,
    };
  });
}

export function calculateActivationStatus(input: ActivationStatusInput): ActivationStatusResult {
  const milestones = buildMilestoneSnapshot(input);
  const essentialMilestones = milestones.filter((milestone) => milestone.essential);
  const essentialCompleted = essentialMilestones.filter((milestone) => milestone.complete).length;
  const essentialTotal = essentialMilestones.length;

  const hasWorkspaceFoundation =
    input.milestones.organisation_ready &&
    input.milestones.project_ready &&
    input.milestones.brand_ready;

  const hasRealDataSource = input.milestones.first_provider_connected;

  const hasCoreValueAction = CORE_VALUE_MILESTONES.some((key) => input.milestones[key]);

  const isActivated =
    hasWorkspaceFoundation &&
    input.milestones.minimum_brand_knowledge &&
    hasRealDataSource &&
    hasCoreValueAction;

  const readyForFirstValue =
    hasWorkspaceFoundation &&
    input.milestones.minimum_brand_knowledge &&
    hasRealDataSource;

  let status: ActivationHighLevelStatus = "not_started";

  if (isActivated && essentialCompleted === essentialTotal) {
    status = "completed";
  } else if (isActivated) {
    status = "activated";
  } else if (readyForFirstValue) {
    status = "ready_for_first_value";
  } else if (essentialCompleted > 0 || input.onboardingCompleted) {
    status = "in_progress";
  }

  return {
    status,
    milestones,
    essentialCompleted,
    essentialTotal,
    isActivated,
    demoProductExperienced: input.demoProductExperienced,
    readyForFirstValue,
  };
}

export function createEmptyMilestoneSnapshot(): ActivationMilestoneSnapshot {
  return {
    account_ready: false,
    organisation_ready: false,
    project_ready: false,
    brand_ready: false,
    minimum_brand_knowledge: false,
    first_provider_connected: false,
    initial_sync_complete: false,
    first_content_created: false,
    first_ai_generation_completed: false,
    first_variant_created: false,
    first_approval_completed: false,
    first_publication_scheduled: false,
    first_analytics_observation: false,
    first_recommendation_generated: false,
    first_recommendation_viewed: false,
  };
}
