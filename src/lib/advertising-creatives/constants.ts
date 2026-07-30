import type { AdvertisingCreativeProjectStatus } from "@prisma/client";

export const CREATIVE_PROJECT_STATUS_TRANSITIONS: Record<
  AdvertisingCreativeProjectStatus,
  AdvertisingCreativeProjectStatus[]
> = {
  DRAFT: ["GENERATING", "IN_REVIEW", "ARCHIVED"],
  GENERATING: ["DRAFT", "IN_REVIEW", "ARCHIVED"],
  IN_REVIEW: ["APPROVED", "CHANGES_REQUESTED", "ARCHIVED"],
  CHANGES_REQUESTED: ["DRAFT", "GENERATING", "IN_REVIEW", "ARCHIVED"],
  APPROVED: ["ARCHIVED"],
  ARCHIVED: [],
};

export const CONCEPT_CATEGORIES = [
  "PROBLEM_SOLUTION",
  "BENEFIT_LED",
  "EVIDENCE_LED",
  "PRODUCT_DEMONSTRATION",
  "CUSTOMER_STORY",
  "COMPARISON",
  "EDUCATIONAL",
  "FOUNDER_LED",
  "URGENCY",
  "OBJECTION_HANDLING",
  "SOCIAL_PROOF",
  "FEATURE_HIGHLIGHT",
] as const;

export const REVIEW_ROLES = [
  "MARKETER",
  "BRAND_OWNER",
  "COMPLIANCE_REVIEWER",
  "BUDGET_OWNER",
  "CLIENT_APPROVER",
] as const;

export const SYNTHETIC_IMAGE_DISCLAIMER =
  "AI-generated image. Not a real customer, office, result, or event unless explicitly sourced and labelled.";
