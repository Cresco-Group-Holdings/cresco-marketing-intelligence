/** Canonical outbound provider operation types for the publication execution layer. */
export const OUTBOUND_OPERATIONS = [
  "SOCIAL_PUBLISH_POST",
  "SOCIAL_SCHEDULE_POST",
  "SOCIAL_PUBLISH_IMAGE",
  "SOCIAL_PUBLISH_VIDEO",
  "SOCIAL_PUBLISH_MULTI_ASSET",
  "SOCIAL_CANCEL_SCHEDULED",
  "SOCIAL_GET_STATUS",
  "AD_CREATE_DRAFT_CAMPAIGN",
  "AD_CREATE_AD_GROUP",
  "AD_CREATE_AD_DRAFT",
  "AD_UPLOAD_CREATIVE",
  "AD_PAUSE",
  "AD_RESUME",
  "AD_UPDATE_BUDGET",
  "EMAIL_CREATE_DRAFT",
  "EMAIL_CREATE_CONTENT",
  "EMAIL_SELECT_AUDIENCE",
  "EMAIL_SCHEDULE",
  "EMAIL_CANCEL",
  "EMAIL_GET_STATUS",
  "CALENDAR_CREATE_EVENT",
  "CALENDAR_UPDATE_EVENT",
] as const;

export type OutboundOperationType = (typeof OUTBOUND_OPERATIONS)[number];

export const WRITE_OPERATIONS_REQUIRING_APPROVAL = new Set<OutboundOperationType>([
  "SOCIAL_PUBLISH_POST",
  "SOCIAL_SCHEDULE_POST",
  "SOCIAL_PUBLISH_IMAGE",
  "SOCIAL_PUBLISH_VIDEO",
  "SOCIAL_PUBLISH_MULTI_ASSET",
  "AD_CREATE_DRAFT_CAMPAIGN",
  "AD_CREATE_AD_GROUP",
  "AD_CREATE_AD_DRAFT",
  "AD_UPLOAD_CREATIVE",
  "AD_PAUSE",
  "AD_RESUME",
  "AD_UPDATE_BUDGET",
  "EMAIL_SCHEDULE",
  "CALENDAR_CREATE_EVENT",
  "CALENDAR_UPDATE_EVENT",
]);

export const BUDGET_OPERATIONS = new Set<OutboundOperationType>(["AD_UPDATE_BUDGET"]);

export function operationToCapability(operation: OutboundOperationType): string {
  if (operation.startsWith("SOCIAL_")) return "SOCIAL_CONTENT_PUBLISH";
  if (operation.startsWith("AD_")) return "AD_CAMPAIGNS_WRITE";
  if (operation.startsWith("EMAIL_")) return "EMAIL_CAMPAIGNS_WRITE";
  if (operation.startsWith("CALENDAR_")) return "CALENDAR_EVENTS_WRITE";
  return "SOCIAL_CONTENT_PUBLISH";
}

export function isOutboundOperation(value: string): value is OutboundOperationType {
  return (OUTBOUND_OPERATIONS as readonly string[]).includes(value);
}
