import {
  MAX_POINTS_PER_RULE,
  MAX_RULES_PER_GROUP,
  MAX_RULES_PER_MODEL,
  PROHIBITED_ATTRIBUTES,
  SCORING_DISCLAIMER,
} from "./constants";
import { isApprovedSignal, isProhibitedAttribute, validateSignal } from "./signals";
import type { RuleGroup, ScoringRule } from "./rules";
import type { ScoringModel } from "./scoring";

export type RuleSafetyResult = {
  safe: boolean;
  issues: string[];
};

export type ModelSafetyResult = {
  safe: boolean;
  issues: string[];
  checklist: ModelReviewChecklistItem[];
};

export type ModelReviewChecklistItem = {
  id: string;
  label: string;
  passed: boolean;
  detail?: string;
};

export const MODEL_REVIEW_CHECKLIST: Array<{
  id: string;
  label: string;
  evaluate: (model: ScoringModel) => { passed: boolean; detail?: string };
}> = [
  {
    id: "has_fit_rules",
    label: "Model includes at least one fit rule group",
    evaluate: (model) => ({
      passed: model.ruleGroups.some((g) => g.category === "FIT" && g.rules.length > 0),
      detail: "Fit signals establish ICP alignment.",
    }),
  },
  {
    id: "has_engagement_rules",
    label: "Model includes at least one engagement rule group",
    evaluate: (model) => ({
      passed: model.ruleGroups.some((g) => g.category === "ENGAGEMENT" && g.rules.length > 0),
      detail: "Engagement signals capture buying intent.",
    }),
  },
  {
    id: "no_prohibited_attributes",
    label: "No rules reference prohibited attributes",
    evaluate: (model) => {
      const violations = collectProhibitedFieldViolations(model);
      return {
        passed: violations.length === 0,
        detail: violations.length > 0 ? violations.join("; ") : undefined,
      };
    },
  },
  {
    id: "caps_configured",
    label: "Score caps are configured for all categories",
    evaluate: (model) => {
      const hasGroupCaps = model.ruleGroups.some((g) => g.cap !== undefined);
      const hasModelCaps =
        model.scoreCaps !== undefined || model.categoryCaps !== undefined;
      return {
        passed: hasGroupCaps || hasModelCaps,
        detail: "Caps prevent runaway score inflation.",
      };
    },
  },
  {
    id: "negative_signals_present",
    label: "Negative signals are defined to handle disqualification",
    evaluate: (model) => ({
      passed: model.ruleGroups.some((g) => g.category === "NEGATIVE" && g.rules.length > 0),
      detail: "Negative rules reduce score for suppressed or disqualified leads.",
    }),
  },
  {
    id: "rule_count_within_limits",
    label: "Total rule count is within platform limits",
    evaluate: (model) => {
      const totalRules = model.ruleGroups.reduce((sum, g) => sum + g.rules.length, 0);
      return {
        passed: totalRules <= MAX_RULES_PER_MODEL,
        detail: `${totalRules} rules (max ${MAX_RULES_PER_MODEL}).`,
      };
    },
  },
  {
    id: "deterministic_only",
    label: "Model uses deterministic rule-based scoring only",
    evaluate: () => ({
      passed: true,
      detail: SCORING_DISCLAIMER,
    }),
  },
];

function collectProhibitedFieldViolations(model: ScoringModel): string[] {
  const violations: string[] = [];

  for (const group of model.ruleGroups) {
    for (const rule of group.rules) {
      if (rule.field && isProhibitedAttribute(rule.field)) {
        violations.push(`Rule ${rule.id} references prohibited field "${rule.field}"`);
      }
    }
  }

  return violations;
}

export function validateRuleSafety(rule: ScoringRule): RuleSafetyResult {
  const issues: string[] = [];

  if (!isApprovedSignal(rule.signal)) {
    issues.push(`Unknown signal: ${rule.signal}`);
  }

  if (rule.field && isProhibitedAttribute(rule.field)) {
    issues.push(`Field "${rule.field}" is a prohibited attribute.`);
  }

  const signalCheck = validateSignal(rule.signal, rule.field);
  issues.push(...signalCheck.issues);

  if (Math.abs(rule.points) > MAX_POINTS_PER_RULE) {
    issues.push(`Rule points ${rule.points} exceed maximum of ${MAX_POINTS_PER_RULE}.`);
  }

  if (rule.points === 0) {
    issues.push("Rule awards zero points and will have no effect.");
  }

  return { safe: issues.length === 0, issues };
}

export function validateRuleGroupSafety(group: RuleGroup): RuleSafetyResult {
  const issues: string[] = [];

  if (group.rules.length > MAX_RULES_PER_GROUP) {
    issues.push(`Group ${group.id} exceeds maximum of ${MAX_RULES_PER_GROUP} rules.`);
  }

  if (!group.rules.length) {
    issues.push(`Group ${group.id} has no rules.`);
  }

  for (const rule of group.rules) {
    const result = validateRuleSafety(rule);
    issues.push(...result.issues.map((issue) => `[${rule.id}] ${issue}`));
  }

  return { safe: issues.length === 0, issues };
}

export function validateModelSafety(model: ScoringModel): ModelSafetyResult {
  const issues: string[] = [];

  if (!model.ruleGroups.length) {
    issues.push("Model has no rule groups.");
  }

  const totalRules = model.ruleGroups.reduce((sum, g) => sum + g.rules.length, 0);
  if (totalRules > MAX_RULES_PER_MODEL) {
    issues.push(`Model has ${totalRules} rules, exceeding maximum of ${MAX_RULES_PER_MODEL}.`);
  }

  for (const group of model.ruleGroups) {
    const result = validateRuleGroupSafety(group);
    issues.push(...result.issues);
  }

  const checklist: ModelReviewChecklistItem[] = MODEL_REVIEW_CHECKLIST.map((item) => {
    const result = item.evaluate(model);
    return {
      id: item.id,
      label: item.label,
      passed: result.passed,
      detail: result.detail,
    };
  });

  const failedChecklist = checklist.filter((item) => !item.passed);
  for (const item of failedChecklist) {
    if (item.id !== "negative_signals_present") {
      issues.push(`Checklist failed: ${item.label}`);
    }
  }

  return {
    safe: issues.length === 0,
    issues,
    checklist,
  };
}

export function listProhibitedAttributes(): readonly string[] {
  return PROHIBITED_ATTRIBUTES;
}

export { SCORING_DISCLAIMER };
