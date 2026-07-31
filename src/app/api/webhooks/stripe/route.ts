import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { apiFailure, apiSuccess, createRequestId } from "@/lib/api/response";
import { AppError } from "@/lib/errors";
import { extractBrandIdFromStripeEvent, parseStripeWebhookEvent } from "@/lib/revenue/adapters/stripe-adapter";
import { getStripeConfig } from "@/lib/revenue/config";
import { sanitiseStripeLogPayload, verifyStripeWebhookSignature } from "@/lib/revenue/stripe-webhook";
import { revenueSyncService } from "@/server/services/revenue-sync-service";

export async function POST(request: NextRequest) {
  const requestId = createRequestId();
  const config = getStripeConfig();
  if (!config) {
    return apiFailure(
      new AppError("INTERNAL_ERROR", "Stripe is not configured.", { status: 503 }),
      requestId,
    );
  }

  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return apiFailure(new AppError("VALIDATION_ERROR", "Missing Stripe signature."), requestId);
  }

  const verification = verifyStripeWebhookSignature(payload, signature, config);
  if (!verification.valid) {
    return apiFailure(new AppError("VALIDATION_ERROR", "Invalid Stripe signature."), requestId);
  }

  const event = JSON.parse(payload) as Record<string, unknown>;
  const eventId = String(event.id ?? "");
  const idempotencyKey = createHash("sha256").update(`stripe_webhook:${eventId}`).digest("hex");
  const brandId = extractBrandIdFromStripeEvent(event);

  const duplicate = await revenueSyncService.isWebhookProcessed(idempotencyKey);
  if (duplicate) {
    return apiSuccess({ status: "duplicate_ignored", eventId }, { requestId });
  }

  const parsed = parseStripeWebhookEvent(event);
  sanitiseStripeLogPayload(event);

  let recordsSynced = 0;
  if (brandId) {
    const result = await revenueSyncService.applyWebhookData(brandId, "STRIPE", parsed, idempotencyKey, {
      eventId,
      eventType: String(event.type ?? ""),
    });
    recordsSynced = result.recordsSynced;
  }

  return apiSuccess(
    {
      status: "accepted",
      eventId,
      eventType: event.type,
      records: {
        customers: parsed.customers.length,
        subscriptions: parsed.subscriptions.length,
        transactions: parsed.transactions.length,
        persisted: recordsSynced,
      },
    },
    { requestId },
  );
}
