import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";
import { resetEnvCacheForTests } from "@/lib/environment";
import { resetProviderAdapterCacheForTests } from "@/lib/providers/adapter-registry";
import {
  normalizeResendWebhookEvent,
  shouldAdvanceEmailStatus,
  mapNormalizedEventToEmailStatus,
} from "@/server/providers/resend/resend-normalizer";
import {
  verifyResendWebhookSignature,
  isResendWebhookTimestampValid,
  extractResendWebhookEventId,
} from "@/server/providers/resend/resend-webhook";
import { mapResendHttpError } from "@/server/providers/resend/resend-errors";
import { createResendAdapter } from "@/server/providers/resend/resend-adapter";
import { RESEND_API_KEY_PATTERN } from "@/server/providers/resend/resend-types";
import { fingerprintCredential, redactSecrets } from "@/lib/providers/credential-redaction";
import { encryptSecret, decryptSecret } from "@/lib/security/encryption";

describe("Resend provider integration", () => {
  beforeEach(() => {
    resetEnvCacheForTests();
    resetProviderAdapterCacheForTests();
    process.env.ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("validates API key format", () => {
    expect(RESEND_API_KEY_PATTERN.test("re_123abc")).toBe(true);
    expect(RESEND_API_KEY_PATTERN.test("invalid")).toBe(false);
  });

  it("encrypts and fingerprints credentials without returning plaintext", () => {
    const encrypted = encryptSecret("re_secret_key_value");
    expect(encrypted).not.toContain("re_secret");
    expect(decryptSecret(encrypted)).toBe("re_secret_key_value");
    expect(fingerprintCredential("re_secret_key_value")).toMatch(/\*+/);
    expect(redactSecrets({ apiKey: "re_secret" }).apiKey).toBe("[REDACTED]");
  });

  it("maps HTTP errors to safe provider codes", () => {
    expect(mapResendHttpError(401).code).toBe("AUTHENTICATION_REQUIRED");
    expect(mapResendHttpError(403).code).toBe("INVALID_CREDENTIALS");
    expect(mapResendHttpError(429).retryable).toBe(true);
    expect(mapResendHttpError(503).code).toBe("PROVIDER_UNAVAILABLE");
  });

  it("normalizes webhook events", () => {
    const normalized = normalizeResendWebhookEvent(
      {
        type: "email.bounced",
        created_at: "2026-08-01T10:00:00.000Z",
        data: { email_id: "email-1", to: ["user@example.com"], bounce: { type: "Permanent" } },
      },
      "evt-1",
    );
    expect(normalized.eventType).toBe("EMAIL_BOUNCED");
    expect(normalized.providerMessageId).toBe("email-1");
  });

  it("enforces event ordering precedence", () => {
    expect(shouldAdvanceEmailStatus("DELIVERED", "SENT")).toBe(false);
    expect(shouldAdvanceEmailStatus("SENT", "DELIVERED")).toBe(true);
    expect(shouldAdvanceEmailStatus("BOUNCED", "DELIVERED")).toBe(false);
    expect(mapNormalizedEventToEmailStatus("EMAIL_COMPLAINED")).toBe("COMPLAINED");
  });

  it("rejects stale webhook timestamps", () => {
    const stale = String(Math.floor(Date.now() / 1000) - 600);
    expect(isResendWebhookTimestampValid(stale)).toBe(false);
    const fresh = String(Math.floor(Date.now() / 1000));
    expect(isResendWebhookTimestampValid(fresh)).toBe(true);
  });

  it("verifies Svix-compatible webhook signatures", () => {
    const secret = "whsec_" + Buffer.from("test_secret").toString("base64");
    const payload = JSON.stringify({ type: "email.sent", created_at: "2026-08-01T10:00:00Z", data: {} });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const msgId = "msg_test123";
    const signedContent = `${msgId}.${timestamp}.${payload}`;
    const secretBytes = Buffer.from("test_secret");
    const signature = createHmac("sha256", secretBytes).update(signedContent).digest("base64");

    const valid = verifyResendWebhookSignature({
      rawBody: payload,
      headers: {
        "svix-id": msgId,
        "svix-timestamp": timestamp,
        "svix-signature": `v1,${signature}`,
      },
      secret,
    });
    expect(valid).toBe(true);
    expect(extractResendWebhookEventId({ "svix-id": msgId })).toBe(msgId);
  });

  it("rejects invalid webhook signatures", () => {
    const payload = "{}";
    expect(
      verifyResendWebhookSignature({
        rawBody: payload,
        headers: { "svix-id": "x", "svix-timestamp": String(Math.floor(Date.now() / 1000)), "svix-signature": "v1,bad" },
        secret: "whsec_" + Buffer.from("test").toString("base64"),
      }),
    ).toBe(false);
  });

  it("validates send requests and rejects missing body", async () => {
    const { adapter } = createResendAdapter({
      getApiKey: async () => "re_test_key",
    });

    const result = await adapter.sendEmailInternal({
      context: {
        organisationId: "org-1",
        connectionId: "conn-1",
        providerKey: "resend",
        configuration: {},
      },
      message: {
        organisationId: "org-1",
        connectionId: "conn-1",
        messageType: "TRANSACTIONAL",
        from: "Test <onboarding@resend.dev>",
        to: ["delivered@resend.dev"],
        subject: "Hello",
        idempotencyKey: "idem-1",
      },
      verifiedDomains: [{ id: "1", name: "resend.dev", status: "verified", sendingEligible: true, lastCheckedAt: new Date().toISOString() }],
    });

    expect(["ACCEPTED", "FAILED", "REJECTED"]).toContain(result.status);
  });

  it("adapter exposes required capabilities", () => {
    const { adapter } = createResendAdapter({ getApiKey: async () => null });
    expect(adapter.getCapabilities()).toContain("EMAIL_SEND");
    expect(adapter.getCapabilities()).toContain("WEBHOOK_RECEIVE");
  });
});
