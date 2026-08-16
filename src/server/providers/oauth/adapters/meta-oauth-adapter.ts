import { AppError } from "@/lib/errors";
import { getServerEnv } from "@/lib/environment";
import { getOAuthProviderDefinition } from "@/lib/integrations/oauth/provider-definitions";
import type {
  DiscoveredAccount,
  OAuthTokenResult,
  ProviderIdentity,
  ProviderOAuthAdapter,
  ProviderOAuthConfigStatus,
} from "@/lib/providers/oauth/types";

const META_GRAPH = "https://graph.facebook.com/v19.0";

type MetaTokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
};

type MetaMeResponse = {
  id: string;
  name?: string;
  email?: string;
};

type MetaAccountsResponse = {
  data?: Array<{
    id: string;
    name: string;
    access_token?: string;
    instagram_business_account?: { id: string; username?: string };
  }>;
};

function parseScopes(scopeHeader: string | null, fallback: string[]): string[] {
  if (!scopeHeader) return fallback;
  return scopeHeader.split(/[,\s]+/).filter(Boolean);
}

function expiresAtFromSeconds(seconds?: number): Date | undefined {
  if (!seconds || seconds <= 0) return undefined;
  return new Date(Date.now() + seconds * 1000);
}

async function metaGraphGet<T>(path: string, accessToken: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${META_GRAPH}${path}`);
  url.searchParams.set("access_token", accessToken);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url.toString(), { method: "GET" });
  const body = (await response.json()) as T & { error?: { message?: string; code?: number } };
  if (!response.ok || body.error) {
    throw new AppError(
      "AUTH_PROVIDER_UNAVAILABLE",
      body.error?.message ?? `Meta Graph API request failed (${response.status}).`,
    );
  }
  return body;
}

async function exchangeMetaCode(input: {
  code: string;
  redirectUri: string;
}): Promise<OAuthTokenResult> {
  const env = getServerEnv();
  if (!env.META_APP_ID || !env.META_APP_SECRET) {
    throw new AppError("AUTH_CONFIGURATION_ERROR", "Meta OAuth is not configured.");
  }

  const shortLivedUrl = new URL(`${META_GRAPH}/oauth/access_token`);
  shortLivedUrl.searchParams.set("client_id", env.META_APP_ID);
  shortLivedUrl.searchParams.set("client_secret", env.META_APP_SECRET);
  shortLivedUrl.searchParams.set("redirect_uri", input.redirectUri);
  shortLivedUrl.searchParams.set("code", input.code);

  const shortResponse = await fetch(shortLivedUrl.toString());
  const shortBody = (await shortResponse.json()) as MetaTokenResponse & {
    error?: { message?: string };
  };
  if (!shortResponse.ok || shortBody.error || !shortBody.access_token) {
    throw new AppError(
      "AUTH_PROVIDER_UNAVAILABLE",
      shortBody.error?.message ?? "Meta authorization code exchange failed.",
    );
  }

  const longLivedUrl = new URL(`${META_GRAPH}/oauth/access_token`);
  longLivedUrl.searchParams.set("grant_type", "fb_exchange_token");
  longLivedUrl.searchParams.set("client_id", env.META_APP_ID);
  longLivedUrl.searchParams.set("client_secret", env.META_APP_SECRET);
  longLivedUrl.searchParams.set("fb_exchange_token", shortBody.access_token);

  const longResponse = await fetch(longLivedUrl.toString());
  const longBody = (await longResponse.json()) as MetaTokenResponse & {
    error?: { message?: string };
  };
  if (!longResponse.ok || longBody.error || !longBody.access_token) {
    throw new AppError(
      "AUTH_PROVIDER_UNAVAILABLE",
      longBody.error?.message ?? "Meta long-lived token exchange failed.",
    );
  }

  const definition = getOAuthProviderDefinition("meta");
  const identity = await metaGraphGet<MetaMeResponse>("/me", longBody.access_token, {
    fields: "id,name,email",
  });

  return {
    accessToken: longBody.access_token,
    refreshToken: longBody.access_token,
    expiresAt: expiresAtFromSeconds(longBody.expires_in ?? 60 * 24 * 60 * 60),
    grantedScopes: definition?.defaultScopes ?? [],
    externalAccountId: identity.id,
    externalLabel: identity.name ?? `Meta user ${identity.id}`,
    tokenType: longBody.token_type ?? "bearer",
  };
}

async function refreshMetaToken(refreshToken: string): Promise<OAuthTokenResult> {
  const env = getServerEnv();
  if (!env.META_APP_ID || !env.META_APP_SECRET) {
    throw new AppError("AUTH_CONFIGURATION_ERROR", "Meta OAuth is not configured.");
  }

  const url = new URL(`${META_GRAPH}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", env.META_APP_ID);
  url.searchParams.set("client_secret", env.META_APP_SECRET);
  url.searchParams.set("fb_exchange_token", refreshToken);

  const response = await fetch(url.toString());
  const body = (await response.json()) as MetaTokenResponse & { error?: { message?: string } };
  if (!response.ok || body.error || !body.access_token) {
    throw new AppError("AUTH_PROVIDER_UNAVAILABLE", body.error?.message ?? "Meta token refresh failed.");
  }

  const identity = await metaGraphGet<MetaMeResponse>("/me", body.access_token, {
    fields: "id,name",
  });

  return {
    accessToken: body.access_token,
    refreshToken: body.access_token,
    expiresAt: expiresAtFromSeconds(body.expires_in ?? 60 * 24 * 60 * 60),
    grantedScopes: getOAuthProviderDefinition("meta")?.defaultScopes ?? [],
    externalAccountId: identity.id,
    externalLabel: identity.name ?? `Meta user ${identity.id}`,
    tokenType: body.token_type ?? "bearer",
  };
}

