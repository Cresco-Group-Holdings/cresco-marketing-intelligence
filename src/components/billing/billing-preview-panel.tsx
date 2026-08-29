"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button";
import { formatPlanPrice } from "@/lib/billing/commercial-config";
import type { BillingPreviewState } from "@/lib/billing/billing-preview-fixture";
import { billingPreviewStateFixture } from "@/lib/billing/billing-preview-fixture";

function statusBadgeVariant(status: string): "default" | "muted" | "warning" {
  if (status === "ACTIVE" || status === "TRIALING") return "default";
  if (status === "PAST_DUE" || status === "UNPAID") return "warning";
  return "muted";
}

export function BillingPreviewPanel({ state }: { state: BillingPreviewState }) {
  const account = billingPreviewStateFixture(state);
  const subscriptionStatus = account.summary.subscription?.status ?? "ACTIVE";

  return (
    <div data-billing-preview={state}>
      <PageHeader
        title="Billing"
        description="Manage your subscription, usage limits, and invoices."
        breadcrumbs={[{ label: "Settings", href: "/settings" }, { label: "Billing" }]}
      />

      {state === "limit-reached" ? (
        <Card className="mb-4 border-amber-200 bg-amber-50" data-testid="billing-limit-banner">
          <CardContent className="pt-6 text-sm text-amber-900">
            <p className="font-medium">You&apos;ve reached your connected account limit.</p>
            <p className="mt-1">Starter includes up to 3 connected accounts. Upgrade to Pro to connect more channels.</p>
            <div className="mt-3 flex gap-2">
              <ButtonLink href="/pricing" size="sm">Compare plans</ButtonLink>
              <ButtonLink href="/settings/connections" variant="outline" size="sm">Manage connections</ButtonLink>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card data-testid="billing-current-plan-card">
          <CardHeader>
            <CardTitle>Current plan</CardTitle>
            <CardDescription>Subscription status and billing period.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium">{account.summary.plan?.displayName ?? "Free"}</span>
              <Badge variant={statusBadgeVariant(subscriptionStatus)}>{subscriptionStatus}</Badge>
            </div>
            {account.summary.plan?.monthlyPriceCents ? (
              <p className="text-foreground-muted">
                {formatPlanPrice(account.summary.plan.monthlyPriceCents)} / month
              </p>
            ) : null}
            {state === "payment-failed" ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
                <p className="font-medium">Payment needs attention</p>
                <p className="mt-1 text-xs">
                  We couldn&apos;t process your latest subscription payment. Your workspace remains available during the grace period.
                </p>
                <Button className="mt-3" size="sm">Update billing details</Button>
              </div>
            ) : null}
            {account.summary.subscription ? (
              <p className="text-foreground-muted">
                Renews {new Date(account.summary.subscription.currentPeriodEnd).toLocaleDateString()}
                {account.summary.subscription.cancelAtPeriodEnd ? " (scheduled to end)" : ""}
              </p>
            ) : null}
            {state === "cancelled" ? (
              <Button variant="outline" size="sm" data-testid="resume-subscription-button">
                Resume subscription
              </Button>
            ) : (
              <Button variant="outline" size="sm">Manage subscription</Button>
            )}
          </CardContent>
        </Card>

        <Card data-testid="billing-usage-card">
          <CardHeader>
            <CardTitle>Usage overview</CardTitle>
            <CardDescription>Current consumption against plan allowances.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {account.usage.map((meter) => {
              const pct = meter.allowance > 0 ? Math.min(100, (meter.used / meter.allowance) * 100) : 0;
              return (
                <div key={meter.meterKey}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{meter.displayName}</span>
                    <span className={pct >= 100 ? "font-medium text-amber-700" : "text-foreground-muted"}>
                      {meter.used.toLocaleString()} / {meter.allowance.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-hover">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {state === "upgrade" || state === "current-plan" ? (
        <Card className="mt-4" data-testid="billing-upgrade-card">
          <CardHeader>
            <CardTitle>Change plan</CardTitle>
            <CardDescription>Compare plans and upgrade when you need more capacity.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            {account.plans.map((plan) => (
              <div key={plan.key} className="rounded-lg border p-4">
                <p className="font-medium">{plan.displayName}</p>
                <p className="mt-2 text-sm text-foreground-muted">
                  {formatPlanPrice(plan.version?.monthlyPriceCents ?? 0)} / month
                </p>
                <Button className="mt-4 w-full" size="sm" variant={plan.key === "professional" ? "primary" : "outline"}>
                  {plan.key === account.summary.plan?.key ? "Current plan" : "Upgrade"}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
