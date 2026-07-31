export type RoutingCondition = {
  field?: string;
  operator: "eq" | "neq" | "in" | "exists";
  value?: string | string[];
};

export type RoutingRule = {
  name: string;
  priority: number;
  conditions: RoutingCondition[];
  actionType: string;
  actionConfig: Record<string, unknown>;
};

export type RoutingContext = {
  formType?: string;
  brandId?: string;
  country?: string;
  language?: string;
  companySize?: string;
  productInterest?: string;
  fieldValues?: Record<string, string>;
};

function matchesCondition(condition: RoutingCondition, ctx: RoutingContext): boolean {
  const val = condition.field ? ctx.fieldValues?.[condition.field] ?? (ctx as Record<string, unknown>)[condition.field ?? ""] : undefined;
  switch (condition.operator) {
    case "eq":
      return String(val) === String(condition.value);
    case "neq":
      return String(val) !== String(condition.value);
    case "in":
      return Array.isArray(condition.value) && condition.value.includes(String(val));
    case "exists":
      return val !== undefined && val !== null && String(val).length > 0;
    default:
      return false;
  }
}

export function evaluateRoutingRules(
  rules: RoutingRule[],
  ctx: RoutingContext,
): RoutingRule | null {
  const sorted = [...rules].sort((a, b) => a.priority - b.priority);
  for (const rule of sorted) {
    if (rule.conditions.every((c) => matchesCondition(c, ctx))) return rule;
  }
  return null;
}
