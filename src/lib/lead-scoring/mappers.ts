import { createHash } from "crypto";
import type {
  LeadScoreType,
  LeadScoringDecayType,
  LeadScoringQualificationStatus,
  LeadScoringRuleOperator,
  LeadScoringSignalCategory,
  Prisma,
} from "@prisma/client";
import type { QualificationStatus, RuleOperator } from "@/lib/lead-scoring/constants";
import type { RuleGroup, ScoringModel, ScoringRule } from "@/lib/lead-scoring/scoring";

export type SaveRuleInput = {
  id?: string;
  signal: string;
  signalCategory: LeadScoringSignalCategory;
  operator: string;
  value?: Prisma.InputJsonValue;
  scoreEffect: number;
  maxContribution?: number;
  decayType?: LeadScoringDecayType;
  decayHalfLifeDays?: number;
  windowDays?: number;
  evidence?: string;
  isActive?: boolean;
  allowDecay?: boolean;
};

export type SaveRuleGroupInput = {
  id?: string;
  name: string;
  scoreType: LeadScoreType;
  maxGroupContribution?: number;
  sortOrder?: number;
  rules: SaveRuleInput[];
};

export function dbOperatorToLib(operator: LeadScoringRuleOperator): RuleOperator {
  return operator.toLowerCase() as RuleOperator;
}

export function libOperatorToDb(operator: string): LeadScoringRuleOperator {
  return operator.toUpperCase() as LeadScoringRuleOperator;
}

export function scoreTypeToCategory(scoreType: LeadScoreType): LeadScoringSignalCategory {
  switch (scoreType) {
    case "FIT_SCORE":
    case "PRODUCT_READINESS_SCORE":
      return "FIT";
    case "ENGAGEMENT_SCORE":
    case "INTENT_SCORE":
    case "RELATIONSHIP_SCORE":
      return "ENGAGEMENT";
    case "RISK_SCORE":
      return "NEGATIVE";
    default:
      return "FIT";
  }
}

export function categoryToScoreType(category: LeadScoringSignalCategory): LeadScoreType {
  switch (category) {
    case "FIT":
      return "FIT_SCORE";
    case "ENGAGEMENT":
      return "ENGAGEMENT_SCORE";
    case "NEGATIVE":
      return "RISK_SCORE";
    default:
      return "FIT_SCORE";
  }
}

export function mapLibQualificationToDb(status: QualificationStatus): LeadScoringQualificationStatus {
  return status as LeadScoringQualificationStatus;
}

export function hashRuleGroups(groups: SaveRuleGroupInput[]): string {
  const canonical = groups.map((group) => ({
    name: group.name,
    scoreType: group.scoreType,
    maxGroupContribution: group.maxGroupContribution ?? null,
    sortOrder: group.sortOrder ?? 0,
    rules: group.rules.map((rule) => ({
      signal: rule.signal,
      signalCategory: rule.signalCategory,
      operator: rule.operator,
      value: rule.value ?? null,
      scoreEffect: rule.scoreEffect,
      maxContribution: rule.maxContribution ?? null,
      decayType: rule.decayType ?? "NONE",
      decayHalfLifeDays: rule.decayHalfLifeDays ?? null,
      windowDays: rule.windowDays ?? null,
      isActive: rule.isActive ?? true,
      allowDecay: rule.allowDecay ?? true,
    })),
  }));

  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

type VersionRuleGroup = {
  id: string;
  scoreType: LeadScoreType;
  maxGroupContribution: number | null;
  rules: Array<{
    id: string;
    signal: string;
    operator: LeadScoringRuleOperator;
    value: Prisma.JsonValue;
    scoreEffect: number;
    evidence: string | null;
    isActive: boolean;
    signalCategory: LeadScoringSignalCategory;
  }>;
};

export function buildScoringModelFromGroups(
  modelId: string,
  modelName: string,
  versionNumber: number,
  groups: VersionRuleGroup[],
): ScoringModel {
  const ruleGroups: RuleGroup[] = groups.map((group) => ({
    id: group.id,
    category: scoreTypeToCategory(group.scoreType),
    logic: "OR",
    cap: group.maxGroupContribution ?? undefined,
    rules: group.rules
      .filter((rule) => rule.isActive)
      .map(
        (rule): ScoringRule => ({
          id: rule.id,
          signal: rule.signal as ScoringRule["signal"],
          operator: dbOperatorToLib(rule.operator),
          value: rule.value ?? undefined,
          points: rule.scoreEffect,
          enabled: rule.isActive,
          label: rule.evidence ?? undefined,
        }),
      ),
  }));

  return {
    id: modelId,
    name: modelName,
    version: String(versionNumber),
    ruleGroups,
  };
}

export function buildScoringModelFromInput(
  modelId: string,
  modelName: string,
  groups: SaveRuleGroupInput[],
): ScoringModel {
  return buildScoringModelFromGroups(
    modelId,
    modelName,
    1,
    groups.map((group, index) => ({
      id: group.id ?? `group-${index}`,
      scoreType: group.scoreType,
      maxGroupContribution: group.maxGroupContribution ?? null,
      rules: group.rules.map((rule, ruleIndex) => ({
        id: rule.id ?? `rule-${index}-${ruleIndex}`,
        signal: rule.signal,
        operator: libOperatorToDb(rule.operator),
        value: (rule.value as Prisma.JsonValue) ?? null,
        scoreEffect: rule.scoreEffect,
        evidence: rule.evidence ?? null,
        isActive: rule.isActive ?? true,
        signalCategory: rule.signalCategory,
      })),
    })),
  );
}
