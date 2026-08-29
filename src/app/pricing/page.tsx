import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { MarketingShell } from "@/components/layout/marketing-shell";
import { PricingPageAnalytics } from "@/components/billing/pricing-page-analytics";
import { DEFAULT_PLAN_CATALOG } from "@/lib/billing/plan-catalog";
import {
  BILLING_CURRENCY,
  formatPlanPrice,
  LAUNCH_PLAN_KEYS,
  SELF_SERVICE_PLAN_KEYS,
} from "@/lib/billing/commercial-config";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Cresco Marketing Intelligence pricing — plans aligned with in-app entitlements for teams of every size.",
};

const COMPARISON_FEATURES = [
  { label: "Team seats", key: "users.max" },
  { label: "Brands", key: "brands.max" },
  { label: "Connected accounts", key: "provider.connections.max" },
  { label: "AI content generations", key: "ai.tokens_monthly" },
  { label: "Monthly publications", key: "publications.monthly" },
] as const;

export default function PricingPage() {
  const plans = DEFAULT_PLAN_CATALOG.filter((plan) =>
    SELF_SERVICE_PLAN_KEYS.includes(plan.key as (typeof SELF_SERVICE_PLAN_KEYS)[number]),
  );

  return (
    <MarketingShell activeNav="pricing">
      <PricingPageAnalytics />
      <section className="border-b border-border bg-surface-subtle">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="max-w-2xl">
            <h1 className="text-4xl font-semibold tracking-tight text-foreground">Pricing</h1>
            <p className="mt-4 text-lg text-foreground-muted">
              Plans that match what you can actually do in Cresco. Upgrade anytime as your channels
              and content scale.
            </p>
            <p className="mt-2 text-sm text-foreground-subtle">
              Prices shown in {BILLING_CURRENCY}. Billed monthly unless annual billing is selected
              at checkout.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.key}
              className={`flex flex-col rounded-xl border p-6 shadow-sm ${
                plan.key === LAUNCH_PLAN_KEYS.PRO
                  ? "border-paid-accent bg-surface-elevated ring-1 ring-paid-accent/30"
                  : "border-border bg-surface-elevated"
              }`}
            >
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-foreground">{plan.displayName}</h2>
                <p className="mt-2 text-sm text-foreground-muted">{plan.description}</p>
                <p className="mt-6 text-3xl font-semibold text-foreground">
                  {formatPlanPrice(plan.monthlyPriceCents)}
                  {plan.monthlyPriceCents > 0 ? (
                    <span className="text-base font-normal text-foreground-subtle"> / month</span>
                  ) : null}
                </p>
                <ul className="mt-6 space-y-2 text-sm text-foreground-muted">
                  {COMPARISON_FEATURES.map((feature) => {
                    const entitlement = plan.entitlements.find(
                      (entry) => entry.entitlementKey === feature.key,
                    );
                    const value =
                      entitlement?.valueType === "BOOLEAN"
                        ? entitlement.booleanValue
                          ? "Included"
                          : "—"
                        : (entitlement?.limitValue?.toLocaleString() ?? "—");
                    return (
                      <li key={feature.key} className="flex justify-between gap-4">
                        <span>{feature.label}</span>
                        <span className="font-medium text-foreground">{value}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div className="mt-8">
                <ButtonLink
                  href="/signup"
                  variant={plan.key === LAUNCH_PLAN_KEYS.PRO ? "primary" : "outline"}
                  className="w-full"
                >
                  {plan.key === LAUNCH_PLAN_KEYS.STARTER
                    ? "Start with Starter"
                    : `Choose ${plan.displayName}`}
                </ButtonLink>
              </div>
            </article>
          ))}
        </div>
        <p className="mt-10 text-sm text-foreground-subtle">
          Already a customer?{" "}
          <Link href="/settings/billing" className="font-medium text-foreground hover:underline">
            Manage your subscription
          </Link>
          . Final billing is confirmed at checkout.
        </p>
      </section>
    </MarketingShell>
  );
}
