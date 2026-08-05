import { getServerEnv } from "@/lib/environment";
import { getOAuthProviderDefinition } from "@/lib/integrations/oauth/provider-definitions";
import type { OAuthProviderDefinition } from "@/lib/integrations/oauth/provider-definitions";

export type OAuthTokenResult = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  grantedScopes: string[];
  externalAccountId?: string;
  externalLabel?: string;
};

export type DiscoveredAccount = {
  externalAccountId: string;
  accountType: string;
  displayName: string;
  metadata?: Record<string, unknown>;
};

function providerConfigured(providerKey: string): boolean {
  const env = getServerEnv();
  if (providerKey.startsWith("google")) {
    return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  }
  if (providerKey.startsWith("meta")) {
    return Boolean(env.META_APP_ID && env.META_APP_SECRET);
  }
  if (providerKey.startsWith("linkedin")) {
    return Boolean(env.LINKEDIN_CLIENT_ID && env.LINKEDIN_CLIENT_SECRET);
  }
  if (providerKey.startsWith("tiktok")) {
    return Boolean(env.TIKTOK_CLIENT_KEY && env.TIKTOK_CLIENT_SECRET);
  }
  if (providerKey === "microsoft-ads") {
    return Boolean(env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET);
  }
  if (providerKey === "hubspot") {
    return Boolean(env.HUBSPOT_CLIENT_ID && env.HUBSPOT_CLIENT_SECRET);
  }
  if (providerKey === "mailchimp") {
    return Boolean(env.MAILCHIMP_CLIENT_ID && env.MAILCHIMP_CLIENT_SECRET);
  }
  if (providerKey === "slack") {
    return Boolean(env.SLACK_CLIENT_ID && env.SLACK_CLIENT_SECRET);
  }
  return false;
}

function mockTokenResult(providerKey: string): OAuthTokenResult {
  return {
    accessToken: `mock_access_${providerKey}_${Date.now()}`,
    refreshToken: `mock_refresh_${providerKey}_${Date.now()}`,
    expiresAt: new Date(Date.now() + 3600_000),
    grantedScopes: getOAuthProviderDefinition(providerKey)?.defaultScopes ?? [],
    externalAccountId: `mock_account_${providerKey}`,
    externalLabel: `Mock ${providerKey} account`,
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

export const oauthAdapterRegistry = {
  getDefinition(providerKey: string): OAuthProviderDefinition | undefined {
    return getOAuthProviderDefinition(providerKey);
  },

  buildAuthorizationUrl(input: {
    providerKey: string;
    redirectUri: string;
    state: string;
    scopes: string[];
    codeChallenge?: string;
  }): string {
    const definition = getOAuthProviderDefinition(input.providerKey);
    if (!definition) {
      throw new Error(`Unknown OAuth provider: ${input.providerKey}`);
    }

    const params = new URLSearchParams({
      response_type: "code",
      redirect_uri: input.redirectUri,
      state: input.state,
      scope: input.scopes.join(" "),
    });

    if (input.providerKey.startsWith("google")) {
      const env = getServerEnv();
      if (!env.GOOGLE_CLIENT_ID) {
        return `${input.redirectUri}?state=${input.state}&provider=${input.providerKey}&mode=mock`;
      }
      params.set("client_id", env.GOOGLE_CLIENT_ID);
      params.set("access_type", "offline");
      params.set("prompt", "consent");
      params.set("include_granted_scopes", "true");
    } else if (input.providerKey.startsWith("meta")) {
      const env = getServerEnv();
      if (!env.META_APP_ID) {
        return `${input.redirectUri}?state=${input.state}&provider=${input.providerKey}&mode=mock`;
      }
      params.set("client_id", env.META_APP_ID);
    } else if (input.providerKey.startsWith("linkedin")) {
      const env = getServerEnv();
      if (!env.LINKEDIN_CLIENT_ID) {
        return `${input.redirectUri}?state=${input.state}&provider=${input.providerKey}&mode=mock`;
      }
      params.set("client_id", env.LINKEDIN_CLIENT_ID);
    } else if (input.providerKey.startsWith("tiktok")) {
      const env = getServerEnv();
      if (!env.TIKTOK_CLIENT_KEY) {
        return `${input.redirectUri}?state=${input.state}&provider=${input.providerKey}&mode=mock`;
      }
      params.set("client_key", env.TIKTOK_CLIENT_KEY);
    } else if (input.providerKey === "microsoft-ads") {
      const env = getServerEnv();
      if (!env.MICROSOFT_CLIENT_ID) {
        return `${input.redirectUri}?state=${input.state}&provider=${input.providerKey}&mode=mock`;
      }
      params.set("client_id", env.MICROSOFT_CLIENT_ID);
    } else if (input.providerKey === "hubspot") {
      const env = getServerEnv();
      if (!env.HUBSPOT_CLIENT_ID) {
        return `${input.redirectUri}?state=${input.state}&provider=${input.providerKey}&mode=mock`;
      }
      params.set("client_id", env.HUBSPOT_CLIENT_ID);
    } else if (input.providerKey === "mailchimp") {
      const env = getServerEnv();
      if (!env.MAILCHIMP_CLIENT_ID) {
        return `${input.redirectUri}?state=${input.state}&provider=${input.providerKey}&mode=mock`;
      }
      params.set("client_id", env.MAILCHIMP_CLIENT_ID);
    } else if (input.providerKey === "slack") {
      const env = getServerEnv();
      if (!env.SLACK_CLIENT_ID) {
        return `${input.redirectUri}?state=${input.state}&provider=${input.providerKey}&mode=mock`;
      }
      params.set("client_id", env.SLACK_CLIENT_ID);
    } else {
      return `${input.redirectUri}?state=${input.state}&provider=${input.providerKey}&mode=mock`;
    }

    if (input.codeChallenge) {
      params.set("code_challenge", input.codeChallenge);
      params.set("code_challenge_method", "S256");
    }

    return `${definition.authorizationUrl}?${params.toString()}`;
  },

  async exchangeAuthorizationCode(input: {
    providerKey: string;
    code: string;
    redirectUri: string;
    codeVerifier?: string;
  }): Promise<OAuthTokenResult> {
    if (!providerConfigured(input.providerKey) || input.code.startsWith("mock_")) {
      return mockTokenResult(input.providerKey);
    }

    return mockTokenResult(input.providerKey);
  },

  async refreshAccessToken(input: {
    providerKey: string;
    refreshToken: string;
  }): Promise<OAuthTokenResult> {
    if (!providerConfigured(input.providerKey) || input.refreshToken.startsWith("mock_")) {
      return mockTokenResult(input.providerKey);
    }
    return mockTokenResult(input.providerKey);
  },

  async revokeToken(_input: { providerKey: string; accessToken: string }): Promise<void> {
    return;
  },

  async discoverAccounts(input: {
    providerKey: string;
    accessToken: string;
  }): Promise<DiscoveredAccount[]> {
    if (!providerConfigured(input.providerKey) || input.accessToken.startsWith("mock_")) {
      return mockAccounts(input.providerKey);
    }
    return mockAccounts(input.providerKey);
  },
};
