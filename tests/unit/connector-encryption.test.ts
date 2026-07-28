import { beforeEach, describe, expect, it } from "vitest";
import {
  decryptSecret,
  encryptSecret,
  getCurrentEncryptionKeyVersion,
  rotateEncryptedSecret,
} from "@/lib/security/encryption";
import { resetEnvCacheForTests } from "@/lib/environment";

describe("connector credential encryption", () => {
  beforeEach(() => {
    resetEnvCacheForTests();
  });

  it("encrypts and decrypts secrets", () => {
    const encrypted = encryptSecret("access-token-value");
    expect(encrypted).not.toContain("access-token-value");
    expect(decryptSecret(encrypted)).toBe("access-token-value");
  });

  it("supports key rotation", () => {
    const encrypted = encryptSecret("refresh-token-value");
    const rotated = rotateEncryptedSecret(encrypted);
    expect(decryptSecret(rotated)).toBe("refresh-token-value");
    expect(getCurrentEncryptionKeyVersion()).toBeGreaterThan(0);
  });
});
