import { isStripeBillingConfigured } from "@/server/providers/billing/stripe-billing-provider";
import { isProductionRuntime } from "@/lib/providers/oauth/runtime";

/**
 * Launch policy: self-service Stripe checkout is intentionally disabled until
 * production Stripe credentials and price IDs are certified.
 */
export function isBillingSelfServiceLaunchEnabled(): boolean {
  return process.env.BILLING_SELF_SERVICE_LAUNCH_ENABLED === "true";
}

/** Whether checkout/portal actions may be offered in the current runtime. */
export function isBillingSelfServiceAvailable(): boolean {
  if (!isBillingSelfServiceLaunchEnabled()) {
    return false;
  }
  if (isProductionRuntime()) {
    return isStripeBillingConfigured();
  }
  return isStripeBillingConfigured() || process.env.ALLOW_BILLING_MOCK === "true";
}

export function assertBillingSelfServiceAvailable(): void {
  if (!isBillingSelfServiceAvailable()) {
    throw new Error(
      "Self-service billing is not available. Paid plans are informational at launch; contact sales to upgrade.",
    );
  }
}
