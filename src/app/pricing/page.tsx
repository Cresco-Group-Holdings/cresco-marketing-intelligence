import Link from "next/link";
import { DEFAULT_PLAN_CATALOG } from "@/lib/billing/plan-catalog";
import { BILLING_CURRENCY, formatPlanPrice, LAUNCH_PLAN_KEYS, SELF_SERVICE_PLAN_KEYS } from "@/lib/billing/commercial-config";
import { PricingPageAnalytics } from "@/components/billing/pricing-page-analytics";

const COMPARISON_FEATURES = [
  { label: "Team seats", key: "users.max" },
  { label: "Brands", key: "brands.max" },
  { label: "Connected accounts", key: "provider.connections.max" },
  { label: "AI content generations", key: "ai.tokens_monthly" },
  { label: "Monthly publications", key: "publications.monthly" },
];

export default function PricingPage() {
  const plans = DEFAULT_PLAN_CATALOG.filter((plan) =>
    SELF_SERVICE_PLAN_KEYS.includes(plan.key as (typeof SELF_SERVICE_PLAN_KEYS)[number]),
  );

  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <PricingPageAnalytics />
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Plans that grow with your marketing</h1>
        <p className="mt-3 text-muted-foreground">
          Choose the plan that fits your team. Upgrade anytime as your channels and content scale.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Prices shown in {BILLING_CURRENCY}. Billed monthly unless annual billing is selected at checkout.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => (
          <section
            key={plan.key}
            className={`rounded-xl border p-6 ${plan.key === LAUNCH_PLAN_KEYS.PRO ? "border-primary shadow-sm" : ""}`}
          >
            <h2 className="text-xl font-semibold">{plan.displayName}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
            <p className="mt-6 text-3xl font-semibold">
              {formatPlanPrice(plan.monthlyPriceCents)}
              {plan.monthlyPriceCents > 0 ? <span className="text-base font-normal text-muted-foreground"> / month</span> : null}
            </p>
            <ul className="mt-6 space-y-2 text-sm">
              {COMPARISON_FEATURES.map((feature) => {
                const entitlement = plan.entitlements.find((e) => e.entitlementKey === feature.key);
                const value =
                  entitlement?.valueType === "BOOLEAN"
                    ? entitlement.booleanValue
                      ? "Included"
                      : "—"
                    : entitlement?.limitValue?.toLocaleString() ?? "—";
                return (
                  <li key={feature.key} className="flex justify-between gap-4">
                    <span className="text-muted-foreground">{feature.label}</span>
                    <span className="font-medium">{value}</span>
                  </li>
                );
              })}
            </ul>
            <div className="mt-8">
              <Link
                href="/settings/billing"
                className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                {plan.key === LAUNCH_PLAN_KEYS.STARTER ? "Start with Starter" : `Choose ${plan.displayName}`}
              </Link>
            </div>
          </section>
        ))}
      </div>

      <p className="mt-10 text-center text-sm text-muted-foreground">
        Already a customer? <Link href="/settings/billing" className="underline">Manage your subscription</Link>.
      </p>
    </main>
  );
}
