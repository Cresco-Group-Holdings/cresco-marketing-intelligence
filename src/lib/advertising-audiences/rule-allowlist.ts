export const APPROVED_RULE_KEYS = [
  "event_occurred",
  "page_viewed",
  "content_viewed",
  "form_submitted",
  "signup_status",
  "trial_status",
  "subscription_status",
  "lead_stage",
  "last_activity_date",
  "campaign_interaction",
  "geographic_country",
  "language",
  "product",
  "plan",
  "customer_value_band",
] as const;

export type ApprovedRuleKey = (typeof APPROVED_RULE_KEYS)[number];

export type AudienceRuleInput = {
  ruleKey: string;
  operator: string;
  value: unknown;
  logicGroup?: string;
};

export function isApprovedRuleKey(key: string): key is ApprovedRuleKey {
  return (APPROVED_RULE_KEYS as readonly string[]).includes(key);
}

export function validateRule(rule: AudienceRuleInput): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!isApprovedRuleKey(rule.ruleKey)) {
    errors.push(`Rule key "${rule.ruleKey}" is not in the approved allowlist.`);
  }
  if (!rule.operator) {
    errors.push("Operator is required.");
  }
  if (rule.value === undefined || rule.value === null) {
    errors.push("Value is required.");
  }
  return { valid: errors.length === 0, errors };
}

export function evaluateRule(rule: AudienceRuleInput, context: Record<string, unknown>): boolean {
  if (!isApprovedRuleKey(rule.ruleKey)) return false;
  const fieldValue = context[rule.ruleKey];
  switch (rule.operator) {
    case "EQUALS":
      return fieldValue === rule.value;
    case "NOT_EQUALS":
      return fieldValue !== rule.value;
    case "IN":
      return Array.isArray(rule.value) && rule.value.includes(fieldValue);
    case "NOT_IN":
      return Array.isArray(rule.value) && !rule.value.includes(fieldValue);
    case "IS_TRUE":
      return fieldValue === true;
    case "IS_FALSE":
      return fieldValue === false;
    case "GREATER_THAN":
      return typeof fieldValue === "number" && typeof rule.value === "number" && fieldValue > rule.value;
    case "LESS_THAN":
      return typeof fieldValue === "number" && typeof rule.value === "number" && fieldValue < rule.value;
    case "OCCURRED_WITHIN":
      return Boolean(fieldValue);
    default:
      return false;
  }
}
