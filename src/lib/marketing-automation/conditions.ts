import {
  CONDITION_FIELDS,
  CONDITION_OPERATORS,
  type ConditionField,
  type ConditionOperator,
} from "./constants";

export const APPROVED_CONDITION_FIELDS: readonly ConditionField[] = CONDITION_FIELDS;

export type AutomationCondition = {
  field: string;
  operator: ConditionOperator;
  value?: unknown;
};

export type LeadSnapshot = {
  leadId: string;
  status?: string;
  lifecycleStage?: string;
  pipelineStage?: string;
  productInterest?: string;
  country?: string;
  language?: string;
  consentMarketing?: boolean;
  sourceType?: string;
  campaign?: string;
  lastActivityAt?: Date | string;
  emailEngagement?: string;
  productEvent?: string;
  subscriptionState?: string;
  dateValue?: string;
  ownerUserId?: string | null;
  tags?: string[];
};

const FIELD_TO_SNAPSHOT: Record<ConditionField, keyof LeadSnapshot | "tags"> = {
  LIFECYCLE: "lifecycleStage",
  LEAD_STATUS: "status",
  OPPORTUNITY_STAGE: "pipelineStage",
  PRODUCT: "productInterest",
  COUNTRY: "country",
  LANGUAGE: "language",
  CONSENT: "consentMarketing",
  SOURCE: "sourceType",
  CAMPAIGN: "campaign",
  ACTIVITY: "lastActivityAt",
  EMAIL_ENGAGEMENT: "emailEngagement",
  PRODUCT_EVENT: "productEvent",
  SUBSCRIPTION_STATE: "subscriptionState",
  DATE: "dateValue",
  OWNER: "ownerUserId",
  TAG: "tags",
};

export function isApprovedConditionField(field: string): field is ConditionField {
  return (APPROVED_CONDITION_FIELDS as readonly string[]).includes(field);
}

export function isValidConditionOperator(operator: string): operator is ConditionOperator {
  return (CONDITION_OPERATORS as readonly string[]).includes(operator);
}

function resolveFieldValue(snapshot: LeadSnapshot, field: ConditionField): unknown {
  const key = FIELD_TO_SNAPSHOT[field];
  if (key === "tags") return snapshot.tags ?? [];
  return snapshot[key];
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return null;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (value === undefined || value === null) return [];
  return [String(value)];
}

export function evaluateCondition(condition: AutomationCondition, snapshot: LeadSnapshot): boolean {
  if (!isApprovedConditionField(condition.field)) return false;
  if (!isValidConditionOperator(condition.operator)) return false;

  const actual = resolveFieldValue(snapshot, condition.field);

  switch (condition.operator) {
    case "exists": {
      if (condition.field === "TAG") return Array.isArray(actual) && actual.length > 0;
      if (condition.field === "CONSENT") return actual === true;
      return actual !== undefined && actual !== null && String(actual).length > 0;
    }
    case "eq":
      return String(actual ?? "") === String(condition.value ?? "");
    case "ne":
      return String(actual ?? "") !== String(condition.value ?? "");
    case "in":
      return asStringArray(condition.value).includes(String(actual ?? ""));
    case "not_in":
      return !asStringArray(condition.value).includes(String(actual ?? ""));
    case "gt": {
      const left = asNumber(actual);
      const right = asNumber(condition.value);
      return left !== null && right !== null && left > right;
    }
    case "lt": {
      const left = asNumber(actual);
      const right = asNumber(condition.value);
      return left !== null && right !== null && left < right;
    }
    case "contains": {
      if (condition.field === "TAG" && Array.isArray(actual)) {
        return actual.map(String).includes(String(condition.value ?? ""));
      }
      return String(actual ?? "").toLowerCase().includes(String(condition.value ?? "").toLowerCase());
    }
    default:
      return false;
  }
}

export function evaluateConditions(
  conditions: AutomationCondition[],
  snapshot: LeadSnapshot,
  logic: "AND" | "OR" = "AND",
): boolean {
  if (!conditions.length) return true;
  return logic === "AND"
    ? conditions.every((c) => evaluateCondition(c, snapshot))
    : conditions.some((c) => evaluateCondition(c, snapshot));
}
