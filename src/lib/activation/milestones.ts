export const ACTIVATION_MILESTONE_KEYS = [
  "account_ready",
  "organisation_ready",
  "project_ready",
  "brand_ready",
  "minimum_brand_knowledge",
  "first_provider_connected",
  "initial_sync_complete",
  "first_content_created",
  "first_ai_generation_completed",
  "first_variant_created",
  "first_approval_completed",
  "first_publication_scheduled",
  "first_analytics_observation",
  "first_recommendation_generated",
  "first_recommendation_viewed",
] as const;

export type ActivationMilestoneKey = (typeof ACTIVATION_MILESTONE_KEYS)[number];

export const ESSENTIAL_SETUP_MILESTONES = [
  "organisation_ready",
  "brand_ready",
  "minimum_brand_knowledge",
  "first_provider_connected",
  "first_content_created",
  "first_publication_scheduled",
  "first_recommendation_generated",
] as const satisfies readonly ActivationMilestoneKey[];

export type EssentialSetupMilestoneKey = (typeof ESSENTIAL_SETUP_MILESTONES)[number];

export const ACTIVATION_MILESTONE_LABELS: Record<ActivationMilestoneKey, string> = {
  account_ready: "Account ready",
  organisation_ready: "Organisation",
  project_ready: "Project",
  brand_ready: "Brand",
  minimum_brand_knowledge: "Brand Knowledge",
  first_provider_connected: "Connect data",
  initial_sync_complete: "Initial sync",
  first_content_created: "Create first content",
  first_ai_generation_completed: "AI content generated",
  first_variant_created: "Channel variant",
  first_approval_completed: "Content approved",
  first_publication_scheduled: "Schedule publication",
  first_analytics_observation: "Analytics available",
  first_recommendation_generated: "First insight",
  first_recommendation_viewed: "Insight reviewed",
};

export type ActivationHighLevelStatus =
  | "not_started"
  | "in_progress"
  | "ready_for_first_value"
  | "activated"
  | "completed";

export type ActivationMilestoneState = {
  key: ActivationMilestoneKey;
  label: string;
  complete: boolean;
  essential: boolean;
  inProgress?: boolean;
  summary?: string;
};

export type ActivationMilestoneSnapshot = Record<ActivationMilestoneKey, boolean>;
