import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  decryptSecret,
  encryptSecret,
  getCurrentEncryptionKeyVersion,
  rotateEncryptedSecret,
} from "@/lib/security/encryption";
import { resetEnvCacheForTests } from "@/lib/environment";

const prismaMock = vi.hoisted(() => ({
  socialConnectionCredential: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

vi.mock("@/lib/database/prisma", () => ({ prisma: prismaMock }));

import { socialCredentialService } from "@/server/services/social-credential-service";

describe("social credential encryption", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetEnvCacheForTests();
  });

  it("encrypts and decrypts access and refresh tokens", () => {
    const encryptedAccess = encryptSecret("social-access-token");
    const encryptedRefresh = encryptSecret("social-refresh-token");
    expect(encryptedAccess).not.toContain("social-access-token");
    expect(encryptedRefresh).not.toContain("social-refresh-token");
    expect(decryptSecret(encryptedAccess)).toBe("social-access-token");
    expect(decryptSecret(encryptedRefresh)).toBe("social-refresh-token");
  });

  it("supports key rotation without changing the decrypted token value", () => {
    const encrypted = encryptSecret("rotatable-social-token");
    const rotated = rotateEncryptedSecret(encrypted);
    expect(decryptSecret(rotated)).toBe("rotatable-social-token");
    expect(getCurrentEncryptionKeyVersion()).toBeGreaterThan(0);
  });

  it("stores encrypted tokens through upsert without persisting plaintext", async () => {
    prismaMock.socialConnectionCredential.upsert.mockResolvedValue({});
    await socialCredentialService.upsertTokens("connection-1", {
      accessToken: "stored-access",
      refreshToken: "stored-refresh",
      expiresAt: new Date(Date.now() + 3_600_000),
      scopes: ["instagram_content_publish"],
    });

    const payload = prismaMock.socialConnectionCredential.upsert.mock.calls[0]![0];
    expect(payload.create.encryptedAccessToken).not.toContain("stored-access");
    expect(payload.create.encryptedRefreshToken).not.toContain("stored-refresh");
    expect(payload.create.encryptionKeyVersion).toBe(getCurrentEncryptionKeyVersion());
  });

  it("decrypts tokens read from the credential store", async () => {
    const encryptedAccess = encryptSecret("read-back-access");
    const encryptedRefresh = encryptSecret("read-back-refresh");
    prismaMock.socialConnectionCredential.findUnique.mockResolvedValue({
      encryptedAccessToken: encryptedAccess,
      encryptedRefreshToken: encryptedRefresh,
    });

    await expect(socialCredentialService.readTokens("connection-1")).resolves.toEqual({
      accessToken: "read-back-access",
      refreshToken: "read-back-refresh",
    });
  });

  it("deletes credentials on disconnect", async () => {
    prismaMock.socialConnectionCredential.deleteMany.mockResolvedValue({ count: 1 });
    await socialCredentialService.deleteCredentials("connection-1");
    expect(prismaMock.socialConnectionCredential.deleteMany).toHaveBeenCalledWith({
      where: { socialConnectionId: "connection-1" },
    });
  });
});
