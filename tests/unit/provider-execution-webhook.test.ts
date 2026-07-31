import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { resetEnvCacheForTests } from "@/lib/environment";
import {
  classifyProviderError,
  calculateRetryDelay,
  withProviderRetry,
} from "@/lib/providers/execution-policy";
import {
  extractWebhookEventId,
  isWebhookTimestampValid,
  verifyHmacWebhookSignature,
} from "@/lib/providers/webhook/verification";
import { isProviderConnectorsEnabled, isProviderLiveCallsEnabled } from "@/lib/providers/feature-flags";

describe("provider execution and webhook foundation", () => {
  it("classifies rate limit errors", () => {
    expect(classifyProviderError(new Error("429 rate limit"))).toBe("rate_limited");
    expect(classifyProviderError(new Error("401 unauthorized"))).toBe("non_retryable");
  });

  it("calculates bounded retry delay", () => {
    const delay = calculateRetryDelay(2);
    expect(delay).toBeGreaterThan(0);
    expect(delay).toBeLessThanOrEqual(30_000);
  });

  it("stops retrying non-retryable errors", async () => {
    let attempts = 0;
    await expect(
      withProviderRetry(async () => {
        attempts += 1;
        throw new Error("401 unauthorized");
      }, { maxRetries: 3 }),
    ).rejects.toThrow("401");
    expect(attempts).toBe(1);
  });

  it("verifies webhook signatures", () => {
    const secret = "test-secret";
    const rawBody = '{"id":"evt_1"}';
    const signature = createHmac("sha256", secret).update(rawBody).digest("hex");
    expect(verifyHmacWebhookSignature({ rawBody, signature, secret })).toBe(true);
  });

  it("extracts webhook event ids", () => {
    expect(extractWebhookEventId({ id: "evt_123" })).toBe("evt_123");
    expect(extractWebhookEventId({})).toBeNull();
  });

  it("validates webhook timestamps", () => {
    const now = String(Math.floor(Date.now() / 1000));
    expect(isWebhookTimestampValid(now)).toBe(true);
    expect(isWebhookTimestampValid(String(Math.floor(Date.now() / 1000) - 10_000))).toBe(false);
  });

  it("defaults feature flags safely", () => {
    resetEnvCacheForTests();
    delete process.env.PROVIDER_CONNECTORS_ENABLED;
    delete process.env.PROVIDER_LIVE_CALLS_ENABLED;
    expect(isProviderConnectorsEnabled()).toBe(true);
    expect(isProviderLiveCallsEnabled()).toBe(false);
  });
});
