import type { SubscriptionStatus } from "@prisma/client";
import { PAYMENT_GRACE_PERIOD_DAYS } from "@/lib/billing/commercial-config";

export type ProductSubscriptionState =
  | "trialing"
  | "active"
  | "past_due_grace"
  | "past_due_restricted"
  | "cancel_at_period_end"
  | "cancelled"
  | "incomplete"
  | "unpaid"
  | "expired";

export type NormalizedSubscriptionAccess = {
  productState: ProductSubscriptionState;
  entitlementsActive: boolean;
  paymentActionRequired: boolean;
  inGracePeriod: boolean;
  cancelAtPeriodEnd: boolean;
};

export function mapStripeStatusToSubscriptionStatus(stripeStatus: string): SubscriptionStatus {
  const normalized = stripeStatus.toLowerCase();
  switch (normalized) {
    case "active":
      return "ACTIVE";
    case "trialing":
      return "TRIALING";
    case "past_due":
      return "PAST_DUE";
    case "canceled":
    case "cancelled":
      return "CANCELLED";
    case "unpaid":
      return "UNPAID";
    case "incomplete":
    case "incomplete_expired":
      return "INCOMPLETE";
    case "paused":
      return "PAUSED";
    default:
      return "ACTIVE";
  }
}

export function normalizeSubscriptionAccess(input: {
  status: SubscriptionStatus;
  cancelAtPeriodEnd?: boolean;
  pastDueSince?: Date | null;
  trialEndsAt?: Date | null;
}): NormalizedSubscriptionAccess {
  const now = Date.now();

  if (input.status === "TRIALING") {
    const trialExpired = input.trialEndsAt ? input.trialEndsAt.getTime() < now : false;
    return {
      productState: trialExpired ? "expired" : "trialing",
      entitlementsActive: !trialExpired,
      paymentActionRequired: false,
      inGracePeriod: false,
      cancelAtPeriodEnd: Boolean(input.cancelAtPeriodEnd),
    };
  }

  if (input.status === "PAST_DUE" || input.status === "UNPAID") {
    const graceStart = input.pastDueSince?.getTime() ?? now;
    const graceEndsAt = graceStart + PAYMENT_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;
    const inGracePeriod = now < graceEndsAt;
    return {
      productState: inGracePeriod ? "past_due_grace" : "past_due_restricted",
      entitlementsActive: inGracePeriod,
      paymentActionRequired: true,
      inGracePeriod,
      cancelAtPeriodEnd: Boolean(input.cancelAtPeriodEnd),
    };
  }

  if (input.status === "CANCELLED") {
    return {
      productState: "cancelled",
      entitlementsActive: false,
      paymentActionRequired: false,
      inGracePeriod: false,
      cancelAtPeriodEnd: false,
    };
  }

  if (input.status === "INCOMPLETE") {
    return {
      productState: "incomplete",
      entitlementsActive: false,
      paymentActionRequired: true,
      inGracePeriod: false,
      cancelAtPeriodEnd: false,
    };
  }

  if (input.cancelAtPeriodEnd) {
    return {
      productState: "cancel_at_period_end",
      entitlementsActive: true,
      paymentActionRequired: false,
      inGracePeriod: false,
      cancelAtPeriodEnd: true,
    };
  }

  return {
    productState: "active",
    entitlementsActive: input.status === "ACTIVE",
    paymentActionRequired: false,
    inGracePeriod: false,
    cancelAtPeriodEnd: false,
  };
}
