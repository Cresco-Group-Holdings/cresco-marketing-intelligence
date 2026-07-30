import { TRIGGER_TYPES, type TriggerType } from "./constants";

export type TriggerEvent = {
  type: TriggerType;
  occurredAt: Date;
  payload: Record<string, unknown>;
};

export type TriggerConfig = {
  triggerType: TriggerType;
  formId?: string;
  formType?: string;
  sourceTypes?: string[];
  productInterests?: string[];
  fromStatus?: string;
  toStatus?: string;
  fromLifecycle?: string;
  toLifecycle?: string;
  pipelineId?: string;
  stageId?: string;
  emailEventType?: string;
  websiteEventType?: string;
  contentKey?: string;
  segmentId?: string;
  scheduledAt?: string;
};

export function isValidTriggerType(value: string): value is TriggerType {
  return (TRIGGER_TYPES as readonly string[]).includes(value);
}

export function validateTriggerConfig(config: TriggerConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!isValidTriggerType(config.triggerType)) {
    errors.push(`Invalid trigger type: ${config.triggerType}`);
    return { valid: false, errors };
  }

  switch (config.triggerType) {
    case "FORM_SUBMITTED":
      if (!config.formId && !config.formType) {
        errors.push("FORM_SUBMITTED trigger requires formId or formType.");
      }
      break;
    case "LEAD_STATUS_CHANGED":
      if (!config.fromStatus && !config.toStatus) {
        errors.push("LEAD_STATUS_CHANGED trigger requires fromStatus or toStatus.");
      }
      break;
    case "LIFECYCLE_CHANGED":
      if (!config.fromLifecycle && !config.toLifecycle) {
        errors.push("LIFECYCLE_CHANGED trigger requires fromLifecycle or toLifecycle.");
      }
      break;
    case "PIPELINE_STAGE_CHANGED":
      if (!config.pipelineId && !config.stageId) {
        errors.push("PIPELINE_STAGE_CHANGED trigger requires pipelineId or stageId.");
      }
      break;
    case "EMAIL_EVENT":
      if (!config.emailEventType) {
        errors.push("EMAIL_EVENT trigger requires emailEventType.");
      }
      break;
    case "WEBSITE_EVENT":
      if (!config.websiteEventType) {
        errors.push("WEBSITE_EVENT trigger requires websiteEventType.");
      }
      break;
    case "CONTENT_DOWNLOADED":
      if (!config.contentKey) {
        errors.push("CONTENT_DOWNLOADED trigger requires contentKey.");
      }
      break;
    case "SCHEDULED_SEGMENT_CHECK":
      if (!config.segmentId) {
        errors.push("SCHEDULED_SEGMENT_CHECK trigger requires segmentId.");
      }
      break;
    default:
      break;
  }

  return { valid: errors.length === 0, errors };
}

function matchesStringFilter(actual: unknown, expected?: string): boolean {
  if (expected === undefined) return true;
  return String(actual ?? "") === expected;
}

function matchesArrayFilter(actual: unknown, expected?: string[]): boolean {
  if (!expected?.length) return true;
  return expected.includes(String(actual ?? ""));
}

export function matchTrigger(config: TriggerConfig, event: TriggerEvent): boolean {
  if (config.triggerType !== event.type) return false;

  const payload = event.payload;

  switch (config.triggerType) {
    case "FORM_SUBMITTED":
      return (
        matchesStringFilter(payload.formId, config.formId) &&
        matchesStringFilter(payload.formType, config.formType)
      );
    case "LEAD_CREATED":
      return (
        matchesArrayFilter(payload.sourceType, config.sourceTypes) &&
        matchesArrayFilter(payload.productInterest, config.productInterests)
      );
    case "LEAD_STATUS_CHANGED":
      return (
        matchesStringFilter(payload.fromStatus, config.fromStatus) &&
        matchesStringFilter(payload.toStatus, config.toStatus)
      );
    case "LIFECYCLE_CHANGED":
      return (
        matchesStringFilter(payload.fromLifecycle, config.fromLifecycle) &&
        matchesStringFilter(payload.toLifecycle, config.toLifecycle)
      );
    case "PIPELINE_STAGE_CHANGED":
      return (
        matchesStringFilter(payload.pipelineId, config.pipelineId) &&
        matchesStringFilter(payload.stageId, config.stageId)
      );
    case "EMAIL_EVENT":
      return matchesStringFilter(payload.emailEventType, config.emailEventType);
    case "WEBSITE_EVENT":
      return matchesStringFilter(payload.websiteEventType, config.websiteEventType);
    case "CONTENT_DOWNLOADED":
      return matchesStringFilter(payload.contentKey, config.contentKey);
    case "DEMO_REQUESTED":
    case "TRIAL_STARTED":
    case "TRIAL_ENDING":
    case "SUBSCRIPTION_STARTED":
    case "PAYMENT_FAILED":
    case "SUBSCRIPTION_CANCELLED":
    case "CUSTOMER_INACTIVE":
    case "DATE_REACHED":
    case "MANUAL_ENROLLMENT":
      return true;
    case "SCHEDULED_SEGMENT_CHECK":
      return matchesStringFilter(payload.segmentId, config.segmentId);
    default:
      return false;
  }
}
