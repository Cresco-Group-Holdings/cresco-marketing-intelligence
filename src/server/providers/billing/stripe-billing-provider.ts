import { getServerEnv } from "@/lib/environment";

export type StripeBillingConfig = {
  secretKey: string;
  webhookSecret: string;
  publishableKey?: string;
};

export function getStripeBillingConfig(): StripeBillingConfig | null {
  const env = getServerEnv();
  const secretKey = process.env.STRIPE_BILLING_SECRET_KEY ?? process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_BILLING_WEBHOOK_SECRET ?? process.env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey || !webhookSecret) return null;
  return {
    secretKey,
    webhookSecret,
    publishableKey: process.env.STRIPE_BILLING_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  };
}

export function isStripeBillingConfigured(): boolean {
  return getStripeBillingConfig() !== null;
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
    if (!config) {
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
    if (!config) {
      const mockUrl = `${input.successUrl}?mock_checkout=1&plan=${input.planKey}`;
      return { checkoutUrl: mockUrl, sessionRef: `mock_cs_${input.billingAccountId}` };
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
    if (input.externalPriceRef) params.set("line_items[0][price]", input.externalPriceRef);
    params.set("line_items[0][quantity]", "1");

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
    if (!config) {
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
};
