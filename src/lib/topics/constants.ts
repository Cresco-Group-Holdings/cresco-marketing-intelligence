/** Priority scoring version — bump when formula changes. */
export const PRIORITY_SCORE_VERSION = "1.0";

/** Max graph nodes returned to UI for performance. */
export const CLUSTER_GRAPH_MAX_NODES = 120;

/** Weight map for priority factors (only applied when data exists). */
export const PRIORITY_FACTOR_WEIGHTS = {
  businessRelevance: 0.15,
  impressions: 0.15,
  existingPosition: 0.1,
  conversionRelevance: 0.1,
  contentGap: 0.15,
  competitorCoverage: 0.1,
  pageWeakness: 0.1,
  implementationEffort: 0.05,
  strategicImportance: 0.1,
} as const;

export const ROADMAP_TRANSITIONS: Record<string, string[]> = {
  IDEA: ["RESEARCH", "ARCHIVED"],
  RESEARCH: ["BRIEF_REQUIRED", "IDEA", "ARCHIVED"],
  BRIEF_REQUIRED: ["BRIEF_READY", "RESEARCH", "ARCHIVED"],
  BRIEF_READY: ["DRAFTING", "BRIEF_REQUIRED", "ARCHIVED"],
  DRAFTING: ["REVIEW", "BRIEF_READY", "ARCHIVED"],
  REVIEW: ["PUBLISH_READY", "DRAFTING", "ARCHIVED"],
  PUBLISH_READY: ["PUBLISHED", "REVIEW", "ARCHIVED"],
  PUBLISHED: ["REFRESH_REQUIRED", "ARCHIVED"],
  REFRESH_REQUIRED: ["DRAFTING", "ARCHIVED"],
  ARCHIVED: [],
};
