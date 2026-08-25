import { getServerEnv } from "@/lib/environment";
import { isProductionRuntime } from "@/lib/providers/oauth/runtime";

export type StripeBillingConfig = {
  secretKey: string;
  webhookSecret: string;
  publishableKey?: string;
};

export function getStripeBillingConfig(): StripeBillingConfig | null {
  const secretKey = process.env.STRIPE_BILLING_SECRET_KEY ?? process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_BILLING_WEBHOOK_SECRET ?? process.env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey || !webhookSecret) return null;
  return {
    secretKey,
    webhookSecret,
    publishableKey: process.env.STRIPE_BILLING_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  };
}

export function requireStripeBillingConfig(): StripeBillingConfig {
  const config = getStripeBillingConfig();
  if (!config) {
    if (isProductionRuntime()) {
      throw new Error("Stripe billing is not configured.");
    }
    return {
      secretKey: "mock",
      webhookSecret: "mock",
    };
  }
  return config;
}

export function isStripeBillingConfigured(): boolean {
  return getStripeBillingConfig() !== null;
}

function allowBillingMocks(): boolean {
  return !isProductionRuntime() && process.env.ALLOW_BILLING_MOCK === "true";
}

export type BillingProviderCheckoutInput = {
  organisationId: string;
  billingAccountId: string;
  planKey: string;
  billingInterval: "MONTHLY" | "ANNUAL";
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  promoCode?: string;
  metadata?: Record<string, string>;
};

export type BillingProviderPortalInput = {
  organisationId: string;
  billingAccountId: string;
  externalCustomerRef: string;
  returnUrl: string;
};

export const stripeBillingProvider = {
  async createCustomer(input: {
    organisationId: string;
    email?: string;
    metadata?: Record<string, string>;
  }): Promise<{ externalCustomerRef: string }> {
    const config = getStripeBillingConfig();
    if (!config || allowBillingMocks()) {
      if (isProductionRuntime()) {
        throw new Error("Stripe billing is not configured.");
      }
      return { externalCustomerRef: `mock_cus_${input.organisationId}` };
    }

    const response = await fetch("https://api.stripe.com/v1/customers", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        ...(input.email ? { email: input.email } : {}),
        "metadata[organisation_id]": input.organisationId,
        ...Object.fromEntries(
          Object.entries(input.metadata ?? {}).map(([k, v]) => [`metadata[${k}]`, v]),
        ),
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to create Stripe customer.");
    }
    const data = (await response.json()) as { id: string };
    return { externalCustomerRef: data.id };
  },

  async createCheckoutSession(
    input: BillingProviderCheckoutInput & { externalCustomerRef?: string; externalPriceRef?: string },
  ): Promise<{ checkoutUrl: string; sessionRef: string }> {
    const config = getStripeBillingConfig();
    if (!config || allowBillingMocks()) {
      if (isProductionRuntime()) {
        throw new Error("Stripe billing is not configured.");
      }
      const mockUrl = `${input.successUrl}?mock_checkout=1&plan=${input.planKey}`;
      return { checkoutUrl: mockUrl, sessionRef: `mock_cs_${input.billingAccountId}` };
    }

    if (!input.externalPriceRef) {
      throw new Error(`Stripe price is not configured for plan ${input.planKey}.`);
    }

    const params = new URLSearchParams({
      mode: "subscription",
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      "metadata[organisation_id]": input.organisationId,
      "metadata[billing_account_id]": input.billingAccountId,
      "metadata[plan_key]": input.planKey,
    });
    if (input.externalCustomerRef) params.set("customer", input.externalCustomerRef);
    if (input.customerEmail) params.set("customer_email", input.customerEmail);
    params.set("line_items[0][price]", input.externalPriceRef);
    params.set("line_items[0][quantity]", "1");
    if (input.promoCode) params.set("allow_promotion_codes", "true");

    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });

    if (!response.ok) throw new Error("Failed to create checkout session.");
    const data = (await response.json()) as { id: string; url: string };
    return { checkoutUrl: data.url, sessionRef: data.id };
  },

  async createPortalSession(
    input: BillingProviderPortalInput,
  ): Promise<{ portalUrl: string }> {
    const config = getStripeBillingConfig();
    if (!config || allowBillingMocks()) {
      if (isProductionRuntime()) {
        throw new Error("Stripe billing is not configured.");
      }
      return { portalUrl: `${input.returnUrl}?mock_portal=1` };
    }

    const response = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        customer: input.externalCustomerRef,
        return_url: input.returnUrl,
      }),
    });

    if (!response.ok) throw new Error("Failed to create portal session.");
    const data = (await response.json()) as { url: string };
    return { portalUrl: data.url };
  },

  async cancelSubscriptionAtPeriodEnd(externalSubscriptionRef: string): Promise<void> {
    const config = getStripeBillingConfig();
    if (!config || allowBillingMocks()) return;

    await fetch(`https://api.stripe.com/v1/subscriptions/${externalSubscriptionRef}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ cancel_at_period_end: "true" }),
    });
  },

  async resumeSubscription(externalSubscriptionRef: string): Promise<void> {
    const config = getStripeBillingConfig();
    if (!config || allowBillingMocks()) return;

    await fetch(`https://api.stripe.com/v1/subscriptions/${externalSubscriptionRef}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ cancel_at_period_end: "false" }),
    });
  },

  async retrieveSubscription(externalSubscriptionRef: string): Promise<{
    status: string;
    cancelAtPeriodEnd: boolean;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    priceId: string | null;
  } | null> {
    const config = getStripeBillingConfig();
    if (!config || allowBillingMocks()) return null;

    const response = await fetch(`https://api.stripe.com/v1/subscriptions/${externalSubscriptionRef}`, {
      headers: { Authorization: `Bearer ${config.secretKey}` },
    });
    if (!response.ok) return null;

    const data = (await response.json()) as {
      status: string;
      cancel_at_period_end: boolean;
      current_period_start: number;
      current_period_end: number;
      items?: { data?: Array<{ price?: { id?: string } }> };
    };

    return {
      status: data.status,
      cancelAtPeriodEnd: Boolean(data.cancel_at_period_end),
      currentPeriodStart: new Date(data.current_period_start * 1000),
      currentPeriodEnd: new Date(data.current_period_end * 1000),
      priceId: data.items?.data?.[0]?.price?.id ?? null,
    };
  },
};
