import { scanContentSafety } from "@/lib/ai/content-safety";
import { runLongFormComplianceChecks, hasBlockingComplianceFindings } from "@/lib/long-form/compliance-rules";

export type AdCreativeComplianceFinding = {
  ruleId: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "BLOCKING";
  message: string;
  fieldKey?: string;
  blocking: boolean;
};

const SUPERLATIVE_PATTERN = /\b(best|#1|number one|guaranteed|always|never fails|100%)\b/i;
const URGENCY_PATTERN = /\b(act now|limited time only|expires today|last chance|hurry)\b/i;
const HEALTH_CLAIM_PATTERN = /\b(cure|treats?|heals?|medical|diagnos)\b/i;
const EMPLOYMENT_CLAIM_PATTERN = /\b(guaranteed job|hire immediately|earn \$\d+)\b/i;
const PERSONAL_ATTRIBUTE_PATTERN = /\b(you are (over|under) \d+|people like you who)\b/i;
const BEFORE_AFTER_PATTERN = /\b(before and after|transformed in \d+ days)\b/i;

export function runAdCreativeComplianceChecks(input: {
  copyText: string;
  brandSlug?: string;
  prohibitedClaims?: string[];
  complianceRules?: Array<{ id: string; title: string; ruleText: string; severity: string }>;
}): AdCreativeComplianceFinding[] {
  const findings: AdCreativeComplianceFinding[] = [];
  const text = input.copyText;

  for (const claim of input.prohibitedClaims ?? []) {
    if (claim && text.toLowerCase().includes(claim.toLowerCase())) {
      findings.push({
        ruleId: "prohibited-claim",
        severity: "BLOCKING",
        message: `Copy may contain prohibited claim: ${claim}`,
        blocking: true,
      });
    }
  }

  if (SUPERLATIVE_PATTERN.test(text)) {
    findings.push({
      ruleId: "unsupported-superlative",
      severity: "MEDIUM",
      message: "Copy contains unsupported superlative or guarantee language.",
      blocking: false,
    });
  }

  if (URGENCY_PATTERN.test(text)) {
    findings.push({
      ruleId: "deceptive-urgency",
      severity: "MEDIUM",
      message: "Copy may use deceptive urgency language.",
      blocking: false,
    });
  }

  if (HEALTH_CLAIM_PATTERN.test(text)) {
    findings.push({
      ruleId: "health-claim",
      severity: "HIGH",
      message: "Copy may contain restricted health claims.",
      blocking: true,
    });
  }

  if (EMPLOYMENT_CLAIM_PATTERN.test(text)) {
    findings.push({
      ruleId: "employment-claim",
      severity: "HIGH",
      message: "Copy may contain unsupported employment or income claims.",
      blocking: true,
    });
  }

  if (PERSONAL_ATTRIBUTE_PATTERN.test(text)) {
    findings.push({
      ruleId: "personal-attribute-targeting",
      severity: "BLOCKING",
      message: "Copy may use personal-attribute targeting language restricted by providers.",
      blocking: true,
    });
  }

  if (BEFORE_AFTER_PATTERN.test(text)) {
    findings.push({
      ruleId: "before-after-claim",
      severity: "HIGH",
      message: "Copy may contain misleading before/after claims.",
      blocking: true,
    });
  }

  for (const flag of scanContentSafety(text)) {
    findings.push({
      ruleId: flag.code,
      severity: flag.severity === "critical" ? "BLOCKING" : "MEDIUM",
      message: flag.message,
      blocking: flag.requiresReview,
    });
  }

  const longFormFindings = runLongFormComplianceChecks(text, {
    brandSlug: input.brandSlug,
    prohibitedClaims: input.prohibitedClaims,
    complianceRules: input.complianceRules,
  });

  for (const lf of longFormFindings) {
    findings.push({
      ruleId: lf.ruleId,
      severity: lf.severity === "BLOCKING" ? "BLOCKING" : "HIGH",
      message: lf.message,
      blocking: lf.severity === "BLOCKING",
    });
  }

  return findings;
}

export function hasBlockingAdComplianceFindings(findings: AdCreativeComplianceFinding[]): boolean {
  return findings.some((f) => f.blocking) || hasBlockingComplianceFindings(
    findings.map((f) => ({ ruleId: f.ruleId, severity: f.severity === "BLOCKING" ? "BLOCKING" as const : "WARNING" as const, message: f.message })),
  );
}
