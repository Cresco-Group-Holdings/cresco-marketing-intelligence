"use client";

import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";
import { formatPlanPrice } from "@/lib/billing/commercial-config";

type BillingAccountResponse = {
  summary: {
    billingStatus: string;
    plan: { key: string; displayName: string; monthlyPriceCents: number; annualPriceCents: number } | null;
    subscription: {
      status: string;
      billingInterval: string;
      currentPeriodEnd: string;
      cancelAtPeriodEnd: boolean;
    } | null;
    trial: { status: string; endsAt: string } | null;
  };
  usage: Array<{
    meterKey: string;
    displayName: string;
    unit: string;
    allowance: number;
    used: number;
    remaining: number;
    period: string;
  }>;
  entitlements: Array<{
    entitlementKey: string;
    valueType: string;
    limitValue: number | null;
    booleanValue: boolean | null;
  }>;
};

type PlanOption = {
  key: string;
  displayName: string;
  description: string;
  version: {
    monthlyPriceCents: number;
    annualPriceCents: number;
    trialDays: number;
  } | null;
};

type InvoiceRow = {
  id: string;
  externalInvoiceRef: string;
  invoiceUrl: string | null;
  amountCents: number;
  currency: string;
  status: string;
  createdAt: string;
};

function formatPrice(cents: number) {
  return formatPlanPrice(cents);
}

function statusBadgeVariant(status: string): "default" | "muted" | "warning" {
  if (status === "ACTIVE" || status === "TRIALING") return "default";
  if (status === "PAST_DUE" || status === "UNPAID") return "warning";
  return "muted";
}

