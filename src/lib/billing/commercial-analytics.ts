import { logger } from "@/lib/logging";

export type CommercialAnalyticsEvent =
  | "pricing_viewed"
  | "checkout_started"
  | "checkout_completed"
  | "subscription_started"
  | "trial_started"
  | "upgrade_started"
  | "upgrade_completed"
  | "downgrade"
  | "cancellation_requested"
  | "subscription_cancelled"
  | "subscription_resumed"
  | "usage_limit_warning"
  | "usage_limit_reached"
  | "payment_failed"
  | "subscription_reconciled";

export function trackCommercialEvent(
  event: CommercialAnalyticsEvent,
  properties: Record<string, string | number | boolean | null | undefined> = {},
) {
  logger.info("commercial.analytics", {
    event,
    ...properties,
  });
}
