import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganisationRole } from "@prisma/client";
import {
  createMockOAuthState,
  createMockSocialConnection,
  socialTenantContext,
  socialTestIds,
} from "../helpers/social-mocks";
import {
  registerMockSocialAdapter,
  resetSocialAdaptersForTests,
} from "@/lib/social/adapters/mock-social-adapter";
import { resetSocialBootstrapForTests } from "@/lib/social/bootstrap";
import { detectCapabilities, getMissingScopes } from "@/lib/social/capabilities";
import { hasPermission, PERMISSIONS } from "@/lib/tenancy/permissions";
import { encryptSecret } from "@/lib/security/encryption";

const prismaMock = vi.hoisted(() => ({
  socialConnection: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
  },
  socialAccount: {
    deleteMany: vi.fn(),
    create: vi.fn(),
  },
  socialConnectionCredential: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
    deleteMany: vi.fn(),
    update: vi.fn(),
  },
  oAuthAuthorisationState: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  credentialRotationEvent: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/database/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/server/services/workspace-service", () => ({
  brandService: {
    getById: vi.fn().mockResolvedValue({
      id: socialTestIds.brandId,
      projectId: socialTestIds.projectId,
    }),
  },
}));
vi.mock("@/server/services/audit-service", () => ({
  recordAuditEvent: vi.fn(),
}));

import { resetEnvCacheForTests } from "@/lib/environment";
import { socialConnectionService } from "@/server/services/social-connection-service";
import { socialOAuthService } from "@/server/services/social-oauth-service";
import { socialCredentialService } from "@/server/services/social-credential-service";

describe("social permissions", () => {
  it("allows owners and admins full social management", () => {
    expect(hasPermission(OrganisationRole.OWNER, PERMISSIONS["socialConnections.create"])).toBe(
      true,
    );
    expect(hasPermission(OrganisationRole.ADMIN, PERMISSIONS["socialAccounts.assign"])).toBe(true);
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["socialConnections.create"])).toBe(
      false,
    );
    expect(hasPermission(OrganisationRole.ANALYST, PERMISSIONS["socialConnections.read"])).toBe(
      true,
    );
  });
});

describe("social capabilities", () => {
  it("detects capabilities from account type and scopes", () => {
    const capabilities = detectCapabilities("INSTAGRAM_BUSINESS", [
      "instagram_content_publish",
      "instagram_basic",
    ]);
    expect(capabilities).toContain("PUBLISH_IMAGE");
    expect(capabilities).toContain("READ_INSIGHTS");
  });

  it("reports missing scopes", () => {
    expect(getMissingScopes(["read", "write"], ["read"])).toEqual(["write"]);
  });
});

describe("socialCredentialService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("encrypts tokens on upsert", async () => {
    prismaMock.socialConnectionCredential.upsert.mockResolvedValue({});
    await socialCredentialService.upsertTokens(socialTestIds.connectionId, {
      accessToken: "secret-access",
      refreshToken: "secret-refresh",
      scopes: ["read"],
    });

    const payload = prismaMock.socialConnectionCredential.upsert.mock.calls[0][0];
    expect(payload.create.encryptedAccessToken).not.toContain("secret-access");
    expect(payload.create.encryptedRefreshToken).not.toContain("secret-refresh");
  });

  it("deletes credentials on disconnect", async () => {
    prismaMock.socialConnectionCredential.deleteMany.mockResolvedValue({ count: 1 });
    await socialCredentialService.deleteCredentials(socialTestIds.connectionId);
    expect(prismaMock.socialConnectionCredential.deleteMany).toHaveBeenCalledWith({
      where: { socialConnectionId: socialTestIds.connectionId },
    });
  });
});

