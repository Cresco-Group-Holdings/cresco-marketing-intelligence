import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { validateHmacSha256Signature } from "@/lib/inbox/webhook";
import { validateMetaWebhookSignature } from "@/lib/social/inbox-webhook";

const SECRET = "test-webhook-secret";
const PAYLOAD = '{"entry":[{"changes":[{"value":{"comment_id":"123"}}]}]}';

function signMetaPayload(payload: string, secret: string): string {
  const digest = createHmac("sha256", secret).update(payload).digest("hex");
  return `sha256=${digest}`;
}

describe("validateHmacSha256Signature", () => {
  it("accepts a valid sha256 signature", () => {
    const signatureHeader = signMetaPayload(PAYLOAD, SECRET);
    expect(
      validateHmacSha256Signature({
        payload: PAYLOAD,
        signatureHeader,
        secret: SECRET,
      }),
    ).toBe(true);
  });

  it("rejects an invalid signature", () => {
    expect(
      validateHmacSha256Signature({
        payload: PAYLOAD,
        signatureHeader: "sha256=deadbeef",
        secret: SECRET,
      }),
    ).toBe(false);
  });

  it("rejects a missing header", () => {
    expect(
      validateHmacSha256Signature({
        payload: PAYLOAD,
        signatureHeader: null,
        secret: SECRET,
      }),
    ).toBe(false);
  });

  it("rejects a malformed header without sha256= prefix", () => {
    const digest = createHmac("sha256", SECRET).update(PAYLOAD).digest("hex");
    expect(
      validateHmacSha256Signature({
        payload: PAYLOAD,
        signatureHeader: digest,
        secret: SECRET,
      }),
    ).toBe(false);
  });

  it("rejects signatures for a tampered payload", () => {
    const signatureHeader = signMetaPayload(PAYLOAD, SECRET);
    expect(
      validateHmacSha256Signature({
        payload: `${PAYLOAD} `,
        signatureHeader,
        secret: SECRET,
      }),
    ).toBe(false);
  });
});

describe("validateMetaWebhookSignature", () => {
  it("accepts a valid Meta X-Hub-Signature-256 header", () => {
    const signatureHeader = signMetaPayload(PAYLOAD, SECRET);
    expect(
      validateMetaWebhookSignature({
        rawBody: PAYLOAD,
        signatureHeader,
        appSecret: SECRET,
      }),
    ).toEqual({ valid: true });
  });

  it("accepts Buffer raw bodies", () => {
    const signatureHeader = signMetaPayload(PAYLOAD, SECRET);
    expect(
      validateMetaWebhookSignature({
        rawBody: Buffer.from(PAYLOAD),
        signatureHeader,
        appSecret: SECRET,
      }),
    ).toEqual({ valid: true });
  });

  it("rejects an invalid signature with a reason", () => {
    const result = validateMetaWebhookSignature({
      rawBody: PAYLOAD,
      signatureHeader: "sha256=invalid",
      appSecret: SECRET,
    });
    expect(result).toEqual({ valid: false, reason: "Meta webhook signature mismatch." });
  });

  it("rejects a missing header", () => {
    expect(
      validateMetaWebhookSignature({
        rawBody: PAYLOAD,
        signatureHeader: null,
        appSecret: SECRET,
      }),
    ).toEqual({ valid: false, reason: "Missing or malformed X-Hub-Signature-256 header." });
  });

  it("rejects an unconfigured app secret", () => {
    expect(
      validateMetaWebhookSignature({
        rawBody: PAYLOAD,
        signatureHeader: signMetaPayload(PAYLOAD, SECRET),
        appSecret: "   ",
      }),
    ).toEqual({ valid: false, reason: "Meta app secret is not configured." });
  });

  it("rejects a signature computed with a different secret", () => {
    const result = validateMetaWebhookSignature({
      rawBody: PAYLOAD,
      signatureHeader: signMetaPayload(PAYLOAD, "other-secret"),
      appSecret: SECRET,
    });
    expect(result.valid).toBe(false);
    expect(result).toMatchObject({ reason: "Meta webhook signature mismatch." });
  });
});
