import { createHmac, timingSafeEqual } from "node:crypto";
import { PROVIDER_WEBHOOK_TIMESTAMP_TOLERANCE_MS } from "@/lib/providers/constants";
import type { ResendWebhookPayload } from "@/server/providers/resend/resend-types";
import { normalizeResendWebhookEvent } from "@/server/providers/resend/resend-normalizer";

export const RESEND_WEBHOOK_HEADERS = {
  id: "svix-id",
  timestamp: "svix-timestamp",
  signature: "svix-signature",
} as const;

function decodeWebhookSecret(secret: string): Buffer {
  const normalized = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  return Buffer.from(normalized, "base64");
}

export function isResendWebhookTimestampValid(timestamp: string | undefined): boolean {
  if (!timestamp) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const eventTimeMs = ts * 1000;
  return Math.abs(Date.now() - eventTimeMs) <= PROVIDER_WEBHOOK_TIMESTAMP_TOLERANCE_MS;
}

export function verifyResendWebhookSignature(input: {
  rawBody: string;
  headers: Record<string, string | undefined>;
  secret: string;
}): boolean {
  const msgId = input.headers[RESEND_WEBHOOK_HEADERS.id] ?? input.headers["svix-id"];
  const timestamp = input.headers[RESEND_WEBHOOK_HEADERS.timestamp] ?? input.headers["svix-timestamp"];
  const signatureHeader = input.headers[RESEND_WEBHOOK_HEADERS.signature] ?? input.headers["svix-signature"];

  if (!msgId || !timestamp || !signatureHeader) {
    return false;
  }

  if (!isResendWebhookTimestampValid(timestamp)) {
    return false;
  }

  const signedContent = `${msgId}.${timestamp}.${input.rawBody}`;
  const secretBytes = decodeWebhookSecret(input.secret);

  const signatures = signatureHeader
    .split(" ")
    .map((part) => part.trim())
    .filter((part) => part.startsWith("v1,"))
    .map((part) => part.slice(3));

  for (const signature of signatures) {
    const expected = createHmac("sha256", secretBytes).update(signedContent).digest("base64");
    try {
      const expectedBuf = Buffer.from(expected);
      const actualBuf = Buffer.from(signature);
      if (expectedBuf.length === actualBuf.length && timingSafeEqual(expectedBuf, actualBuf)) {
        return true;
      }
    } catch {
      continue;
    }
  }

  return false;
}

export function extractResendWebhookEventId(headers: Record<string, string | undefined>): string | null {
  return headers[RESEND_WEBHOOK_HEADERS.id] ?? headers["svix-id"] ?? null;
}

export function parseResendWebhookPayload(rawBody: string): ResendWebhookPayload | null {
  try {
    const payload = JSON.parse(rawBody) as ResendWebhookPayload;
    if (!payload || typeof payload !== "object" || typeof payload.type !== "string") {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function processResendWebhookPayload(rawBody: string, providerEventId: string) {
  const payload = parseResendWebhookPayload(rawBody);
  if (!payload) {
    return null;
  }
  return normalizeResendWebhookEvent(payload, providerEventId);
}
