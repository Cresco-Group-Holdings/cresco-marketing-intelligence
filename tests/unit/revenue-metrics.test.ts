import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { calculateRevenueMetrics } from "@/lib/revenue/metrics";
import { mapCustomerToIdentity, isForbiddenMappingMethod } from "@/lib/revenue/customer-mapping";
import { verifyStripeWebhookSignature } from "@/lib/revenue/stripe-webhook";
import { parseStripeWebhookEvent, extractBrandIdFromStripeEvent } from "@/lib/revenue/adapters/stripe-adapter";

describe("revenue metrics", () => {
  const baseDate = new Date("2026-01-15T00:00:00Z");

  it("calculates total and net revenue", () => {
    const result = calculateRevenueMetrics({
      transactions: [
        { originalAmount: 100, netAmount: 100, currency: "USD", occurredAt: baseDate, transactionType: "PAYMENT", isRefund: false, revenueCustomerId: "c1", customerFirstPaymentAt: baseDate },
        { originalAmount: 50, netAmount: 50, currency: "USD", occurredAt: baseDate, transactionType: "PAYMENT", isRefund: false, revenueCustomerId: "c2", customerFirstPaymentAt: baseDate },
        { originalAmount: 20, netAmount: 20, currency: "USD", occurredAt: baseDate, transactionType: "REFUND", isRefund: true },
      ],
      subscriptions: [{ mrrAmount: 80, status: "ACTIVE", currency: "USD" }],
      marketingSpend: 200,
      newCustomers: 2,
    });
    expect(result.totalRevenue).toBe(150);
    expect(result.refunds).toBe(20);
    expect(result.netRevenue).toBe(130);
    expect(result.mrr).toBe(80);
    expect(result.arr).toBe(960);
  });

  it("calculates MRR from active subscriptions", () => {
    const result = calculateRevenueMetrics({
      transactions: [],
      subscriptions: [
        { mrrAmount: 50, status: "ACTIVE", currency: "USD" },
        { mrrAmount: 30, status: "TRIALING", currency: "USD" },
        { mrrAmount: 100, status: "CANCELED", currency: "USD" },
      ],
    });
    expect(result.mrr).toBe(80);
  });

  it("calculates CAC when spend and customers exist", () => {
    const result = calculateRevenueMetrics({
      transactions: [],
      subscriptions: [],
      marketingSpend: 1000,
      newCustomers: 10,
    });
    expect(result.cac).toBe(100);
    expect(result.blendedCac).toBe(100);
  });

  it("does not calculate LTV without explicit methodology", () => {
    const result = calculateRevenueMetrics({
      transactions: [
        { originalAmount: 100, netAmount: 100, currency: "USD", occurredAt: baseDate, transactionType: "PAYMENT", isRefund: false, revenueCustomerId: "c1", customerFirstPaymentAt: baseDate },
      ],
      subscriptions: [],
    });
    expect(result.ltv).toBeNull();
    expect(result.assumptions.some((a) => a.includes("LTV not calculated"))).toBe(true);
  });

  it("calculates LTV with explicit methodology", () => {
    const result = calculateRevenueMetrics({
      transactions: [
        { originalAmount: 120, netAmount: 120, currency: "USD", occurredAt: baseDate, transactionType: "PAYMENT", isRefund: false, revenueCustomerId: "c1", customerFirstPaymentAt: baseDate },
      ],
      subscriptions: [],
      ltvMethodology: "SIMPLE_ARPC_X_12",
    });
    expect(result.ltv).toBe(1440);
  });

  it("tracks unattributed revenue", () => {
    const result = calculateRevenueMetrics({
      transactions: [
        { originalAmount: 75, netAmount: 75, currency: "USD", occurredAt: baseDate, transactionType: "PAYMENT", isRefund: false, revenueCustomerId: null },
      ],
      subscriptions: [],
    });
    expect(result.unattributedRevenue).toBe(75);
  });

  it("preserves original amounts on refunds without overwriting", () => {
    const result = calculateRevenueMetrics({
      transactions: [
        { originalAmount: 100, netAmount: 100, currency: "USD", occurredAt: baseDate, transactionType: "PAYMENT", isRefund: false, revenueCustomerId: "c1", customerFirstPaymentAt: baseDate },
        { originalAmount: 30, netAmount: 30, currency: "USD", occurredAt: baseDate, transactionType: "REFUND", isRefund: true, revenueCustomerId: "c1" },
      ],
      subscriptions: [],
    });
    expect(result.totalRevenue).toBe(100);
    expect(result.refunds).toBe(30);
    expect(result.netRevenue).toBe(70);
  });

  it("calculates trial-to-paid conversion", () => {
    const result = calculateRevenueMetrics({
      transactions: [],
      subscriptions: [],
      trialStarts: 20,
      trialConversions: 5,
    });
    expect(result.trialToPaidRate).toBe(25);
  });
});

