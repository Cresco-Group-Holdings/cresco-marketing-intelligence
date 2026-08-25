import type { EntitlementCheckResult } from "@/lib/billing/errors";
import { LAUNCH_PLAN_KEYS } from "@/lib/billing/commercial-config";
import { ENTITLEMENT_KEYS } from "@/lib/billing/entitlements";

const ENTITLEMENT_LABELS: Record<string, string> = {
  [ENTITLEMENT_KEYS.BRANDS_MAX]: "brands",
  [ENTITLEMENT_KEYS.USERS_MAX]: "team seats",
  [ENTITLEMENT_KEYS.PROVIDER_CONNECTIONS_MAX]: "connected accounts",
  [ENTITLEMENT_KEYS.AI_TOKENS_MONTHLY]: "AI generations",
  [ENTITLEMENT_KEYS.PUBLICATIONS_MONTHLY]: "publications",
  [ENTITLEMENT_KEYS.AUTOMATION_EXECUTIONS_MONTHLY]: "automation executions",
  [ENTITLEMENT_KEYS.CAMPAIGNS_MAX_ACTIVE]: "active campaigns",
  [ENTITLEMENT_KEYS.PROJECTS_MAX]: "projects",
};

const PLAN_LABELS: Record<string, string> = {
  [LAUNCH_PLAN_KEYS.FREE]: "Free",
  [LAUNCH_PLAN_KEYS.STARTER]: "Starter",
  [LAUNCH_PLAN_KEYS.PRO]: "Pro",
  [LAUNCH_PLAN_KEYS.ORGANISATION]: "Organisation",
  [LAUNCH_PLAN_KEYS.ENTERPRISE]: "Enterprise",
};

function resourceLabel(entitlement: string): string {
  return ENTITLEMENT_LABELS[entitlement] ?? entitlement.replace(/\./g, " ");
}

function planLabel(planKey?: string): string {
  if (!planKey) return "a higher plan";
  return PLAN_LABELS[planKey] ?? planKey;
}

export type UserFacingCommercialError = {
  title: string;
  message: string;
  ctaLabel: string;
  ctaHref: string;
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
};

export function mapEntitlementResultToUserMessage(
  result: EntitlementCheckResult,
  currentPlanKey?: string,
): UserFacingCommercialError {
  const upgradePlan = result.upgradePlanKey ?? "professional";
  const label = resourceLabel(result.entitlement);
  const currentPlan = planLabel(currentPlanKey);

  if (result.code === "PLAN_LIMIT_EXCEEDED") {
    return {
      title: "Plan limit reached",
      message: `You've reached your ${currentPlan} plan limit of ${result.allowance ?? "—"} ${label}. Upgrade to ${planLabel(upgradePlan)} to add more.`,
      ctaLabel: "Compare plans",
      ctaHref: "/pricing",
      secondaryCtaLabel: "View billing",
      secondaryCtaHref: "/settings/billing",
    };
  }

  if (result.code === "FEATURE_NOT_INCLUDED") {
    return {
      title: "Upgrade required",
      message: `Your ${currentPlan} plan does not include ${label}. Upgrade to ${planLabel(upgradePlan)} to unlock this feature.`,
      ctaLabel: "Compare plans",
      ctaHref: "/pricing",
    };
  }

  if (result.code === "PAYMENT_ACTION_REQUIRED") {
    return {
      title: "Payment needs attention",
      message:
        "We couldn't process your latest subscription payment. Update your billing details to restore full access.",
      ctaLabel: "Update billing details",
      ctaHref: "/settings/billing",
    };
  }

  if (result.code === "TRIAL_EXPIRED") {
    return {
      title: "Trial ended",
      message: "Your trial has ended. Choose a plan to continue using paid features.",
      ctaLabel: "View plans",
      ctaHref: "/pricing",
    };
  }

  if (result.code === "SUBSCRIPTION_INACTIVE") {
    return {
      title: "Subscription inactive",
      message: "Your subscription is not active. Choose a plan to continue.",
      ctaLabel: "View plans",
      ctaHref: "/pricing",
    };
  }

  return {
    title: "Action unavailable",
    message: result.message ?? "This action is not available on your current plan.",
    ctaLabel: "View billing",
    ctaHref: "/settings/billing",
  };
}
