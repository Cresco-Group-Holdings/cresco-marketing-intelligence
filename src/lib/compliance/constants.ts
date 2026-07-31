import type { CompliancePolicyCategory, ComplianceRiskLevel } from "@prisma/client";

/** Technical check types that cannot be overridden. */
export const NON_OVERRIDABLE_RULE_KEYS = new Set([
  "UNSUPPORTED_PLATFORM_FORMAT",
  "EXPIRED_ASSET_LICENCE",
  "MISSING_COMMERCIAL_USE_PERMISSION",
]);

export const COMPLIANCE_DISCLAIMER =
  "Compliance review assists human reviewers. It does not replace legal review.";

export const RISK_LEVEL_ORDER: ComplianceRiskLevel[] = [
  "INFO",
  "LOW",
  "MEDIUM",
  "HIGH",
  "BLOCKING",
];

export const CATEGORY_LABELS: Record<CompliancePolicyCategory, string> = {
  BRAND: "Brand",
  FINANCIAL: "Financial",
  GRANTS: "Grants",
  PRIVACY: "Privacy",
  COPYRIGHT: "Copyright",
  LICENSING: "Licensing",
  PLATFORM: "Platform",
  ACCESSIBILITY: "Accessibility",
  ADVERTISING: "Advertising",
  AI_DISCLOSURE: "AI disclosure",
};

export function isNonOverridable(ruleKey: string): boolean {
  return NON_OVERRIDABLE_RULE_KEYS.has(ruleKey);
}

export function riskLevelBlocks(riskLevel: ComplianceRiskLevel, isBlocking: boolean): boolean {
  return isBlocking && riskLevel === "BLOCKING";
}
