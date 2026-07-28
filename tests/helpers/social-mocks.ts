import type { TenantContext } from "@/lib/tenancy/context";

export const socialTestIds = {
  organisationId: "org-social-test",
  projectId: "project-social-test",
  brandId: "brand-social-test",
  userProfileId: "user-social-test",
  connectionId: "connection-social-test",
};

export const socialTenantContext: TenantContext = {
  userId: "auth-user-social-test",
  userProfileId: socialTestIds.userProfileId,
  organisationId: socialTestIds.organisationId,
  organisationRole: "OWNER",
  projectId: socialTestIds.projectId,
  brandId: socialTestIds.brandId,
};

export function createMockSocialConnection(
  overrides: Partial<{
    id: string;
    provider: import("@prisma/client").SocialProvider;
    status: import("@prisma/client").SocialConnectionStatus;
    grantedScopes: string[];
    pendingAccounts: unknown;
  }> = {},
) {
  return {
    id: socialTestIds.connectionId,
    organisationId: socialTestIds.organisationId,
    projectId: socialTestIds.projectId,
    brandId: socialTestIds.brandId,
    provider: "INSTAGRAM" as const,
    status: "CONNECTING" as const,
    grantedScopes: ["instagram_basic"],
    connectedByUserId: socialTestIds.userProfileId,
    tokenExpiresAt: new Date(Date.now() + 3_600_000),
    lastValidatedAt: null,
    lastRefreshAt: null,
    reconnectRequiredAt: null,
    pendingAccounts: null,
    disconnectedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    accounts: [],
    ...overrides,
  };
}

export function createMockOAuthState(
  overrides: Partial<{
    id: string;
    state: string;
    userId: string;
    organisationId: string;
    brandId: string;
    consumedAt: Date | null;
    expiresAt: Date;
  }> = {},
) {
  return {
    id: "oauth-state-test",
    organisationId: socialTestIds.organisationId,
    projectId: socialTestIds.projectId,
    brandId: socialTestIds.brandId,
    userId: socialTestIds.userProfileId,
    socialConnectionId: socialTestIds.connectionId,
    provider: "INSTAGRAM" as const,
    state: "valid-oauth-state",
    codeVerifier: "verifier",
    scopes: ["instagram_basic"],
    redirectUri: "http://localhost:3000/api/social/oauth/callback",
    expiresAt: new Date(Date.now() + 600_000),
    consumedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}
