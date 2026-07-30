import { getStripeConfig } from "@/lib/revenue/config";
import type { RevenueAdapter, RevenueAdapterSyncResult, RevenueAdapterTransaction } from "@/lib/revenue/types";

async function stripeFetch<T>(path: string, secretKey: string): Promise<T> {
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
  if (!response.ok) {
    throw new Error(`Stripe API error: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function centsToAmount(cents: number): number {
  return cents / 100;
}

export const stripeRevenueAdapter: RevenueAdapter = {
  sourceType: "STRIPE",
  isAvailable: () => getStripeConfig() !== null,
  async sync(input) {
    const config = getStripeConfig();
    if (!config) return { customers: [], subscriptions: [], transactions: [] };

    const since = input.since ? Math.floor(input.since.getTime() / 1000) : undefined;
    const query = since ? `?created[gte]=${since}&limit=100` : "?limit=100";

    const [customersRes, subscriptionsRes, chargesRes] = await Promise.all([
      stripeFetch<{ data: Array<Record<string, unknown>> }>(`/customers${query}`, config.secretKey),
      stripeFetch<{ data: Array<Record<string, unknown>> }>(`/subscriptions${query}`, config.secretKey),
      stripeFetch<{ data: Array<Record<string, unknown>> }>(`/charges${query}`, config.secretKey),
    ]);

    const customers = customersRes.data.map((c) => ({
      providerCustomerId: String(c.id),
      email: typeof c.email === "string" ? c.email : null,
      displayName: typeof c.name === "string" ? c.name : null,
      signupAt: typeof c.created === "number" ? new Date(c.created * 1000) : null,
      metadata: (c.metadata as Record<string, unknown>) ?? {},
      internalUserId:
        typeof (c.metadata as Record<string, unknown>)?.user_id === "string"
          ? String((c.metadata as Record<string, unknown>).user_id)
          : null,
    }));

    const subscriptions = subscriptionsRes.data.map((s) => {
      const item = (s.items as { data?: Array<Record<string, unknown>> })?.data?.[0];
      const unitAmount = (item?.price as { unit_amount?: number })?.unit_amount ?? 0;
      const interval = (item?.price as { recurring?: { interval?: string } })?.recurring?.interval;
      const mrr = interval === "year" ? centsToAmount(unitAmount) / 12 : centsToAmount(unitAmount);
      return {
        providerSubscriptionId: String(s.id),
        providerCustomerId: String(s.customer),
        status: String(s.status ?? "unknown").toUpperCase(),
        productId: String((item?.price as { product?: string })?.product ?? ""),
        priceId: String((item?.price as { id?: string })?.id ?? ""),
        planName: String((item?.price as { nickname?: string })?.nickname ?? ""),
        mrrAmount: mrr,
        currency: String(s.currency ?? "usd").toUpperCase(),
        trialStart: typeof s.trial_start === "number" ? new Date(s.trial_start * 1000) : null,
        trialEnd: typeof s.trial_end === "number" ? new Date(s.trial_end * 1000) : null,
        currentPeriodStart: typeof s.current_period_start === "number" ? new Date(s.current_period_start * 1000) : null,
        currentPeriodEnd: typeof s.current_period_end === "number" ? new Date(s.current_period_end * 1000) : null,
        canceledAt: typeof s.canceled_at === "number" ? new Date(s.canceled_at * 1000) : null,
      };
    });

    const transactions: RevenueAdapterTransaction[] = chargesRes.data.map((charge) => {
      const amount = centsToAmount(Number(charge.amount ?? 0));
      const refunded = centsToAmount(Number(charge.amount_refunded ?? 0));
      const isRefund = refunded > 0;
      return {
        providerTransactionId: String(charge.id),
        providerCustomerId: typeof charge.customer === "string" ? charge.customer : null,
        transactionType: isRefund ? "REFUND" : "PAYMENT",
        originalAmount: amount,
        netAmount: amount - refunded,
        currency: String(charge.currency ?? "usd").toUpperCase(),
        occurredAt: new Date(Number(charge.created) * 1000),
        paymentId: String(charge.id),
        isRefund,
        isPartialRefund: isRefund && refunded < amount,
      };
    });

    return { customers, subscriptions, transactions };
  },
};

export function parseStripeWebhookEvent(payload: Record<string, unknown>): RevenueAdapterSyncResult {
  const type = String(payload.type ?? "");
  const data = (payload.data as { object?: Record<string, unknown> })?.object ?? {};
  const result: RevenueAdapterSyncResult = { customers: [], subscriptions: [], transactions: [] };

  if (type.startsWith("customer.") && data.id) {
    result.customers.push({
      providerCustomerId: String(data.id),
      email: typeof data.email === "string" ? data.email : null,
      metadata: (data.metadata as Record<string, unknown>) ?? {},
    });
  }

  if (type.startsWith("customer.subscription.") && data.id) {
    result.subscriptions.push({
      providerSubscriptionId: String(data.id),
      providerCustomerId: String(data.customer),
      status: String(data.status ?? "unknown").toUpperCase(),
      currency: String(data.currency ?? "usd").toUpperCase(),
      mrrAmount: 0,
    });
  }

  if ((type === "charge.succeeded" || type === "charge.refunded") && data.id) {
    const amount = Number(data.amount ?? 0) / 100;
    const refunded = Number(data.amount_refunded ?? 0) / 100;
    result.transactions.push({
      providerTransactionId: String(data.id),
      providerCustomerId: typeof data.customer === "string" ? data.customer : null,
      transactionType: type === "charge.refunded" ? "REFUND" : "PAYMENT",
      originalAmount: amount,
      netAmount: amount - refunded,
      currency: String(data.currency ?? "usd").toUpperCase(),
      occurredAt: new Date(Number(data.created) * 1000),
      isRefund: type === "charge.refunded",
    });
  }

  return result;
}

export function extractBrandIdFromStripeEvent(payload: Record<string, unknown>): string | null {
  const data = (payload.data as { object?: Record<string, unknown> })?.object ?? {};
  const metadata = (data.metadata as Record<string, unknown>) ?? {};
  const brandId = metadata.brand_id ?? metadata.brandId;
  return typeof brandId === "string" && brandId.length > 0 ? brandId : null;
}
