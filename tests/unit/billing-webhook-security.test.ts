import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import {
  STRIPE_WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS,
  verifyStripeWebhookSignature,
} from "@/lib/revenue/stripe-webhook";

const secret = "whsec_test_secret";

function signPayload(payload: string, timestamp: number) {
  const signature = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

describe("billing stripe webhook security", () => {
  it("documents 300-second timestamp tolerance", () => {
    expect(STRIPE_WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS).toBe(300);
  });

  it("rejects stale webhook timestamps beyond tolerance", () => {
    const payload = JSON.stringify({ id: "evt_1", type: "invoice.paid" });
    const staleTimestamp = Math.floor((Date.now() - 301_000) / 1000);
    const header = signPayload(payload, staleTimestamp);

    const result = verifyStripeWebhookSignature(payload, header, {
      secretKey: "sk_test",
      webhookSecret: secret,
      apiVersion: "2024-06-20",
    });

    expect(result.valid).toBe(false);
  });

  it("accepts webhook timestamps within tolerance", () => {
    const payload = JSON.stringify({ id: "evt_2", type: "invoice.paid" });
    const timestamp = Math.floor(Date.now() / 1000);
    const header = signPayload(payload, timestamp);

    const result = verifyStripeWebhookSignature(payload, header, {
      secretKey: "sk_test",
      webhookSecret: secret,
      apiVersion: "2024-06-20",
    });

    expect(result.valid).toBe(true);
  });

  it("rejects invalid signatures even with valid timestamp", () => {
    const payload = JSON.stringify({ id: "evt_3", type: "invoice.paid" });
    const timestamp = Math.floor(Date.now() / 1000);
    const header = `t=${timestamp},v1=invalid`;

    const result = verifyStripeWebhookSignature(payload, header, {
      secretKey: "sk_test",
      webhookSecret: secret,
      apiVersion: "2024-06-20",
    });

    expect(result.valid).toBe(false);
  });
});
