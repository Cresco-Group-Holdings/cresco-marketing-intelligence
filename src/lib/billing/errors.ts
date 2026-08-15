import type { AppErrorCode } from "@/lib/errors";

export type EntitlementCheckResult = {
  allowed: boolean;
  code?: AppErrorCode;
  message?: string;
  entitlement: string;
  currentUsage?: number;
  allowance?: number | null;
  upgradePlanKey?: string;
};

export function buildLimitExceededResult(input: {
  entitlement: string;
  currentUsage: number;
  allowance: number;
  upgradePlanKey?: string;
}): EntitlementCheckResult {
  return {
    allowed: false,
    code: "PLAN_LIMIT_EXCEEDED",
    message: `Plan limit exceeded for ${input.entitlement}. Current usage: ${input.currentUsage}, allowance: ${input.allowance}.`,
    entitlement: input.entitlement,
    currentUsage: input.currentUsage,
    allowance: input.allowance,
    upgradePlanKey: input.upgradePlanKey,
  };
}

export function buildFeatureNotIncludedResult(entitlement: string): EntitlementCheckResult {
  return {
    allowed: false,
    code: "FEATURE_NOT_INCLUDED",
    message: `Your plan does not include ${entitlement}.`,
    entitlement,
  };
}
