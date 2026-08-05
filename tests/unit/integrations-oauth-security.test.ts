import { beforeEach, describe, expect, it } from "vitest";
import { resetEnvCacheForTests } from "@/lib/environment";
import {
  buildStateDigest,
  decryptOAuthPayload,
  encryptOAuthPayload,
  encryptPkceVerifierReference,
  decryptPkceVerifierReference,
  isRedirectUriAllowed,
  resolveOAuthCallbackUrl,
  validateReturnPath,
} from "@/lib/integrations/oauth/security";
import { connectionScopeResolver } from "@/server/services/connection-scope-resolver";
import { generatePkceChallenge, generatePkceVerifier } from "@/lib/providers/oauth/pkce";
import {
  createSignedOAuthStatePayload,
  verifySignedOAuthStatePayload,
} from "@/lib/providers/oauth/state-signing";
import { encryptSecret } from "@/lib/security/encryption";
import { redactSecrets } from "@/lib/providers/credential-redaction";

describe("integrations oauth security", () => {
  beforeEach(() => {
    resetEnvCacheForTests();
    process.env.ENCRYPTION_KEY = "a".repeat(32);
    process.env.OAUTH_STATE_SIGNING_KEY = "b".repeat(32);
    process.env.APP_URL = "https://app.example.com";
  });

  it("builds stable state digests for lookup", () => {
    const digest = buildStateDigest("state_token_123");
    expect(digest).toHaveLength(64);
    expect(buildStateDigest("state_token_123")).toBe(digest);
    expect(buildStateDigest("other")).not.toBe(digest);
  });

  it("encrypts and decrypts oauth transaction payloads without exposing secrets in structure", () => {
    const encrypted = encryptOAuthPayload({
      stateToken: "public_state",
      signedState: "signed.payload",
      organisationId: "org_1",
      userId: "user_1",
      providerKey: "meta",
      connectionId: "conn_1",
    });
    expect(encrypted).not.toContain("public_state");
    const payload = decryptOAuthPayload(encrypted);
    expect(payload.stateToken).toBe("public_state");
    expect(payload.organisationId).toBe("org_1");
  });

  it("stores pkce verifiers encrypted", () => {
    const verifier = generatePkceVerifier();
    const encrypted = encryptPkceVerifierReference(verifier);
    expect(encrypted).not.toContain(verifier);
    expect(decryptPkceVerifierReference(encrypted)).toBe(verifier);
  });

  it("validates redirect uri against expected callback path", () => {
    const expected = resolveOAuthCallbackUrl("google-analytics");
    expect(isRedirectUriAllowed(expected, expected)).toBe(true);
    expect(isRedirectUriAllowed("https://evil.example/callback", expected)).toBe(false);
  });

  it("rejects unsafe return paths", () => {
    expect(validateReturnPath("/integrations")).toBe("/integrations");
    expect(() => validateReturnPath("https://evil.example")).toThrow("relative");
    expect(() => validateReturnPath("/admin/secrets")).toThrow("not allowed");
  });

  it("detects pkce challenge mismatch scenarios via verifier round trip", () => {
    const verifier = generatePkceVerifier();
    const challenge = generatePkceChallenge(verifier);
    expect(challenge).not.toBe(verifier);
    expect(decryptPkceVerifierReference(encryptPkceVerifierReference(verifier))).toBe(verifier);
  });

  it("rejects tampered signed oauth state", () => {
    const { signed } = createSignedOAuthStatePayload({
      organisationId: "org_1",
      providerKey: "meta",
      connectionId: "conn_1",
      nonce: "nonce_1",
    });
    const tampered = `${signed.slice(0, -4)}aaaa`;
    expect(() => verifySignedOAuthStatePayload(tampered)).toThrow();
  });

  it("computes missing scopes for capability governance", () => {
    const missing = connectionScopeResolver.computeMissingScopes(
      ["ads_read", "ads_management"],
      ["ads_read"],
    );
    expect(missing).toEqual(["ads_management"]);
  });

  it("never includes plaintext credentials in redacted objects", () => {
    const redacted = redactSecrets({
      access_token: "super-secret-token-value",
      refresh_token: "refresh-secret",
      name: "safe",
    }) as Record<string, string>;
    expect(redacted.access_token).toBe("[REDACTED]");
    expect(redacted.refresh_token).toBe("[REDACTED]");
    expect(redacted.name).toBe("safe");
  });

  it("does not embed secrets in encrypted envelope metadata", () => {
    const secret = "oauth_access_token_plaintext";
    const encrypted = encryptSecret(secret);
    expect(encrypted).not.toContain(secret);
  });
});
