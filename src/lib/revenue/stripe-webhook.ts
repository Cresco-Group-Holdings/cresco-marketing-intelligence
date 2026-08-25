import { createHmac, timingSafeEqual } from "node:crypto";
import type { StripeConfig } from "@/lib/revenue/config";

/** Stripe recommends rejecting events older than 5 minutes (300 seconds). */
export const STRIPE_WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS = 300;

export function verifyStripeWebhookSignature(
  payload: string,
  signatureHeader: string,
  config: StripeConfig,
  options?: { toleranceSeconds?: number; requireTimestamp?: boolean },
): { valid: boolean; eventId?: string } {
  const parts = signatureHeader.split(",").reduce<Record<string, string>>((acc, part) => {
    const [key, value] = part.split("=");
    if (key && value) acc[key.trim()] = value.trim();
    return acc;
  }, {});

  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return { valid: false };

  const toleranceMs =
    (options?.toleranceSeconds ?? STRIPE_WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS) * 1000;
  const timestampMs = Number(timestamp) * 1000;
  if (!Number.isFinite(timestampMs)) return { valid: false };
  if (options?.requireTimestamp !== false && Math.abs(Date.now() - timestampMs) > toleranceMs) {
    return { valid: false };
  }

  const signedPayload = `${timestamp}.${payload}`;
  const expected = createHmac("sha256", config.webhookSecret).update(signedPayload).digest("hex");

  try {
    const valid = timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    return { valid, eventId: valid ? parts.t : undefined };
  } catch {
    return { valid: false };
  }
}

export function sanitiseStripeLogPayload(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object") return {};
  const sanitised = { ...(payload as Record<string, unknown>) };
  for (const key of ["card", "payment_method_details", "billing_details", "source"]) {
    delete sanitised[key];
  }
  return sanitised;
}
