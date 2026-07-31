import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function generatePublicPropertyId(): string {
  return `prop_${randomBytes(12).toString("hex")}`;
}

export function generateTrackingApiKey(): { key: string; prefix: string; hash: string } {
  const secret = randomBytes(24).toString("base64url");
  const key = `ctk_${secret}`;
  const prefix = key.slice(0, 12);
  const hash = hashTrackingApiKey(key);
  return { key, prefix, hash };
}

export function hashTrackingApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function verifyTrackingApiKey(key: string, hash: string): boolean {
  const provided = Buffer.from(hashTrackingApiKey(key));
  const expected = Buffer.from(hash);
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

export function signServerEventPayload(payload: string, apiKey: string): string {
  return createHash("sha256").update(`${apiKey}:${payload}`).digest("hex");
}

export function verifyServerEventSignature(
  payload: string,
  apiKey: string,
  signature: string,
): boolean {
  const expected = signServerEventPayload(payload, apiKey);
  const provided = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (provided.length !== expectedBuffer.length) return false;
  return timingSafeEqual(provided, expectedBuffer);
}
