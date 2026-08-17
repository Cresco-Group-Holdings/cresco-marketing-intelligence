import { getOAuthProviderDefinition } from "@/lib/integrations/oauth/provider-definitions";
import type {
  DiscoveredAccount,
  OAuthTokenResult,
  ProviderIdentity,
  ProviderOAuthAdapter,
  ProviderOAuthConfigStatus,
} from "@/lib/providers/oauth/types";

function mockTokenResult(providerKey: string): OAuthTokenResult {
  return {
    accessToken: `mock_access_${providerKey}_${Date.now()}`,
    refreshToken: `mock_refresh_${providerKey}_${Date.now()}`,
    expiresAt: new Date(Date.now() + 3600_000),
    grantedScopes: getOAuthProviderDefinition(providerKey)?.defaultScopes ?? [],
    externalAccountId: `mock_account_${providerKey}`,
    externalLabel: `Mock ${providerKey} account`,
    tokenType: "bearer",
  };
}

function mockAccounts(providerKey: string): DiscoveredAccount[] {
  const definition = getOAuthProviderDefinition(providerKey);
  if (!definition) return [];

  return definition.accountDiscoveryTypes.map((accountType, index) => ({
    externalAccountId: `mock_${providerKey}_${accountType}_${index + 1}`,
    accountType,
    displayName: `${definition.displayName} ${accountType.replace(/_/g, " ")} ${index + 1}`,
    metadata: { mock: true },
  }));
}

export function createMockOAuthAdapter(providerKey: string): ProviderOAuthAdapter {
  return {
    providerKey,

    getConfigStatus(): ProviderOAuthConfigStatus {
      return "READY";
    },

    buildAuthorizationUrl(input) {
      return `${input.redirectUri}?state=${input.state}&provider=${providerKey}&mode=mock`;
    },

    async exchangeAuthorizationCode(input) {
      if (!input.code.startsWith("mock_")) {
        return mockTokenResult(providerKey);
      }
      return mockTokenResult(providerKey);
    },

    async refreshAccessToken(input) {
      if (input.refreshToken.startsWith("mock_")) {
        return mockTokenResult(providerKey);
      }
      return mockTokenResult(providerKey);
    },

    async revokeToken() {
      return;
    },

    async getIdentity() {
      return {
        externalAccountId: `mock_account_${providerKey}`,
        displayName: `Mock ${providerKey} account`,
      } satisfies ProviderIdentity;
    },

    async discoverAccounts() {
      return mockAccounts(providerKey);
    },

    async validateConnection() {
      return { healthy: true };
    },
  };
}