export function BillingSettingsPanel() {
  const { preference } = useWorkspace();
  const organisationId = preference.currentOrganisationId;
  const [account, setAccount] = useState<BillingAccountResponse | null>(null);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [selfServiceCheckoutEnabled, setSelfServiceCheckoutEnabled] = useState(false);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [billingInterval, setBillingInterval] = useState<"MONTHLY" | "ANNUAL">("MONTHLY");

  const load = useCallback(async () => {
    if (!organisationId) return;
    setLoading(true);
    setActionError(null);
    try {
      const [accountData, planData, invoiceData] = await Promise.all([
        apiFetch<BillingAccountResponse>(`/api/billing/account?organisationId=${organisationId}`, {
          organisationId,
        }),
        apiFetch<{ plans: PlanOption[]; selfServiceCheckoutEnabled: boolean }>(`/api/billing/plans?organisationId=${organisationId}`, {
          organisationId,
        }),
        apiFetch<{ invoices: InvoiceRow[] }>(`/api/billing/invoices?organisationId=${organisationId}`, {
          organisationId,
        }).catch(() => ({ invoices: [] })),
      ]);
      setAccount(accountData);
      setPlans(planData.plans);
      setSelfServiceCheckoutEnabled(planData.selfServiceCheckoutEnabled);
      setInvoices(invoiceData.invoices);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to load billing data.");
    } finally {
      setLoading(false);
    }
  }, [organisationId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCheckout(planKey: string) {
    if (!organisationId) return;
    setActionError(null);
    const origin = window.location.origin;
    const result = await apiFetch<{ checkoutUrl: string }>("/api/billing/checkout", {
      method: "POST",
      organisationId,
      body: JSON.stringify({
        planKey,
        billingInterval,
        successUrl: `${origin}/settings/billing?checkout=success`,
        cancelUrl: `${origin}/settings/billing?checkout=cancelled`,
      }),
    });
    window.location.href = result.checkoutUrl;
  }

  async function handlePortal() {
    if (!organisationId) return;
    setActionError(null);
    const result = await apiFetch<{ portalUrl: string }>("/api/billing/portal", {
      method: "POST",
      organisationId,
      body: JSON.stringify({ returnUrl: `${window.location.origin}/settings/billing` }),
    });
    window.location.href = result.portalUrl;
  }

  async function handleChangePlan(planKey: string) {
    if (!organisationId) return;
    setActionError(null);
    await apiFetch("/api/billing/subscription/change", {
      method: "POST",
      organisationId,
      body: JSON.stringify({ planKey, billingInterval }),
    });
    await load();
  }

  async function handleResume() {
    if (!organisationId) return;
    setActionError(null);
    await apiFetch("/api/billing/subscription/resume", {
      method: "POST",
      organisationId,
      body: JSON.stringify({}),
    });
    await load();
  }

  const allowDirectPlanChange = process.env.NODE_ENV !== "production";

  async function handleCancel(immediate = false) {
    if (!organisationId) return;
    setActionError(null);
    await apiFetch("/api/billing/subscription/cancel", {
      method: "POST",
      organisationId,
      body: JSON.stringify({ immediate }),
    });
    await load();
  }

  if (!organisationId) {
    return <p className="text-sm text-foreground-muted">Select an organisation to manage billing.</p>;
  }

  if (loading) {
    return <p className="text-sm text-foreground-muted">Loading billing…</p>;
  }

  const currentPlanKey = account?.summary.plan?.key ?? "free";
  const subscriptionStatus = account?.summary.subscription?.status ?? "ACTIVE";

  return (
    <>
      <PageHeader
        title="Billing"
        description="Manage your subscription, usage limits, and invoices."
        breadcrumbs={[{ label: "Settings", href: "/settings" }, { label: "Billing" }]}
      />

      {actionError ? (
        <Card className="mb-4 border-amber-200 bg-amber-50">
          <CardContent className="pt-6 text-sm text-amber-900">{actionError}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Current plan</CardTitle>
            <CardDescription>Subscription status and billing period.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium">{account?.summary.plan?.displayName ?? "Free"}</span>
              <Badge variant={statusBadgeVariant(subscriptionStatus)}>{subscriptionStatus}</Badge>
            </div>
            {account?.summary.plan?.monthlyPriceCents ? (
              <p className="text-foreground-muted">
                {formatPrice(account.summary.plan.monthlyPriceCents)} / month
              </p>
            ) : null}
            {subscriptionStatus === "PAST_DUE" ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
                <p className="font-medium">Payment needs attention</p>
                <p className="mt-1 text-xs">
                  We couldn&apos;t process your latest subscription payment. Update your billing details to
                  restore full access.
                </p>
              </div>
            ) : null}
            {account?.summary.trial ? (
              <p className="text-foreground-muted">
                Trial ends {new Date(account.summary.trial.endsAt).toLocaleDateString()}
              </p>
            ) : null}
            {account?.summary.subscription ? (
              <p className="text-foreground-muted">
                Current period ends{" "}
                {new Date(account.summary.subscription.currentPeriodEnd).toLocaleDateString()}
                {account.summary.subscription.cancelAtPeriodEnd ? " (cancels at period end)" : ""}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-2">
              {selfServiceCheckoutEnabled ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => void handlePortal()}>
                    Payment methods & invoices
                  </Button>
                  {account?.summary.subscription && !account.summary.subscription.cancelAtPeriodEnd ? (
                    <Button variant="outline" size="sm" onClick={() => void handleCancel(false)}>
                      Cancel at period end
                    </Button>
                  ) : null}
                  {account?.summary.subscription?.cancelAtPeriodEnd ? (
                    <Button variant="outline" size="sm" onClick={() => void handleResume()}>
                      Resume subscription
                    </Button>
                  ) : null}
                </>
              ) : (
                <p className="text-xs text-foreground-muted">
                  Self-service checkout is not yet available. Contact your account team to upgrade.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Usage overview</CardTitle>
            <CardDescription>Current consumption against plan allowances.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {account?.usage.length ? (
              account.usage.map((meter) => {
                const pct = meter.allowance > 0 ? Math.min(100, (meter.used / meter.allowance) * 100) : 0;
                const warning =
                  pct >= 100 ? "Limit reached" : pct >= 90 ? "90% used" : pct >= 70 ? "70% used" : null;
                return (
                  <div key={meter.meterKey}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{meter.displayName}</span>
                      <span className={warning ? "font-medium text-amber-700" : "text-foreground-muted"}>
                        {meter.used.toLocaleString()} / {meter.allowance.toLocaleString()} {meter.unit}
                        {warning ? ` · ${warning}` : ""}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-hover">
                      <div
                        className={`h-full rounded-full ${warning ? "bg-amber-500" : "bg-primary"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-foreground-muted">No usage meters configured for this plan.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Compare plans</CardTitle>
          <CardDescription>
            {selfServiceCheckoutEnabled
              ? "Upgrade or downgrade your workspace subscription."
              : "Plan comparison for your workspace. Self-service checkout opens after billing launch."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex gap-2">
            <Button
              size="sm"
              variant={billingInterval === "MONTHLY" ? "primary" : "outline"}
              onClick={() => setBillingInterval("MONTHLY")}
            >
              Monthly
            </Button>
            <Button
              size="sm"
              variant={billingInterval === "ANNUAL" ? "primary" : "outline"}
              onClick={() => setBillingInterval("ANNUAL")}
            >
              Annual
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {plans
              .filter((p) => !["free", "trial"].includes(p.key))
              .map((plan) => {
                const price =
                  billingInterval === "ANNUAL"
                    ? plan.version?.annualPriceCents ?? 0
                    : plan.version?.monthlyPriceCents ?? 0;
                const isCurrent = plan.key === currentPlanKey;
                return (
                  <Card key={plan.key} className={isCurrent ? "border-primary" : ""}>
                    <CardHeader>
                      <CardTitle className="text-base">{plan.displayName}</CardTitle>
                      <CardDescription>{plan.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-2xl font-semibold">
                        {billingInterval === "ANNUAL" && price > 0
                          ? `${formatPlanPrice(price)}/yr`
                          : formatPrice(price)}
                      </p>
                      {isCurrent ? (
                        <Badge variant="muted">Current plan</Badge>
                      ) : selfServiceCheckoutEnabled ? (
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" onClick={() => void handleCheckout(plan.key)}>
                            {currentPlanKey === "free" ? "Subscribe" : "Upgrade"}
                          </Button>
                          {allowDirectPlanChange ? (
                            <Button size="sm" variant="outline" onClick={() => void handleChangePlan(plan.key)}>
                              Change plan (dev)
                            </Button>
                          ) : null}
                        </div>
                      ) : (
                        <p className="text-xs text-foreground-muted">Checkout coming soon</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </CardContent>
      </Card>

      {invoices.length > 0 ? (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Invoices</CardTitle>
            <CardDescription>Recent billing invoices from Stripe.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {invoices.map((invoice) => (
                <li key={invoice.id} className="flex items-center justify-between rounded border px-3 py-2">
                  <span>
                    {formatPlanPrice(invoice.amountCents, invoice.currency)} · {invoice.status}
                  </span>
                  {invoice.invoiceUrl ? (
                    <a href={invoice.invoiceUrl} target="_blank" rel="noreferrer" className="underline">
                      View invoice
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Feature entitlements</CardTitle>
          <CardDescription>What your plan includes for this workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 text-sm md:grid-cols-2">
            {account?.entitlements.map((e) => (
              <li key={e.entitlementKey} className="flex items-center justify-between rounded border px-3 py-2">
                <span className="text-foreground-muted">{e.entitlementKey}</span>
                <span className="font-medium">
                  {e.valueType === "BOOLEAN"
                    ? e.booleanValue
                      ? "Included"
                      : "Locked"
                    : e.limitValue === null
                      ? "Unlimited"
                      : e.limitValue.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}
