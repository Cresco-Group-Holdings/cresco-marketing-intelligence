import type { EmailCampaignStatus, EmailCampaignType } from "@prisma/client";

export const EMAIL_CAMPAIGN_STATUSES: EmailCampaignStatus[] = [
  "DRAFT", "BUILDING", "READY_FOR_REVIEW", "CHANGES_REQUESTED", "APPROVED",
  "SCHEDULED", "SENDING", "SENT", "PARTIALLY_SENT", "CANCELLED", "FAILED", "ARCHIVED",
];

export const EMAIL_CAMPAIGN_TYPES: EmailCampaignType[] = [
  "NEWSLETTER", "PRODUCT_UPDATE", "EDUCATIONAL", "EVENT_INVITATION", "ANNOUNCEMENT",
  "LEAD_NURTURE_BROADCAST", "CUSTOMER_UPDATE", "RE_ENGAGEMENT", "CUSTOM",
];

export const REQUIRED_APPROVAL_TYPES = [
  "AUDIENCE", "CONTENT", "COMPLIANCE", "SCHEDULE", "FINAL_SEND",
] as const;

export const DEFAULT_BATCH_SIZE = 500;
export const MIN_RECIPIENT_COUNT_FOR_SEND = 1;
export const APPROVAL_COUNT_TOLERANCE = 0.05;

export const METRIC_LIMITATIONS = {
  opens: "Open rates are indicative only and may be affected by privacy features and image blocking.",
  clicks: "Click tracking requires enabled policy and may not capture all interactions.",
  conversions: "Conversions require attributable tracking setup.",
  revenue: "Revenue attribution is estimate-based where journey data is incomplete.",
} as const;
