import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganisationRole } from "@prisma/client";
import { resetEnvCacheForTests } from "@/lib/environment";
import {
  buildStateDigest,
  encryptOAuthPayload,
  encryptPkceVerifierReference,
  resolveOAuthCallbackUrl,
} from "@/lib/integrations/oauth/security";
import { createSignedOAuthStatePayload } from "@/lib/providers/oauth/state-signing";
import { redactSecrets } from "@/lib/providers/credential-redaction";

const prismaMock = vi.hoisted(() => ({
  oAuthTransaction: {
    findUnique: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  providerConnection: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  userProfile: { findUnique: vi.fn() },
  providerConnectionAccount: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(),
}));

const oauthAdapterMock = vi.hoisted(() => ({
  exchangeAuthorizationCode: vi.fn(),
  validateConnection: vi.fn(),
  discoverAccounts: vi.fn(),
  buildAuthorizationUrl: vi.fn(),
}));

const credentialVaultMock = vi.hoisted(() => ({
  store: vi.fn(),
  readForExecution: vi.fn(),
  revokeAll: vi.fn(),
}));

vi.mock("@/lib/database/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/server/providers/oauth/oauth-adapter-registry", () => ({
  oauthAdapterRegistry: oauthAdapterMock,
}));
vi.mock("@/server/services/credential-vault", () => ({ credentialVault: credentialVaultMock }));
vi.mock("@/server/services/connection-scope-resolver", () => ({
  connectionScopeResolver: {
    upsertScopeRecord: vi.fn(),
    computeMissingScopes: vi.fn().mockReturnValue([]),
    getScopeRecord: vi.fn(),
    resolveRequestedScopes: vi.fn().mockReturnValue(["r_liteprofile"]),
  },
}));
vi.mock("@/server/services/connection-lifecycle-service", () => ({
  connectionLifecycleService: { transition: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock("@/server/services/provider-audit-service", () => ({
  providerAuditService: { recordEvent: vi.fn() },
}));
vi.mock("@/lib/tenancy/guards", () => ({
  buildTenantContextForUser: vi.fn().mockResolvedValue({
    userId: "profile-1",
    userProfileId: "profile-1",
    organisationId: "org-a",
    organisationRole: OrganisationRole.OWNER,
  }),
}));
vi.mock("@/server/services/provider-connection-service", () => ({
  providerConnectionService: {
    createDraftConnection: vi.fn().mockResolvedValue({ id: "conn-linkedin" }),
    getConnection: vi.fn(),
  },
}));
vi.mock("@/server/services/provider-initial-sync-service", () => ({
  providerInitialSyncService: {
    triggerAfterAccountSelection: vi.fn().mockResolvedValue({ queued: true, syncRunId: "sync-1" }),
  },
}));

import { oauthCallbackService } from "@/server/services/oauth-callback-service";
import { oauthAuthorizationService } from "@/server/services/oauth-authorization-service";
import { integrationsConnectionService } from "@/server/services/integrations-connection-service";
import { providerAccountDiscoveryService } from "@/server/services/provider-account-discovery-service";

const tenant = {
  userId: "profile-1",
  userProfileId: "profile-1",
  organisationId: "org-a",
  organisationRole: OrganisationRole.OWNER,
  authUserId: "auth-1",
};

function buildOAuthTransaction(providerKey: string, stateToken: string, orgId = "org-a") {
  const { signed } = createSignedOAuthStatePayload({
    organisationId: orgId,
    providerKey,
    connectionId: "conn-linkedin",
    returnUrl: "/integrations",
    nonce: stateToken,
  });

  return {
    id: "txn-1",
    organisationId: orgId,
    providerKey,
    connectionId: "conn-linkedin",
    initiatedByUserId: "profile-1",
    encryptedState: encryptOAuthPayload({
      stateToken,
      signedState: signed,
      organisationId: orgId,
      userId: "profile-1",
      providerKey,
      connectionId: "conn-linkedin",
    }),
    stateDigest: buildStateDigest(stateToken),
    codeVerifierReference: null,
    requestedScopes: ["r_liteprofile"],
    returnPath: "/integrations",
    redirectUri: resolveOAuthCallbackUrl(providerKey),
    expiresAt: new Date(Date.now() + 10 * 60_000),
    consumedAt: null,
  };
}

describe("Task 4.1 provider OAuth journeys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetEnvCacheForTests();
    process.env.ENCRYPTION_KEY = "a".repeat(32);
    process.env.OAUTH_STATE_SIGNING_KEY = "b".repeat(32);
    process.env.APP_URL = "https://app.example.com";
    process.env.LINKEDIN_CLIENT_ID = "linkedin-id";
    process.env.LINKEDIN_CLIENT_SECRET = "linkedin-secret";
    process.env.GOOGLE_CLIENT_ID = "google-id";
    process.env.GOOGLE_CLIENT_SECRET = "google-secret";
    process.env.ALLOW_OAUTH_MOCK = "true";
    vi.stubEnv("NODE_ENV", "test");

    oauthAdapterMock.exchangeAuthorizationCode.mockResolvedValue({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresAt: new Date(Date.now() + 3600_000),
      grantedScopes: ["r_liteprofile"],
    });
    oauthAdapterMock.validateConnection.mockResolvedValue({ healthy: true });
    oauthAdapterMock.discoverAccounts.mockResolvedValue([
      {
        externalAccountId: "org-123",
        accountType: "organization",
        displayName: "Acme Marketing",
        metadata: {},
      },
    ]);
    oauthAdapterMock.buildAuthorizationUrl.mockReturnValue("https://provider.example/oauth");

    prismaMock.userProfile.findUnique.mockResolvedValue({
      id: "profile-1",
      authUserId: "auth-1",
    });
    prismaMock.providerConnection.findFirst.mockResolvedValue({
      id: "conn-linkedin",
      organisationId: "org-a",
      providerKey: "linkedin",
      status: "CONNECTED",
      metadata: {},
    });
    prismaMock.$transaction.mockImplementation(async (ops: unknown) => {
      if (typeof ops === "function") return ops(prismaMock);
      if (Array.isArray(ops)) {
        for (const op of ops) await op;
      }
    });
  });

  describe("Journey A — LinkedIn connect and discovery", () => {
    it("completes OAuth callback, discovers accounts, and consumes transaction", async () => {
      const stateToken = "state-linkedin-abc";
      const transaction = buildOAuthTransaction("linkedin", stateToken);
      prismaMock.oAuthTransaction.findUnique.mockResolvedValue(transaction);

      const result = await oauthCallbackService.handleCallback({
        providerKey: "linkedin",
        code: "auth-code",
        state: stateToken,
        redirectUri: transaction.redirectUri,
      });

      expect(result.connectionId).toBe("conn-linkedin");
      expect(result.status).toBe("CONNECTED");
      expect(oauthAdapterMock.discoverAccounts).toHaveBeenCalled();
      expect(prismaMock.oAuthTransaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ consumedAt: expect.any(Date) }),
        }),
      );
      expect(credentialVaultMock.store).toHaveBeenCalled();
    });
  });

  describe("Journey B — GA4 property selection", () => {
    it("discovers multiple properties without auto-selecting the first", async () => {
      oauthAdapterMock.discoverAccounts.mockResolvedValue([
        {
          externalAccountId: "properties/111",
          accountType: "analytics_property",
          displayName: "Main Website",
          metadata: { hierarchy: "GA4 Property" },
        },
        {
          externalAccountId: "properties/222",
          accountType: "analytics_property",
          displayName: "Mobile App",
          metadata: { hierarchy: "GA4 Property" },
        },
      ]);

      prismaMock.providerConnectionAccount.deleteMany.mockResolvedValue({ count: 0 });
      prismaMock.providerConnectionAccount.createMany.mockResolvedValue({ count: 2 });

      const result = await providerAccountDiscoveryService.discoverAndStoreAccounts({
        organisationId: "org-a",
        connectionId: "conn-ga4",
        providerKey: "google-analytics",
        accessToken: "ga-token",
      });

      expect(result.discovered).toBe(2);
      expect(prismaMock.providerConnectionAccount.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ displayName: "Main Website" }),
            expect.objectContaining({ displayName: "Mobile App" }),
          ]),
        }),
      );
    });

    it("queues 90-day initial sync only after explicit property selection", async () => {
      prismaMock.providerConnectionAccount.findMany.mockResolvedValue([
        {
          id: "acc-1",
          externalAccountId: "properties/222",
          accountType: "analytics_property",
          displayName: "Mobile App",
          status: "DISCOVERED",
        },
        {
          id: "acc-2",
          externalAccountId: "properties/111",
          accountType: "analytics_property",
          displayName: "Main Website",
          status: "DISCOVERED",
        },
      ]);

      const { providerConnectionService } = await import("@/server/services/provider-connection-service");
      vi.mocked(providerConnectionService.getConnection).mockResolvedValue({
        id: "conn-ga4",
        providerKey: "google-analytics",
      } as never);

      await integrationsConnectionService.selectAccounts(tenant, "conn-ga4", ["properties/222"]);

      const { providerInitialSyncService } = await import("@/server/services/provider-initial-sync-service");
      expect(providerInitialSyncService.triggerAfterAccountSelection).toHaveBeenCalledWith(
        tenant,
        "conn-ga4",
        "google-analytics",
      );
    });
  });

  describe("Journey C — reauthentication", () => {
    it("reuses the same logical connection during reconnect", async () => {
    const { providerConnectionService } = await import("@/server/services/provider-connection-service");
    vi.mocked(providerConnectionService.getConnection).mockResolvedValue({
      id: "conn-linkedin",
      providerKey: "linkedin",
    } as never);

    prismaMock.providerConnection.findFirst.mockResolvedValue({
      id: "conn-linkedin",
      organisationId: "org-a",
      providerKey: "linkedin",
      status: "REAUTH_REQUIRED",
    });

    oauthAdapterMock.buildAuthorizationUrl.mockReturnValue("https://linkedin.example/oauth");
    prismaMock.oAuthTransaction.create.mockResolvedValue({ id: "txn-reconnect" });

    const result = await integrationsConnectionService.reconnect(tenant, "conn-linkedin");

    expect(result.connectionId).toBe("conn-linkedin");
    expect(result.authorizeUrl).toContain("https://");
  });
  });

  describe("invalid OAuth state and replay", () => {
    it("rejects malformed, expired, reused, and foreign-tenant state", async () => {
      const redirectUri = resolveOAuthCallbackUrl("linkedin");

      await expect(
        oauthCallbackService.handleCallback({
          providerKey: "linkedin",
          code: "code",
          state: "unknown-state",
          redirectUri,
        }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

      const stateToken = "state-expired";
      prismaMock.oAuthTransaction.findUnique.mockResolvedValue({
        ...buildOAuthTransaction("linkedin", stateToken),
        expiresAt: new Date(Date.now() - 60_000),
      });
      await expect(
        oauthCallbackService.handleCallback({
          providerKey: "linkedin",
          code: "code",
          state: stateToken,
          redirectUri,
        }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

      const consumed = { ...buildOAuthTransaction("linkedin", "state-used"), consumedAt: new Date() };
      prismaMock.oAuthTransaction.findUnique.mockResolvedValue(consumed);
      await expect(
        oauthCallbackService.handleCallback({
          providerKey: "linkedin",
          code: "code",
          state: "state-used",
          redirectUri,
        }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

      const foreignState = "state-foreign";
      const { signed } = createSignedOAuthStatePayload({
        organisationId: "org-a",
        providerKey: "linkedin",
        connectionId: "conn-linkedin",
        returnUrl: "/integrations",
        nonce: foreignState,
      });
      prismaMock.oAuthTransaction.findUnique.mockResolvedValue({
        ...buildOAuthTransaction("linkedin", foreignState, "org-b"),
        organisationId: "org-b",
        encryptedState: encryptOAuthPayload({
          stateToken: foreignState,
          signedState: signed,
          organisationId: "org-a",
          userId: "profile-1",
          providerKey: "linkedin",
          connectionId: "conn-linkedin",
        }),
      });
      await expect(
        oauthCallbackService.handleCallback({
          providerKey: "linkedin",
          code: "code",
          state: "state-foreign",
          redirectUri,
        }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    });

    it("rejects callback replay after successful consumption", async () => {
      const stateToken = "state-replay";
      const transaction = buildOAuthTransaction("linkedin", stateToken);
      prismaMock.oAuthTransaction.findUnique
        .mockResolvedValueOnce(transaction)
        .mockResolvedValueOnce({ ...transaction, consumedAt: new Date() });

      await oauthCallbackService.handleCallback({
        providerKey: "linkedin",
        code: "auth-code",
        state: stateToken,
        redirectUri: transaction.redirectUri,
      });

      await expect(
        oauthCallbackService.handleCallback({
          providerKey: "linkedin",
          code: "auth-code",
          state: stateToken,
          redirectUri: transaction.redirectUri,
        }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    });
  });

  describe("token security", () => {
    it("redacts tokens from API-safe payloads", () => {
      const safe = redactSecrets({
        access_token: "secret-access",
        refresh_token: "secret-refresh",
        displayName: "Acme Org",
      }) as Record<string, string>;

      expect(safe.access_token).toBe("[REDACTED]");
      expect(safe.refresh_token).toBe("[REDACTED]");
      expect(safe.displayName).toBe("Acme Org");
    });
  });
});
