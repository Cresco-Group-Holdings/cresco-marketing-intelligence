import type { RevenueCohortDimension } from "@prisma/client";

export const REVENUE_DISCLAIMER =
  "Revenue metrics use documented formulas and may differ from provider dashboards. LTV requires an explicit methodology.";

export const FORMULA_DEFINITIONS = {
  totalRevenue: "Sum of payment transaction original amounts in period.",
  newRevenue: "Revenue from customers whose first payment occurred in period.",
  recurringRevenue: "Revenue from existing customers with active subscriptions.",
  expansionRevenue: "Increase in MRR from existing customers upgrading plans.",
  contractionRevenue: "Decrease in MRR from downgrades or partial cancellations.",
  refunds: "Sum of refund transaction amounts (stored separately, never overwrites originals).",
  netRevenue: "totalRevenue - refunds - credits.",
  mrr: "Sum of normalised monthly recurring amounts from active subscriptions.",
  arr: "MRR × 12.",
  arpc: "netRevenue / unique paying customers in period.",
  cac: "Total acquisition spend / new customers acquired in period.",
  blendedCac: "Total marketing spend / all new customers.",
  paidCac: "Paid media spend / customers attributed to paid channels.",
  ltv: "Requires explicit methodology — not calculated by default.",
  ltvCacRatio: "LTV / CAC when both are defined.",
  paybackMonths: "CAC / (ARPC × gross margin) when gross margin is configured.",
  trialToPaid: "Customers converting from trial to paid / total trial starts.",
} as const;

export const COHORT_DIMENSIONS = [
  "SIGNUP_MONTH",
  "ACQUISITION_CHANNEL",
  "CAMPAIGN",
  "FIRST_TOUCH",
  "LAST_TOUCH",
  "PRODUCT",
  "PLAN",
  "COUNTRY",
  "CUSTOMER_TYPE",
] as const satisfies readonly RevenueCohortDimension[];