describe("customer mapping", () => {
  it("maps via internal customer ID", () => {
    const result = mapCustomerToIdentity(
      { internalUserId: "user-123" },
      (type, value) => (type === "USER_ID" && value === "user-123" ? "identity-1" : null),
    );
    expect(result.identityId).toBe("identity-1");
    expect(result.linkMethod).toBe("INTERNAL_CUSTOMER_ID");
  });

  it("maps via Stripe metadata", () => {
    const result = mapCustomerToIdentity(
      { stripeMetadataUserId: "meta-user-1" },
      (type, value) => (type === "USER_ID" && value === "meta-user-1" ? "identity-2" : null),
    );
    expect(result.linkMethod).toBe("STRIPE_METADATA");
  });

  it("rejects name-based matching methods", () => {
    expect(isForbiddenMappingMethod("name_similarity")).toBe(true);
    expect(isForbiddenMappingMethod("INTERNAL_CUSTOMER_ID")).toBe(false);
  });

  it("returns null when no deterministic evidence exists", () => {
    const result = mapCustomerToIdentity({}, () => null);
    expect(result.identityId).toBeNull();
  });
});

describe("Stripe webhook", () => {
  const config = { secretKey: "sk_test", webhookSecret: "whsec_test", apiVersion: "2024-11-20.acacia" };

  it("verifies valid webhook signatures", () => {
    const payload = JSON.stringify({ id: "evt_1", type: "charge.succeeded" });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac("sha256", config.webhookSecret)
      .update(`${timestamp}.${payload}`)
      .digest("hex");
    const header = `t=${timestamp},v1=${signature}`;
    expect(verifyStripeWebhookSignature(payload, header, config).valid).toBe(true);
  });

  it("rejects invalid webhook signatures", () => {
    const result = verifyStripeWebhookSignature("{}", "t=1,v1=invalid", config);
    expect(result.valid).toBe(false);
  });

  it("rejects expired webhook signatures", () => {
    const payload = JSON.stringify({ id: "evt_1", type: "charge.succeeded" });
    const timestamp = Math.floor(Date.now() / 1000) - 600;
    const signature = createHmac("sha256", config.webhookSecret)
      .update(`${timestamp}.${payload}`)
      .digest("hex");
    const header = `t=${timestamp},v1=${signature}`;
    expect(verifyStripeWebhookSignature(payload, header, config).valid).toBe(false);
  });

  it("parses charge.succeeded events", () => {
    const parsed = parseStripeWebhookEvent({
      type: "charge.succeeded",
      data: { object: { id: "ch_1", amount: 5000, currency: "usd", created: 1700000000, customer: "cus_1" } },
    });
    expect(parsed.transactions).toHaveLength(1);
    expect(parsed.transactions[0]?.originalAmount).toBe(50);
  });

  it("parses refund events separately", () => {
    const parsed = parseStripeWebhookEvent({
      type: "charge.refunded",
      data: { object: { id: "ch_2", amount: 10000, amount_refunded: 5000, currency: "usd", created: 1700000000 } },
    });
    expect(parsed.transactions[0]?.transactionType).toBe("REFUND");
  });

  it("extracts brand_id from Stripe event metadata", () => {
    const brandId = extractBrandIdFromStripeEvent({
      data: { object: { metadata: { brand_id: "brand-123" } } },
    });
    expect(brandId).toBe("brand-123");
  });
});
