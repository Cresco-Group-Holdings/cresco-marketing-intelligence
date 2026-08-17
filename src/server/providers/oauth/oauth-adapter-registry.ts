import { AppError } from "@/lib/errors";
import { getOAuthProviderDefinition } from "@/lib/integrations/oauth/provider-definitions";
import type { DiscoveredAccount, OAuthTokenResult } from "@/lib/providers/oauth/types";
import { getProviderOAuthConfigDetail } from "@/lib/providers/oauth/provider-config";
import { resolveProviderOAuthAdapter } from "@/server/providers/oauth/oauth-adapter-factory";

export type { OAuthTokenResult, DiscoveredAccount };

export const oauthAdapterRegistry = {
  getDefinition(providerKey: string) {
    return getOAuthProviderDefinition(providerKey);
  },

  getConfigStatus(providerKey: string) {
    return getProviderOAuthConfigDetail(providerKey);
  },

  buildAuthorizationUrl(input: {
    providerKey: string;
    redirectUri: string;
    state: string;
    scopes: string[];
    codeChallenge?: string;
  }): string {
    const adapter = resolveProviderOAuthAdapter(input.providerKey);
    return adapter.buildAuthorizationUrl({
      redirectUri: input.redirectUri,
      state: input.state,
      scopes: input.scopes,
      codeChallenge: input.codeChallenge,
    });
  },

  async exchangeAuthorizationCode(input: {
    providerKey: string;
    code: string;
    redirectUri: string;
    codeVerifier?: string;
  }): Promise<OAuthTokenResult> {
    if (input.code.startsWith("mock_") && process.env.NODE_ENV === "production" && process.env.ALLOW_OAUTH_MOCK !== "true") {
      throw new AppError("VALIDATION_ERROR", "Mock authorization codes are not permitted in production.");
    }

    const adapter = resolveProviderOAuthAdapter(input.providerKey);
    return adapter.exchangeAuthorizationCode({
      code: input.code,
      redirectUri: input.redirectUri,
      codeVerifier: input.codeVerifier,
    });
  },

  async refreshAccessToken(input: {
    providerKey: string;
    refreshToken: string;
  }): Promise<OAuthTokenResult> {
    const adapter = resolveProviderOAuthAdapter(input.providerKey);
    return adapter.refreshAccessToken({ refreshToken: input.refreshToken });
  },

  async revokeToken(input: { providerKey: string; accessToken: string }): Promise<void> {
    const adapter = resolveProviderOAuthAdapter(input.providerKey);
    await adapter.revokeToken({ accessToken: input.accessToken });
  },

  async discoverAccounts(input: {
    providerKey: string;
    accessToken: string;
  }): Promise<DiscoveredAccount[]> {
    const adapter = resolveProviderOAuthAdapter(input.providerKey);
    return adapter.discoverAccounts({ accessToken: input.accessToken });
  },

  async validateConnection(input: {
    providerKey: string;
    accessToken: string;
  }): Promise<{ healthy: boolean; message?: string }> {
    const adapter = resolveProviderOAuthAdapter(input.providerKey);
    return adapter.validateConnection({ accessToken: input.accessToken });
  },

  async getIdentity(input: { providerKey: string; accessToken: string }) {
    const adapter = resolveProviderOAuthAdapter(input.providerKey);
    return adapter.getIdentity({ accessToken: input.accessToken });
  },
};
