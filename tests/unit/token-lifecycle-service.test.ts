import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetEnvCacheForTests } from "@/lib/environment";

const prismaMock = vi.hoisted(() => ({
  providerConnection: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(),
  $executeRaw: vi.fn(),
}));

const credentialVaultMock = vi.hoisted(() => ({
  readForExecution: vi.fn(),
  store: vi.fn(),
}));

const oauthAdapterRegistryMock = vi.hoisted(() => ({
  refreshAccessToken: vi.fn(),
}));

const providerAuditServiceMock = vi.hoisted(() => ({
  recordEvent: vi.fn(),
}));

vi.mock("@/lib/database/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/server/services/credential-vault", () => ({ credentialVault: credentialVaultMock }));
vi.mock("@/server/providers/oauth/oauth-adapter-registry", () => ({
  oauthAdapterRegistry: oauthAdapterRegistryMock,
}));
vi.mock("@/server/services/provider-audit-service", () => ({
  providerAuditService: providerAuditServiceMock,
}));

import { tokenLifecycleService } from "@/server/services/token-lifecycle-service";

describe("token lifecycle service", () => {
  beforeEach(() => {
    resetEnvCacheForTests();
    vi.clearAllMocks();
    process.env.ENCRYPTION_KEY = "a".repeat(32);
    process.env.META_APP_ID = "meta_app_id";
    process.env.META_APP_SECRET = "meta_app_secret";
    process.env.ALLOW_OAUTH_MOCK = "true";
    vi.stubEnv("NODE_ENV", "test");

    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => unknown) =>
      callback(prismaMock),
    );
  });

  it("returns active token when not near expiry", async () => {
    prismaMock.providerConnection.findFirst.mockResolvedValue({
      id: "conn_1",
      organisationId: "org_1",
      providerKey: "meta",
      status: "CONNECTED",
      tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      metadata: {},
    });
    credentialVaultMock.readForExecution.mockResolvedValue("valid_access_token");

    const result = await tokenLifecycleService.getValidAccessToken(
      { organisationId: "org_1" },
      "conn_1",
    );

    expect(result.status).toBe("ACTIVE");
    expect(result.accessToken).toBe("valid_access_token");
    expect(oauthAdapterRegistryMock.refreshAccessToken).not.toHaveBeenCalled();
  });

  it("refreshes expired tokens and persists encrypted credentials", async () => {
    const expiresAt = new Date(Date.now() + 5_184_000_000);
    prismaMock.providerConnection.findFirst.mockResolvedValue({
      id: "conn_1",
      organisationId: "org_1",
      providerKey: "meta",
      status: "EXPIRED",
      tokenExpiresAt: new Date(Date.now() - 1000),
      metadata: {},
    });
    credentialVaultMock.readForExecution.mockResolvedValue("refresh_token_value");
    oauthAdapterRegistryMock.refreshAccessToken.mockResolvedValue({
      accessToken: "new_access_token",
      refreshToken: "new_refresh_token",
      expiresAt,
      grantedScopes: ["pages_show_list"],
    });

    const result = await tokenLifecycleService.refreshConnectionTokens(
      { organisationId: "org_1", actorUserId: "user_1" },
      "conn_1",
    );

    expect(result.status).toBe("ACTIVE");
    expect(result.accessToken).toBe("new_access_token");
    expect(credentialVaultMock.store).toHaveBeenCalledWith(
      expect.objectContaining({
        credentialType: "OAUTH_ACCESS_TOKEN",
        plaintext: "new_access_token",
      }),
    );
    expect(providerAuditServiceMock.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CREDENTIAL_REFRESHED", result: "success" }),
    );
  });

  it("uses advisory lock during refresh transaction", async () => {
    prismaMock.providerConnection.findFirst.mockResolvedValue({
      id: "conn_1",
      organisationId: "org_1",
      providerKey: "meta",
      status: "EXPIRED",
      tokenExpiresAt: new Date(Date.now() - 1000),
      metadata: {},
    });
    credentialVaultMock.readForExecution.mockResolvedValue("refresh_token_value");
    oauthAdapterRegistryMock.refreshAccessToken.mockResolvedValue({
      accessToken: "new_access_token",
      expiresAt: new Date(Date.now() + 3600_000),
      grantedScopes: [],
    });

    await tokenLifecycleService.refreshConnectionTokens({ organisationId: "org_1" }, "conn_1");

    expect(prismaMock.$transaction).toHaveBeenCalled();
    expect(prismaMock.$executeRaw).toHaveBeenCalled();
  });

  it("marks connection reauth required when refresh token is missing", async () => {
    prismaMock.providerConnection.findFirst.mockResolvedValue({
      id: "conn_1",
      organisationId: "org_1",
      providerKey: "meta",
      status: "CONNECTED",
      tokenExpiresAt: new Date(Date.now() - 1000),
      metadata: {},
    });
    credentialVaultMock.readForExecution.mockResolvedValue(null);

    const result = await tokenLifecycleService.refreshConnectionTokens(
      { organisationId: "org_1" },
      "conn_1",
    );

    expect(result.status).toBe("REAUTH_REQUIRED");
    expect(prismaMock.providerConnection.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "REAUTH_REQUIRED" }),
      }),
    );
  });

  it("serializes concurrent refresh attempts via advisory lock", async () => {
    prismaMock.providerConnection.findFirst.mockResolvedValue({
      id: "conn_1",
      organisationId: "org_1",
      providerKey: "meta",
      status: "EXPIRED",
      tokenExpiresAt: new Date(Date.now() - 1000),
      metadata: {},
    });
    credentialVaultMock.readForExecution.mockResolvedValue("refresh_token_value");
    oauthAdapterRegistryMock.refreshAccessToken.mockResolvedValue({
      accessToken: "new_access_token",
      expiresAt: new Date(Date.now() + 3600_000),
      grantedScopes: [],
    });

    await Promise.all([
      tokenLifecycleService.refreshConnectionTokens({ organisationId: "org_1" }, "conn_1"),
      tokenLifecycleService.refreshConnectionTokens({ organisationId: "org_1" }, "conn_1"),
    ]);

    expect(oauthAdapterRegistryMock.refreshAccessToken).toHaveBeenCalledTimes(2);
    expect(prismaMock.$executeRaw).toHaveBeenCalled();
  });
});
