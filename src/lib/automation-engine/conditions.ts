import { AUTOMATION_CONDITION_FIELDS, AUTOMATION_CONDITION_OPERATORS } from "./constants";

export type AutomationConditionInput = {
  field: string;
  operator: string;
  value?: unknown;
};

export type AutomationEventPayload = Record<string, unknown>;

function getNestedValue(payload: AutomationEventPayload, field: string): unknown {
  const parts = field.split(".");
  let current: unknown = payload;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function validateCondition(condition: AutomationConditionInput): { valid: boolean; error?: string } {
  if (!(AUTOMATION_CONDITION_FIELDS as readonly string[]).includes(condition.field)) {
    return { valid: false, error: `Unsupported condition field: ${condition.field}` };
  }
  if (!(AUTOMATION_CONDITION_OPERATORS as readonly string[]).includes(condition.operator)) {
    return { valid: false, error: `Unsupported operator: ${condition.operator}` };
  }
  return { valid: true };
}

export function evaluateCondition(
  condition: AutomationConditionInput,
  payload: AutomationEventPayload,
): boolean {
  const validation = validateCondition(condition);
  if (!validation.valid) return false;

  const actual = getNestedValue(payload, condition.field);
  const expected = condition.value;

  switch (condition.operator) {
    case "equals":
      return actual === expected;
    case "not_equals":
      return actual !== expected;
    case "greater_than":
      return Number(actual) > Number(expected);
    case "less_than":
      return Number(actual) < Number(expected);
    case "greater_or_equal":
      return Number(actual) >= Number(expected);
    case "less_or_equal":
      return Number(actual) <= Number(expected);
    case "in":
      return Array.isArray(expected) && expected.includes(actual);
    case "exists":
      return actual !== undefined && actual !== null;
    default:
      return false;
  }
}

export function evaluateAllConditions(
  conditions: AutomationConditionInput[],
  payload: AutomationEventPayload,
): boolean {
  if (conditions.length === 0) return true;
  return conditions.every((condition) => evaluateCondition(condition, payload));
}
