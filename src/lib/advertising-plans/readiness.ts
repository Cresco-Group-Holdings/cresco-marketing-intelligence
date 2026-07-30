import type { AdvertisingReadinessStatus } from "@prisma/client";

export type ReadinessCheckResult = {
  checkType: string;
  status: AdvertisingReadinessStatus;
  severity: string;
  title: string;
  description: string;
  evidence?: Record<string, unknown>;
};

export type PlanReadinessInput = {
  hasObjective: boolean;
  hasBudget: boolean;
  hasDates: boolean;
  hasAudience: boolean;
  hasDestination: boolean;
  domainVerified: boolean;
  hasPrimaryConversion: boolean;
  trackingVerified: boolean;
  hasApprovedCreative: boolean;
  validUtm: boolean;
  providerAccountAvailable: boolean;
  currencyMatch: boolean;
  complianceReviewed: boolean;
  requiredApprovalsComplete: boolean;
  creativeFormatCompatible: boolean;
  unsupportedObjective: boolean;
};

export function evaluatePlanReadiness(input: PlanReadinessInput): ReadinessCheckResult[] {
  const checks: ReadinessCheckResult[] = [];

  const add = (
    checkType: string,
    condition: boolean,
    title: string,
    description: string,
    severity = "HIGH",
  ) => {
    if (!condition) {
      checks.push({
        checkType,
        status: severity === "LOW" ? "NEEDS_ATTENTION" : "NOT_READY",
        severity,
        title,
        description,
      });
    }
  };

  add("missing_objective", input.hasObjective, "Missing objective", "Campaign objective is required.");
  add("missing_budget", input.hasBudget, "Missing budget", "At least one budget allocation is required.");
  add("missing_dates", input.hasDates, "Missing dates", "Campaign start and end dates are required.");
  add("missing_audience", input.hasAudience, "Missing audience", "At least one audience plan is required.");
  add("missing_destination", input.hasDestination, "Missing destination", "At least one destination is required.");
  add("unverified_domain", input.domainVerified, "Unverified domain", "Destination domain is not verified.", "MEDIUM");
  add("missing_primary_conversion", input.hasPrimaryConversion, "Missing primary conversion", "Primary conversion goal is required.");
  add("unverified_tracking", input.trackingVerified, "Unverified tracking", "Conversion tracking is not verified.", "MEDIUM");
  add("missing_approved_creative", input.hasApprovedCreative, "Missing approved creative", "At least one approved creative is required.");
  add("invalid_utm", input.validUtm, "Invalid UTM", "UTM template is missing or invalid.", "LOW");
  add("provider_account_unavailable", input.providerAccountAvailable, "Provider account unavailable", "Required ad account is not connected.", "HIGH");
  add("currency_mismatch", input.currencyMatch, "Currency mismatch", "Budget currency does not match account currency.", "MEDIUM");
  add("compliance_review_missing", input.complianceReviewed, "Compliance review missing", "Compliance approval is required.", "HIGH");
  add("required_approval_missing", input.requiredApprovalsComplete, "Approvals incomplete", "Not all required approvals are complete.", "HIGH");
  add("creative_format_incompatible", input.creativeFormatCompatible, "Creative format incompatible", "Creative format is incompatible with selected channel.", "MEDIUM");
  add("unsupported_provider_objective", !input.unsupportedObjective, "Unsupported objective", "Objective is not supported on selected channel.", "HIGH");

  return checks;
}

export function aggregateReadinessStatus(checks: ReadinessCheckResult[]): AdvertisingReadinessStatus {
  if (checks.some((c) => c.status === "NOT_READY")) return "NOT_READY";
  if (checks.some((c) => c.status === "NEEDS_ATTENTION")) return "NEEDS_ATTENTION";
  if (checks.length === 0) return "READY_TO_LAUNCH";
  return "READY_FOR_REVIEW";
}
