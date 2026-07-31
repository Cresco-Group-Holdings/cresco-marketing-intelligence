import { beforeEach, describe, expect, it } from "vitest";
import { resetEnvCacheForTests } from "@/lib/environment";
import {
  createSignedOAuthStatePayload,
  signOAuthStatePayload,
  verifySignedOAuthStatePayload,
} from "@/lib/providers/oauth/state-signing";
import { generatePkceChallenge, generatePkceVerifier } from "@/lib/providers/oauth/pkce";
import { isReturnUrlAllowed } from "@/lib/providers/oauth/security";

describe("provider oauth foundation", () => {
  beforeEach(() => {
    resetEnvCacheForTests();
    process.env.ENCRYPTION_KEY = "a".repeat(32);
    process.env.OAUTH_STATE_SIGNING_KEY = "b".repeat(32);
  });

  it("signs and verifies oauth state payload", () => {
    const { signed } = createSignedOAuthStatePayload({
      organisationId: "org_1",
      providerKey: "meta",
      connectionId: "conn_1",
      returnUrl: "/integrations",
      nonce: "nonce_1",
    });
    const payload = verifySignedOAuthStatePayload(signed);
    expect(payload.organisationId).toBe("org_1");
    expect(payload.providerKey).toBe("meta");
  });

  it("rejects expired oauth state", () => {
    const payload = {
      organisationId: "org_1",
      providerKey: "meta",
      nonce: "nonce_1",
      issuedAt: Date.now() - 60_000,
      expiresAt: Date.now() - 1_000,
    };
    const signed = signOAuthStatePayload(payload);
    expect(() => verifySignedOAuthStatePayload(signed)).toThrow("expired");
  });

  it("generates pkce verifier and challenge", () => {
    const verifier = generatePkceVerifier();
    const challenge = generatePkceChallenge(verifier);
    expect(verifier.length).toBeGreaterThan(20);
    expect(challenge.length).toBeGreaterThan(20);
  });

  it("allowlists safe return urls", () => {
    expect(isReturnUrlAllowed("/integrations")).toBe(true);
    expect(isReturnUrlAllowed("https://evil.example")).toBe(false);
  });
});
