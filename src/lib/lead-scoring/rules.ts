import {
  MAX_POINTS_PER_RULE,
  RULE_OPERATORS,
  type RuleOperator,
  type ScoringSignal,
  type SignalCategory,
} from "./constants";
import {
  isApprovedSignal,
  isProhibitedAttribute,
  resolveSignalValue,
  type LeadSnapshot,
} from "./signals";

export type ScoringRule = {
  id: string;
  signal: ScoringSignal;
  field?: string;
  operator: RuleOperator;
  value?: unknown;
  points: number;
  enabled?: boolean;
  label?: string;
};

export type RuleGroup = {
  id: string;
  category: SignalCategory;
  logic: "AND" | "OR";
  rules: ScoringRule[];
  cap?: number;
};

export type RuleEvidence = {
  ruleId: string;
  signal: ScoringSignal;
  matched: boolean;
  points: number;
  cappedPoints: number;
  actualValue: unknown;
  expectedValue?: unknown;
  operator: RuleOperator;
  label?: string;
};

export type RuleEvaluationResult = {
  matched: boolean;
  points: number;
  evidence: RuleEvidence;
};

export type RuleGroupEvaluationResult = {
  groupId: string;
  category: SignalCategory;
  matched: boolean;
  rawPoints: number;
  cappedPoints: number;
  capApplied: boolean;
  evidence: RuleEvidence[];
};

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

function asDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

export function isValidRuleOperator(operator: string): operator is RuleOperator {
  return (RULE_OPERATORS as readonly string[]).includes(operator);
}

function compareValues(
  actual: unknown,
  operator: RuleOperator,
  expected: unknown,
  isTagField: boolean,
): boolean {
  switch (operator) {
    case "exists": {
      if (isTagField) return Array.isArray(actual) && actual.length > 0;
      if (typeof actual === "boolean") return actual === true;
      if (typeof actual === "number") return actual > 0;
      return actual !== undefined && actual !== null && String(actual).length > 0;
    }
    case "eq":
      return String(actual ?? "") === String(expected ?? "");
    case "ne":
      return String(actual ?? "") !== String(expected ?? "");
    case "in":
      return asStringArray(expected).includes(String(actual ?? ""));
    case "not_in":
      return !asStringArray(expected).includes(String(actual ?? ""));
    case "gt": {
      const left = asNumber(actual);
      const right = asNumber(expected);
      return left !== null && right !== null && left > right;
    }
    case "gte": {
      const left = asNumber(actual);
      const right = asNumber(expected);
      return left !== null && right !== null && left >= right;
    }
    case "lt": {
      const left = asNumber(actual);
      const right = asNumber(expected);
      return left !== null && right !== null && left < right;
    }
    case "lte": {
      const left = asNumber(actual);
      const right = asNumber(expected);
      return left !== null && right !== null && left <= right;
    }
    case "contains": {
      if (isTagField && Array.isArray(actual)) {
        return actual.map(String).includes(String(expected ?? ""));
      }
      return String(actual ?? "")
        .toLowerCase()
        .includes(String(expected ?? "").toLowerCase());
    }
    default:
      return false;
  }
}

export function evaluateRule(rule: ScoringRule, snapshot: LeadSnapshot): RuleEvaluationResult {
  const enabled = rule.enabled !== false;
  const points = Math.min(Math.abs(rule.points), MAX_POINTS_PER_RULE) * Math.sign(rule.points || 0);

  if (!enabled || !isApprovedSignal(rule.signal)) {
    return {
      matched: false,
      points: 0,
      evidence: {
        ruleId: rule.id,
        signal: rule.signal,
        matched: false,
        points: 0,
        cappedPoints: 0,
        actualValue: undefined,
        expectedValue: rule.value,
        operator: rule.operator,
        label: rule.label,
      },
    };
  }

  if (rule.field && isProhibitedAttribute(rule.field)) {
    return {
      matched: false,
      points: 0,
      evidence: {
        ruleId: rule.id,
        signal: rule.signal,
        matched: false,
        points: 0,
        cappedPoints: 0,
        actualValue: undefined,
        expectedValue: rule.value,
        operator: rule.operator,
        label: rule.label,
      },
    };
  }

  const actual = resolveSignalValue(snapshot, rule.signal);
  const isTagField = rule.signal === "TAG_FIT" || rule.signal === "NEGATIVE_TAG" || rule.signal === "COMPETITOR_TAG";
  const matched = isValidRuleOperator(rule.operator)
    ? compareValues(actual, rule.operator, rule.value, isTagField)
    : false;

  const awardedPoints = matched ? points : 0;

  return {
    matched,
    points: awardedPoints,
    evidence: {
      ruleId: rule.id,
      signal: rule.signal,
      matched,
      points: awardedPoints,
      cappedPoints: awardedPoints,
      actualValue: actual,
      expectedValue: rule.value,
      operator: rule.operator,
      label: rule.label,
    },
  };
}

function applyCap(rawPoints: number, cap: number | undefined, category: SignalCategory): {
  cappedPoints: number;
  capApplied: boolean;
} {
  if (cap === undefined) {
    return { cappedPoints: rawPoints, capApplied: false };
  }

  if (category === "NEGATIVE") {
    const capped = Math.max(rawPoints, cap);
    return { cappedPoints: capped, capApplied: capped !== rawPoints };
  }

  const capped = Math.min(rawPoints, cap);
  return { cappedPoints: capped, capApplied: capped !== rawPoints };
}

export function evaluateRuleGroup(
  group: RuleGroup,
  snapshot: LeadSnapshot,
): RuleGroupEvaluationResult {
  const enabledRules = group.rules.filter((rule) => rule.enabled !== false);
  const evaluations = enabledRules.map((rule) => evaluateRule(rule, snapshot));
  const evidence = evaluations.map((result) => result.evidence);

  let matched: boolean;
  let rawPoints: number;

  if (!enabledRules.length) {
    matched = false;
    rawPoints = 0;
  } else if (group.logic === "AND") {
    matched = evaluations.every((result) => result.matched);
    rawPoints = matched ? evaluations.reduce((sum, result) => sum + result.points, 0) : 0;
  } else {
    const matchedResults = evaluations.filter((result) => result.matched);
    matched = matchedResults.length > 0;
    rawPoints = matchedResults.reduce((sum, result) => sum + result.points, 0);
  }

  const { cappedPoints, capApplied } = applyCap(rawPoints, group.cap, group.category);

  if (capApplied) {
    const scale = rawPoints !== 0 ? cappedPoints / rawPoints : 0;
    for (const item of evidence) {
      if (item.matched) {
        item.cappedPoints = Math.round(item.points * scale * 1000) / 1000;
      }
    }
  }

  return {
    groupId: group.id,
    category: group.category,
    matched,
    rawPoints,
    cappedPoints,
    capApplied,
    evidence,
  };
}