function createMetaAdapter(providerKey: "meta" | "meta-ads"): ProviderOAuthAdapter {
  return {
    providerKey,

    getConfigStatus(): ProviderOAuthConfigStatus {
      const env = getServerEnv();
      return env.META_APP_ID && env.META_APP_SECRET ? "READY" : "MISCONFIGURED";
    },

    buildAuthorizationUrl(input) {
      const env = getServerEnv();
      if (!env.META_APP_ID) {
        throw new AppError("AUTH_CONFIGURATION_ERROR", "Meta OAuth is not configured (META_APP_ID missing).");
      }

      const definition = getOAuthProviderDefinition(providerKey);
      if (!definition) {
        throw new AppError("VALIDATION_ERROR", `Unknown Meta OAuth provider: ${providerKey}`);
      }

      const params = new URLSearchParams({
        client_id: env.META_APP_ID,
        redirect_uri: input.redirectUri,
        state: input.state,
        scope: input.scopes.join(","),
        response_type: "code",
      });

      if (input.codeChallenge) {
        params.set("code_challenge", input.codeChallenge);
        params.set("code_challenge_method", "S256");
      }

      return `${definition.authorizationUrl}?${params.toString()}`;
    },

    exchangeAuthorizationCode(input) {
      return exchangeMetaCode(input);
    },

    refreshAccessToken(input) {
      return refreshMetaToken(input.refreshToken);
    },

    async revokeToken(input: { accessToken: string }): Promise<void> {
      const deleteUrl = new URL(`${META_GRAPH}/me/permissions`);
      deleteUrl.searchParams.set("access_token", input.accessToken);
      const response = await fetch(deleteUrl.toString(), { method: "DELETE" });
      if (!response.ok) {
        const body = (await response.json()) as { error?: { message?: string } };
        throw new AppError(
          "AUTH_PROVIDER_UNAVAILABLE",
          body.error?.message ?? "Meta token revocation failed.",
        );
      }
    },

    async getIdentity(input) {
      const me = await metaGraphGet<MetaMeResponse>("/me", input.accessToken, {
        fields: "id,name,email",
      });
      return {
        externalAccountId: me.id,
        displayName: me.name ?? `Meta user ${me.id}`,
        email: me.email,
      };
    },

    async discoverAccounts(input) {
      const accounts: DiscoveredAccount[] = [];
      const pages = await metaGraphGet<MetaAccountsResponse>("/me/accounts", input.accessToken, {
        fields: "id,name,access_token,instagram_business_account{id,username}",
      });

      for (const page of pages.data ?? []) {
        accounts.push({
          externalAccountId: page.id,
          accountType: "meta_page",
          displayName: page.name,
          metadata: { pageId: page.id },
        });

        if (page.instagram_business_account?.id) {
          accounts.push({
            externalAccountId: page.instagram_business_account.id,
            accountType: "meta_instagram_business",
            displayName:
              page.instagram_business_account.username ??
              `Instagram ${page.instagram_business_account.id}`,
            metadata: {
              pageId: page.id,
              instagramId: page.instagram_business_account.id,
            },
          });
        }
      }

      if (providerKey === "meta-ads") {
        const businesses = await metaGraphGet<{ data?: Array<{ id: string; name: string }> }>(
          "/me/businesses",
          input.accessToken,
          { fields: "id,name" },
        );
        for (const business of businesses.data ?? []) {
          accounts.push({
            externalAccountId: business.id,
            accountType: "meta_business",
            displayName: business.name,
          });
        }
      }

      return accounts;
    },

    async validateConnection(input) {
      try {
        await metaGraphGet<MetaMeResponse>("/me", input.accessToken, { fields: "id,name" });
        return { healthy: true };
      } catch (error) {
        return {
          healthy: false,
          message: error instanceof Error ? error.message : "Meta connection validation failed.",
        };
      }
    },
  };
}

export const metaOAuthAdapter = createMetaAdapter("meta");
export const metaAdsOAuthAdapter = createMetaAdapter("meta-ads");
