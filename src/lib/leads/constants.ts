import type {
  CrmProvider,
  LeadConsentState,
  LeadCreationSource,
  LeadQualificationProfile,
  MarketingLeadStatus,
} from "@prisma/client";

export const LEAD_DEFAULT_LIST_LIMIT = 25;
export const LEAD_MAX_LIST_LIMIT = 100;
export const LEAD_MAX_NOTE_LENGTH = 2000;
export const LEAD_MAX_INTEREST_LENGTH = 2000;

export const BLOCKED_LEAD_SOURCES: LeadCreationSource[] = [] as LeadCreationSource[];

/** Sources that may create a lead from social engagement. Likes are explicitly excluded. */
export const ALLOWED_SOCIAL_LEAD_SOURCES: LeadCreationSource[] = [
  "SOCIAL_COMMENT",
  "SOCIAL_MESSAGE",
  "SOCIAL_MENTION",
];

export const MARKETING_LEAD_STATUS_LABELS: Record<MarketingLeadStatus, string> = {
  NEW: "New",
  REVIEWING: "Reviewing",
  QUALIFIED: "Qualified",
  UNQUALIFIED: "Unqualified",
  CONTACTED: "Contacted",
  CONVERTED: "Converted",
  CLOSED: "Closed",
  DELETED: "Deleted",
};

export const LEAD_CREATION_SOURCE_LABELS: Record<LeadCreationSource, string> = {
  SOCIAL_COMMENT: "Social comment",
  SOCIAL_MESSAGE: "Social message",
  SOCIAL_MENTION: "Social mention",
  LEAD_FORM: "Lead form",
  LANDING_PAGE_FORM: "Landing page form",
  MANUAL: "Manual entry",
};

export const LEAD_QUALIFICATION_PROFILE_LABELS: Record<LeadQualificationProfile, string> = {
  CRESCO_GRANTS_INTELLIGENCE: "Cresco Grants Intelligence",
  CAPITAL_CRESCO_TERMINAL: "Capital Cresco Terminal",
};

export const LEAD_CONSENT_STATE_LABELS: Record<LeadConsentState, string> = {
  UNKNOWN: "Unknown",
  GRANTED: "Granted",
  DENIED: "Denied",
  WITHDRAWN: "Withdrawn",
};

export const CRM_PROVIDER_LABELS: Record<CrmProvider, string> = {
  HUBSPOT: "HubSpot",
  SALESFORCE: "Salesforce",
  PIPEDRIVE: "Pipedrive",
  CRESCO_INTERNAL: "Cresco CRM",
  WEBHOOK: "Webhook",
  CSV: "CSV export",
  FAKE: "Test adapter",
};

export const QUALIFIED_LEAD_STATUSES: MarketingLeadStatus[] = ["QUALIFIED", "CONTACTED", "CONVERTED"];
