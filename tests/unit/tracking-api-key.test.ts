import { describe, expect, it } from "vitest";
import {
  generateTrackingApiKey,
  hashTrackingApiKey,
  signServerEventPayload,
  verifyServerEventSignature,
  verifyTrackingApiKey,
} from "@/lib/tracking/api-key";

describe("tracking API keys", () => {
  it("generates keys with stable hashes", () => {
    const { key, hash, prefix } = generateTrackingApiKey();
    expect(key.startsWith("ctk_")).toBe(true);
    expect(prefix).toBe(key.slice(0, 12));
    expect(hashTrackingApiKey(key)).toBe(hash);
    expect(verifyTrackingApiKey(key, hash)).toBe(true);
  });

  it("validates server event signatures", () => {
    const payload = JSON.stringify({ eventName: "signup_complete" });
    const { key } = generateTrackingApiKey();
    const signature = signServerEventPayload(payload, key);
    expect(verifyServerEventSignature(payload, key, signature)).toBe(true);
    expect(verifyServerEventSignature(payload, key, "bad-signature")).toBe(false);
  });
});
