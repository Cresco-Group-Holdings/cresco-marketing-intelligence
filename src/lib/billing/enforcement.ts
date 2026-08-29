import { AppError } from "@/lib/errors";
import type { EntitlementCheckResult } from "@/lib/billing/errors";
import { mapEntitlementResultToUserMessage } from "@/lib/billing/user-facing-errors";
import { entitlementService } from "@/server/services/entitlement-service";
import type { EntitlementCheckInput } from "@/server/services/entitlement-service";

export async function enforceCommercialEntitlement(
  input: EntitlementCheckInput,
  options?: { currentPlanKey?: string },
): Promise<EntitlementCheckResult> {
  const result = await entitlementService.check(input);
  if (result.allowed) return result;

  const userFacing = mapEntitlementResultToUserMessage(result, options?.currentPlanKey);
  throw new AppError(result.code ?? "PLAN_LIMIT_EXCEEDED", userFacing.message, {
    status: result.code === "PAYMENT_ACTION_REQUIRED" ? 402 : 403,
    details: {
      commercial: {
        title: userFacing.title,
        ctaLabel: userFacing.ctaLabel,
        ctaHref: userFacing.ctaHref,
        secondaryCtaLabel: userFacing.secondaryCtaLabel,
        secondaryCtaHref: userFacing.secondaryCtaHref,
        entitlement: result.entitlement,
        currentUsage: result.currentUsage,
        allowance: result.allowance,
        upgradePlanKey: result.upgradePlanKey,
      },
    },
  });
}
