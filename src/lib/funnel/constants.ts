import type {
  FunnelCountingMethod,
  FunnelSegmentDimension,
  FunnelStepRequirement,
  FunnelStepType,
} from "@prisma/client";

export const FUNNEL_DISCLAIMER =
  "Funnel insights are based on observed events and matching rules. Drop-off causes are not inferred without supporting evidence.";

export const COUNTING_METHOD_LABELS: Record<FunnelCountingMethod, string> = {
  USER: "Unique users (identity)",
  SESSION: "Unique sessions",
  EVENT: "Event occurrences",
};

export const STEP_TYPE_LABELS: Record<FunnelStepType, string> = {
  EVENT: "Event",
  CONVERSION: "Conversion",
  PAGE: "Page view",
  CAMPAIGN: "Campaign",
  LEAD_STATUS: "Lead status",
  CRM_STAGE: "CRM stage",
  SUBSCRIPTION_STATUS: "Subscription status",
  PAYMENT_STATUS: "Payment status",
};

export const SEGMENT_DIMENSION_LABELS: Record<FunnelSegmentDimension, string> = {
  CHANNEL: "Channel",
  CAMPAIGN: "Campaign",
  PROVIDER: "Provider",
  LANDING_PAGE: "Landing page",
  DEVICE: "Device",
  COUNTRY: "Country",
  NEW_VS_RETURNING: "New vs returning",
  BRAND: "Brand",
  AUDIENCE: "Audience",
  CONTENT: "Content",
  DATE_COHORT: "Date cohort",
};

export const APPROVED_SEGMENT_DIMENSIONS = [
  "CHANNEL",
  "CAMPAIGN",
  "PROVIDER",
  "LANDING_PAGE",
  "DEVICE",
  "COUNTRY",
  "NEW_VS_RETURNING",
  "BRAND",
  "AUDIENCE",
  "CONTENT",
  "DATE_COHORT",
] as const satisfies readonly FunnelSegmentDimension[];

export const MAX_SEGMENT_CARDINALITY = 50;
export const MAX_JOURNEY_SAMPLES = 10;

export const CRESCO_INTERNAL_ORG_SLUG = "cresco-group";
