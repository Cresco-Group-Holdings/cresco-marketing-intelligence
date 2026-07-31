import { createHmac, timingSafeEqual } from "node:crypto";

export type WebhookSignatureValidationResult =
  | { valid: true }
  | { valid: false; reason: string };

function safeCompare(expected: string, provided: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }
  return timingSafeEqual(expectedBuffer, providedBuffer);
}

/**
 * Validates Meta (Facebook/Instagram) webhook signatures from X-Hub-Signature-256.
 * Header format: sha256=<hex digest>
 */
export function validateMetaWebhookSignature(input: {
  rawBody: string | Buffer;
  signatureHeader: string | null | undefined;
  appSecret: string;
}): WebhookSignatureValidationResult {
  const { rawBody, signatureHeader, appSecret } = input;

  if (!appSecret.trim()) {
    return { valid: false, reason: "Meta app secret is not configured." };
  }

  if (!signatureHeader?.startsWith("sha256=")) {
    return { valid: false, reason: "Missing or malformed X-Hub-Signature-256 header." };
  }

  const provided = signatureHeader.slice("sha256=".length);
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");

  if (!safeCompare(expected, provided)) {
    return { valid: false, reason: "Meta webhook signature mismatch." };
  }

  return { valid: true };
}

/**
 * Validates X (Twitter) Account Activity webhook signatures from x-twitter-webhooks-signature.
 * Digest is base64-encoded HMAC SHA256 of the raw request body using the consumer secret.
 */
export function validateXWebhookSignature(input: {
  rawBody: string | Buffer;
  signatureHeader: string | null | undefined;
  consumerSecret: string;
}): WebhookSignatureValidationResult {
  const { rawBody, signatureHeader, consumerSecret } = input;

  if (!consumerSecret.trim()) {
    return { valid: false, reason: "X consumer secret is not configured." };
  }

  if (!signatureHeader?.trim()) {
    return { valid: false, reason: "Missing x-twitter-webhooks-signature header." };
  }

  const expected = createHmac("sha256", consumerSecret).update(rawBody).digest("base64");

  if (!safeCompare(expected, signatureHeader.trim())) {
    return { valid: false, reason: "X webhook signature mismatch." };
  }

  return { valid: true };
}
