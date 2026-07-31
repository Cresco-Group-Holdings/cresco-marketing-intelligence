import type {
  ComplianceInput,
  ComplianceFinding as LegacyFinding,
} from "@/lib/content/compliance";
import { runComplianceChecks } from "@/lib/content/compliance";
import type { CompliancePolicyCategory, ComplianceRiskLevel } from "@prisma/client";
import { isNonOverridable } from "@/lib/compliance/constants";

export type PolicyRuleInput = {
  id: string;
  ruleKey: string;
  category: CompliancePolicyCategory;
  title: string;
  riskLevel: ComplianceRiskLevel;
  isBlocking: boolean;
  canOverride: boolean;
  matchPattern?: string | null;
};

export type PolicyDisclaimerInput = {
  disclaimerText: string;
  isBlocking: boolean;
};

export type DeterministicFinding = {
  ruleKey: string;
  ruleId?: string;
  category: CompliancePolicyCategory;
  riskLevel: ComplianceRiskLevel;
  isBlocking: boolean;
  canOverride: boolean;
  excerpt?: string;
  message: string;
  contentVariantId?: string;
};

const LEGACY_CHECK_TO_RULE_KEY: Record<string, string> = {
  MISSING_DISCLAIMER: "MISSING_REQUIRED_DISCLAIMER",
  PROHIBITED_CLAIM: "PROHIBITED_CLAIM",
  MISSING_DESTINATION_URL: "INVALID_DESTINATION_URL",
  MISSING_ALT_TEXT: "MISSING_ALT_TEXT",
  UNAPPROVED_ASSET: "UNAPPROVED_LOGO",
  EXPIRED_ASSET_LICENCE: "EXPIRED_LICENCE",
  UNSUPPORTED_PLATFORM_FORMAT: "UNSUPPORTED_PLATFORM_FORMAT",
  EXCESSIVE_TEXT_LENGTH: "EXCESSIVE_PLATFORM_LENGTH",
  UNAPPROVED_MUSIC: "MISSING_LICENCE",
  MISSING_CONSENT: "MISSING_CONSENT",
};

function legacyResultToRisk(result: LegacyFinding["result"], blocking: boolean): ComplianceRiskLevel {
  if (blocking && result === "FAIL") return "BLOCKING";
  if (result === "WARNING") return "MEDIUM";
  return "INFO";
}

export function runPolicyRuleChecks(input: {
  contentText: string;
  disclaimer?: string | null;
  rules: PolicyRuleInput[];
  requiredDisclaimers: PolicyDisclaimerInput[];
}): DeterministicFinding[] {
  const findings: DeterministicFinding[] = [];
  const haystack = input.contentText.toLowerCase();

  for (const rule of input.rules) {
    if (!rule.matchPattern) continue;
    const pattern = new RegExp(rule.matchPattern, "i");
    const match = pattern.exec(input.contentText);
    if (match) {
      findings.push({
        ruleKey: rule.ruleKey,
        ruleId: rule.id,
        category: rule.category,
        riskLevel: rule.isBlocking ? "BLOCKING" : rule.riskLevel,
        isBlocking: rule.isBlocking,
        canOverride: rule.canOverride && !isNonOverridable(rule.ruleKey),
        excerpt: match[0],
        message: rule.title,
      });
    }
  }

  if (input.requiredDisclaimers.length > 0) {
    const disclaimerText = input.disclaimer?.trim() ?? "";
    for (const required of input.requiredDisclaimers) {
      const present = required.disclaimerText
        .split(".")
        .some((fragment) => fragment.trim() && disclaimerText.includes(fragment.trim()));
      if (!present) {
        findings.push({
          ruleKey: "MISSING_REQUIRED_DISCLAIMER",
          category: "ADVERTISING",
          riskLevel: required.isBlocking ? "BLOCKING" : "MEDIUM",
          isBlocking: required.isBlocking,
          canOverride: !required.isBlocking,
          message: "Required disclaimer text is missing.",
        });
      }
    }
  }

  return findings;
}

export function runDeterministicComplianceChecks(input: {
  complianceInput: ComplianceInput;
  rules: PolicyRuleInput[];
  requiredDisclaimers: PolicyDisclaimerInput[];
  disclaimer?: string | null;
}): DeterministicFinding[] {
  const legacy = runComplianceChecks(input.complianceInput);
  const contentText = [
    input.complianceInput.primaryMessage ?? "",
    ...input.complianceInput.variants.map((variant) => variant.caption ?? ""),
  ].join("\n");

  const policyFindings = runPolicyRuleChecks({
    contentText,
    disclaimer: input.disclaimer,
    rules: input.rules,
    requiredDisclaimers: input.requiredDisclaimers,
  });

  const legacyFindings: DeterministicFinding[] = legacy.map((finding) => {
    const ruleKey = LEGACY_CHECK_TO_RULE_KEY[finding.checkType] ?? finding.checkType;
    return {
      ruleKey,
      category: mapLegacyCategory(finding.checkType),
      riskLevel: legacyResultToRisk(finding.result, finding.blocking),
      isBlocking: finding.blocking && finding.result === "FAIL",
      canOverride: !isNonOverridable(ruleKey),
      message: finding.message,
      contentVariantId: finding.contentVariantId,
    };
  });

  const merged = new Map<string, DeterministicFinding>();
  for (const finding of [...legacyFindings, ...policyFindings]) {
    const key = `${finding.ruleKey}:${finding.contentVariantId ?? "content"}`;
    merged.set(key, finding);
  }
  return [...merged.values()];
}

function mapLegacyCategory(checkType: LegacyFinding["checkType"]): CompliancePolicyCategory {
  switch (checkType) {
    case "MISSING_DISCLAIMER":
      return "ADVERTISING";
    case "PROHIBITED_CLAIM":
      return "BRAND";
    case "MISSING_DESTINATION_URL":
      return "PLATFORM";
    case "MISSING_ALT_TEXT":
      return "ACCESSIBILITY";
    case "UNAPPROVED_ASSET":
    case "EXPIRED_ASSET_LICENCE":
    case "UNAPPROVED_MUSIC":
      return "LICENSING";
    case "UNSUPPORTED_PLATFORM_FORMAT":
    case "EXCESSIVE_TEXT_LENGTH":
      return "PLATFORM";
    case "MISSING_CONSENT":
      return "PRIVACY";
    default:
      return "BRAND";
  }
}

export function hasOpenBlockingFindings(
  findings: Array<{ isBlocking: boolean; status: string }>,
): boolean {
  return findings.some((finding) => finding.isBlocking && finding.status === "OPEN");
}
