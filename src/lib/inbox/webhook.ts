import { createHash, timingSafeEqual } from "node:crypto";

export function digestPayload(payload: string): string {
  return createHash("sha256").update(payload).digest("hex");
}

export function digestSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

/** Validates a provider webhook signature against the stored secret digest. */
export function validateWebhookSignature(input: {
  payload: string;
  signature: string | null;
  secretDigest: string | null;
}): boolean {
  if (!input.signature || !input.secretDigest) {
    return false;
  }

  const expected = digestSecret(input.signature);
  const provided = input.secretDigest.length === 64 ? input.secretDigest : digestSecret(input.secretDigest);

  try {
    const expectedBuffer = Buffer.from(expected, "hex");
    const providedBuffer = Buffer.from(provided, "hex");
    if (expectedBuffer.length !== providedBuffer.length) {
      return false;
    }
    return timingSafeEqual(expectedBuffer, providedBuffer);
  } catch {
    return false;
  }
}

/** Meta-style HMAC SHA256 signature validation (sha256=<hex>). */
export function validateHmacSha256Signature(input: {
  payload: string;
  signatureHeader: string | null;
  secret: string;
}): boolean {
  if (!input.signatureHeader?.startsWith("sha256=")) {
    return false;
  }
  const expected = createHash("sha256").update(input.payload).update(input.secret).digest("hex");
  const provided = input.signatureHeader.slice("sha256=".length);
  try {
    const expectedBuffer = Buffer.from(expected, "hex");
    const providedBuffer = Buffer.from(provided, "hex");
    if (expectedBuffer.length !== providedBuffer.length) {
      return false;
    }
    return timingSafeEqual(expectedBuffer, providedBuffer);
  } catch {
    return false;
  }
}
