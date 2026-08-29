export type BillingPreviewState =
  | "current-plan"
  | "usage"
  | "upgrade"
  | "limit-reached"
  | "payment-failed"
  | "cancelled";

export const BILLING_PREVIEW_FIXTURE = {
  summary: {
    billingStatus: "ACTIVE",
    plan: {
      key: "professional",
      displayName: "Pro",
      monthlyPriceCents: 14900,
      annualPriceCents: 149900,
    },
    subscription: {
      status: "ACTIVE",
      billingInterval: "MONTHLY",
      currentPeriodEnd: "2026-09-14T00:00:00.000Z",
      cancelAtPeriodEnd: false,
    },
    trial: null,
  },
  usage: [
    {
      meterKey: "ai.tokens",
      displayName: "AI content generations",
      unit: "tokens",
      allowance: 1_000_000,
      used: 184_000,
      remaining: 816_000,
      period: "BILLING_PERIOD",
    },
    {
      meterKey: "provider.connections",
      displayName: "Connected accounts",
      unit: "accounts",
      allowance: 10,
      used: 5,
      remaining: 5,
      period: "LIFETIME",
    },
    {
      meterKey: "brands.max",
      displayName: "Brands",
      unit: "brands",
      allowance: 5,
      used: 3,
      remaining: 2,
      period: "LIFETIME",
    },
  ],
  plans: [
    { key: "starter", displayName: "Starter", description: "For small teams", version: { monthlyPriceCents: 4900, annualPriceCents: 49900, trialDays: 0 } },
    { key: "professional", displayName: "Pro", description: "For growing teams", version: { monthlyPriceCents: 14900, annualPriceCents: 149900, trialDays: 0 } },
    { key: "business", displayName: "Organisation", description: "For agencies", version: { monthlyPriceCents: 39900, annualPriceCents: 399900, trialDays: 0 } },
  ],
};

export function billingPreviewStateFixture(state: BillingPreviewState) {
  const base = structuredClone(BILLING_PREVIEW_FIXTURE);
  switch (state) {
    case "payment-failed":
      base.summary.subscription!.status = "PAST_DUE";
      return base;
    case "cancelled":
      base.summary.subscription!.cancelAtPeriodEnd = true;
      return base;
    case "limit-reached":
      base.usage = base.usage.map((meter, index) =>
        index === 0 ? { ...meter, used: meter.allowance, remaining: 0 } : meter,
      );
      return base;
    case "upgrade":
      base.summary.plan = { key: "starter", displayName: "Starter", monthlyPriceCents: 4900, annualPriceCents: 49900 };
      return base;
    default:
      return base;
  }
}
