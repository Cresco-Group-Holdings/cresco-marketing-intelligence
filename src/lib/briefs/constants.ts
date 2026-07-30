/** Allowed schema types for suggestions — no rich-result guarantees. */
export const ALLOWED_SCHEMA_TYPES = [
  "Article",
  "FAQPage",
  "HowTo",
  "SoftwareApplication",
  "Organization",
  "BreadcrumbList",
  "Product",
] as const;

export const BRIEF_MAX_COMPETITOR_EXCERPT = 200;
export const BRIEF_MAX_HEADING_LENGTH = 120;

export const BRIEF_STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["GENERATED", "ARCHIVED"],
  GENERATED: ["IN_REVIEW", "DRAFT", "ARCHIVED"],
  IN_REVIEW: ["APPROVED", "CHANGES_REQUESTED", "ARCHIVED"],
  CHANGES_REQUESTED: ["GENERATED", "IN_REVIEW", "ARCHIVED"],
  APPROVED: ["SUPERSEDED", "ARCHIVED"],
  SUPERSEDED: ["ARCHIVED"],
  ARCHIVED: [],
};
