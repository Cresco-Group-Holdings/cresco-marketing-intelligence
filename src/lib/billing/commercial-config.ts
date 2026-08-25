/** Canonical launch plan keys — single source for commercial product tiers. */
export const LAUNCH_PLAN_KEYS = {
  FREE: "free",
  STARTER: "starter",
  PRO: "professional",
  ORGANISATION: "business",
  ENTERPRISE: "enterprise",
} as const;

export type LaunchPlanKey = (typeof LAUNCH_PLAN_KEYS)[keyof typeof LAUNCH_PLAN_KEYS];

/** Paid plans available for self-service checkout. */
export const SELF_SERVICE_PLAN_KEYS: LaunchPlanKey[] = [
  LAUNCH_PLAN_KEYS.STARTER,
  LAUNCH_PLAN_KEYS.PRO,
  LAUNCH_PLAN_KEYS.ORGANISATION,
];

/** Upgrade order for suggesting next plan when a limit is reached. */
export const PLAN_UPGRADE_ORDER: LaunchPlanKey[] = [
  LAUNCH_PLAN_KEYS.FREE,
  LAUNCH_PLAN_KEYS.STARTER,
  LAUNCH_PLAN_KEYS.PRO,
  LAUNCH_PLAN_KEYS.ORGANISATION,
  LAUNCH_PLAN_KEYS.ENTERPRISE,
];

/** Days of continued access after payment failure before restricting paid operations. */
export const PAYMENT_GRACE_PERIOD_DAYS = 7;

/** Usage warning thresholds (percentage of allowance). */
export const USAGE_WARNING_THRESHOLDS = [70, 90, 100] as const;

/**
 * Launch trial policy: infrastructure exists but self-service trial is not enabled at launch.
 * Organisations start on the free plan; upgrade via checkout.
 */
export const TRIAL_ENABLED_AT_LAUNCH = false;

/**
 * Analytics history windows and premium attribution models are not differentiated
 * on the launch pricing page or plan catalogue. These remain post-launch commercial options.
 */
export const LAUNCH_ANALYTICS_HISTORY_GATING_ENABLED = false;
export const LAUNCH_ATTRIBUTION_MODEL_GATING_ENABLED = false;

export const BILLING_CURRENCY = "GBP" as const;

export type StripePriceEnvKeys = {
  monthly: string;
  annual: string;
};

/** Environment variable names for Stripe price IDs per plan key. */
export const STRIPE_PRICE_ENV_BY_PLAN: Record<string, StripePriceEnvKeys> = {
  starter: {
    monthly: "STRIPE_PRICE_STARTER_MONTHLY",
    annual: "STRIPE_PRICE_STARTER_ANNUAL",
  },
  professional: {
    monthly: "STRIPE_PRICE_PRO_MONTHLY",
    annual: "STRIPE_PRICE_PRO_ANNUAL",
  },
  business: {
    monthly: "STRIPE_PRICE_ORGANISATION_MONTHLY",
    annual: "STRIPE_PRICE_ORGANISATION_ANNUAL",
  },
};

export function resolveStripePriceId(planKey: string, interval: "MONTHLY" | "ANNUAL"): string | null {
  const envKeys = STRIPE_PRICE_ENV_BY_PLAN[planKey];
  if (!envKeys) return null;
  const value = process.env[interval === "ANNUAL" ? envKeys.annual : envKeys.monthly];
  return value?.trim() || null;
}

export function resolvePlanKeyFromStripePriceId(priceId: string): string | null {
  for (const [planKey, envKeys] of Object.entries(STRIPE_PRICE_ENV_BY_PLAN)) {
    const monthly = process.env[envKeys.monthly]?.trim();
    const annual = process.env[envKeys.annual]?.trim();
    if (priceId === monthly || priceId === annual) return planKey;
  }
  return null;
}

export function suggestUpgradePlanKey(currentPlanKey: string): string | undefined {
  const index = PLAN_UPGRADE_ORDER.indexOf(currentPlanKey as LaunchPlanKey);
  if (index < 0 || index >= PLAN_UPGRADE_ORDER.length - 1) return undefined;
  return PLAN_UPGRADE_ORDER[index + 1];
}

export function formatPlanPrice(cents: number, currency: string = BILLING_CURRENCY): string {
  if (cents === 0) return "Free";
  const amount = cents / 100;
  if (currency === "GBP") return `£${amount.toFixed(0)}`;
  return `$${amount.toFixed(0)}`;
}
