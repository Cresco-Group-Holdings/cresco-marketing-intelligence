import { beforeEach, describe, expect, it } from "vitest";
import { encryptSecret, decryptSecret } from "@/lib/security/encryption";
import { resetEnvCacheForTests } from "@/lib/environment";
import { fingerprintCredential, redactSecrets } from "@/lib/providers/credential-redaction";

describe("provider credential security", () => {
  beforeEach(() => {
    resetEnvCacheForTests();
    process.env.ENCRYPTION_KEY = "a".repeat(32);
  });
  it("round-trips encrypted credentials", () => {
    const encrypted = encryptSecret("super-secret-token");
    const decrypted = decryptSecret(encrypted);
    expect(decrypted).toBe("super-secret-token");
  });

  it("redacts sensitive keys from objects", () => {
    const redacted = redactSecrets({
      api_key: "sk_live_1234567890abcdef",
      name: "safe",
    }) as Record<string, string>;
    expect(redacted.api_key).toBe("[REDACTED]");
    expect(redacted.name).toBe("safe");
  });

  it("fingerprints credentials for display", () => {
    expect(fingerprintCredential("abcdefghijklmnop")).toBe("****mnop");
  });
});