describe("socialOAuthService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetEnvCacheForTests();
    resetSocialAdaptersForTests();
    resetSocialBootstrapForTests();
    registerMockSocialAdapter("INSTAGRAM");
    process.env.META_APP_ID = "meta-app-id";
    process.env.META_APP_SECRET = "meta-app-secret";
  });

  it("rejects expired oauth state", async () => {
    prismaMock.oAuthAuthorisationState.findUnique.mockResolvedValue(
      createMockOAuthState({ expiresAt: new Date(Date.now() - 1_000) }),
    );
    prismaMock.oAuthAuthorisationState.delete.mockResolvedValue({});

    await expect(
      socialOAuthService.validateState("valid-oauth-state", socialTestIds.userProfileId),
    ).rejects.toThrow(/expired/i);
  });

  it("rejects replayed oauth state", async () => {
    prismaMock.oAuthAuthorisationState.findUnique.mockResolvedValue(
      createMockOAuthState({ consumedAt: new Date() }),
    );

    await expect(
      socialOAuthService.validateState("valid-oauth-state", socialTestIds.userProfileId),
    ).rejects.toThrow(/already been used/i);
  });

  it("rejects cross-user oauth state", async () => {
    prismaMock.oAuthAuthorisationState.findUnique.mockResolvedValue(createMockOAuthState());

    await expect(
      socialOAuthService.validateState("valid-oauth-state", "other-user"),
    ).rejects.toThrow(/does not belong/i);
  });

  it("exchanges code and stores encrypted credentials without exposing tokens", async () => {
    prismaMock.oAuthAuthorisationState.findUnique.mockResolvedValue(createMockOAuthState());
    prismaMock.socialConnectionCredential.upsert.mockResolvedValue({});
    prismaMock.$transaction.mockImplementation(async (operations: unknown) => {
      if (typeof operations === "function") {
        return (operations as (tx: typeof prismaMock) => Promise<unknown>)(prismaMock);
      }
      return Promise.all(operations as Promise<unknown>[]);
    });
    prismaMock.socialConnection.update.mockResolvedValue({});
    prismaMock.oAuthAuthorisationState.update.mockResolvedValue({});

    const result = await socialOAuthService.handleCallback({
      state: "valid-oauth-state",
      code: "auth-code",
      userId: socialTestIds.userProfileId,
    });

    expect(result.pendingAccountCount).toBeGreaterThan(1);
    const upsertPayload = prismaMock.socialConnectionCredential.upsert.mock.calls[0][0];
    expect(upsertPayload.create.encryptedAccessToken).not.toContain("mock-access");
  });
});

describe("socialConnectionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetEnvCacheForTests();
    resetSocialAdaptersForTests();
    resetSocialBootstrapForTests();
    registerMockSocialAdapter("INSTAGRAM");
    process.env.META_APP_ID = "meta-app-id";
    process.env.META_APP_SECRET = "meta-app-secret";
    prismaMock.socialConnection.findMany.mockResolvedValue([]);
  });

  it("returns catalogue without credentials", async () => {
    const catalogue = await socialConnectionService.getCatalogue(
      socialTestIds.brandId,
      socialTestIds.organisationId,
      socialTenantContext,
    );
    expect(catalogue.length).toBe(6);
    expect(JSON.stringify(catalogue)).not.toContain("accessToken");
    expect(JSON.stringify(catalogue)).not.toContain("refreshToken");
  });

  it("requires explicit account selection", async () => {
    const connection = createMockSocialConnection({
      pendingAccounts: [
        { providerAccountId: "instagram-account-1", accountType: "INSTAGRAM_BUSINESS" },
        { providerAccountId: "instagram-account-2", accountType: "INSTAGRAM_BUSINESS" },
      ],
    });
    prismaMock.socialConnection.findFirst.mockResolvedValue(connection);

    const pending = await socialConnectionService.getPendingAccounts(
      socialTestIds.brandId,
      socialTestIds.organisationId,
      socialTestIds.connectionId,
      socialTenantContext,
    );

    expect(pending).toHaveLength(2);
  });

  it("deletes credentials on disconnect", async () => {
    prismaMock.socialConnection.findFirst.mockResolvedValue(createMockSocialConnection());
    prismaMock.socialConnectionCredential.findUnique.mockResolvedValue({
      encryptedAccessToken: encryptSecret("token"),
    });
    prismaMock.socialConnectionCredential.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.$transaction.mockResolvedValue([]);
    prismaMock.socialAccount.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.socialConnection.update.mockResolvedValue({});

    await socialConnectionService.disconnect(
      socialTestIds.brandId,
      socialTestIds.organisationId,
      socialTestIds.connectionId,
      socialTenantContext,
    );

    expect(prismaMock.socialConnectionCredential.deleteMany).toHaveBeenCalled();
  });
});
