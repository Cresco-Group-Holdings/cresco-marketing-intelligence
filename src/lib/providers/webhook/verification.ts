import { createHmac, timingSafeEqual } from "node:crypto";
import { PROVIDER_WEBHOOK_TIMESTAMP_TOLERANCE_MS } from "@/lib/providers/constants";

export type WebhookVerificationInput = {
  rawBody: string;
  signature: string;
  secret: string;
  timestamp?: string;
  algorithm?: "sha256" | "sha1";
};

export function verifyHmacWebhookSignature(input: WebhookVerificationInput): boolean {
  const algorithm = input.algorithm ?? "sha256";
  const expected = createHmac(algorithm, input.secret).update(input.rawBody).digest("hex");

  try {
    const provided = input.signature.replace(/^sha256=|^sha1=/, "");
    const providedBuffer = Buffer.from(provided, "hex");
    const expectedBuffer = Buffer.from(expected, "hex");
    return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

export function isWebhookTimestampValid(timestamp: string | undefined, toleranceMs = PROVIDER_WEBHOOK_TIMESTAMP_TOLERANCE_MS): boolean {
  if (!timestamp) {
    return true;
  }
  const parsed = Number(timestamp);
  if (!Number.isFinite(parsed)) {
    return false;
  }
  const eventTime = parsed > 1_000_000_000_000 ? parsed : parsed * 1000;
  return Math.abs(Date.now() - eventTime) <= toleranceMs;
}

export function extractWebhookEventId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const record = payload as Record<string, unknown>;
  const candidates = [record.id, record.event_id, record.eventId];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.length > 0) {
      return candidate;
    }
  }
  return null;
}
