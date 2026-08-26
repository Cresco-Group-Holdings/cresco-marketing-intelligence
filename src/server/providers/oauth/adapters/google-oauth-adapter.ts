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

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO = "https://www.googleapis.com/oauth2/v3/userinfo";

type GoogleProviderKey = "google-analytics" | "google-search-console" | "youtube";

type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
};

function googleConfigStatus(): ProviderOAuthConfigStatus {
  const env = getServerEnv();
  return env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET ? "READY" : "MISCONFIGURED";
}

function parseScopes(scopeHeader: string | undefined, fallback: string[]): string[] {
  if (!scopeHeader) return fallback;
  return scopeHeader.split(/\s+/).filter(Boolean);
}

function expiresAtFromSeconds(seconds?: number): Date | undefined {
  if (!seconds || seconds <= 0) return undefined;
  return new Date(Date.now() + seconds * 1000);
}

async function exchangeGoogleCode(input: {
  providerKey: GoogleProviderKey;
  code: string;
  redirectUri: string;
  codeVerifier?: string;
}): Promise<OAuthTokenResult> {
  const env = getServerEnv();
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new AppError("AUTH_CONFIGURATION_ERROR", "Google OAuth is not configured.");
  }

  const definition = getOAuthProviderDefinition(input.providerKey);
  const body = new URLSearchParams({
    code: input.code,
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    redirect_uri: input.redirectUri,
    grant_type: "authorization_code",
  });
  if (input.codeVerifier) {
    body.set("code_verifier", input.codeVerifier);
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const tokenBody = (await response.json()) as GoogleTokenResponse & {
    error?: string;
    error_description?: string;
  };
  if (!response.ok || !tokenBody.access_token) {
    throw new AppError(
      "AUTH_PROVIDER_UNAVAILABLE",
      tokenBody.error_description ?? tokenBody.error ?? "Google token exchange failed.",
    );
  }

  const userResponse = await fetch(GOOGLE_USERINFO, {
    headers: { Authorization: `Bearer ${tokenBody.access_token}` },
  });
  const user = (await userResponse.json()) as { sub?: string; name?: string; email?: string };

  return {
    accessToken: tokenBody.access_token,
    refreshToken: tokenBody.refresh_token,
    expiresAt: expiresAtFromSeconds(tokenBody.expires_in),
    grantedScopes: parseScopes(tokenBody.scope, definition?.defaultScopes ?? []),
    externalAccountId: user.sub,
    externalLabel: user.name ?? user.email ?? `Google user ${user.sub}`,
    tokenType: tokenBody.token_type ?? "bearer",
  };
}

async function refreshGoogleToken(refreshToken: string, providerKey: GoogleProviderKey): Promise<OAuthTokenResult> {
  const env = getServerEnv();
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new AppError("AUTH_CONFIGURATION_ERROR", "Google OAuth is not configured.");
  }

  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    grant_type: "refresh_token",
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const tokenBody = (await response.json()) as GoogleTokenResponse & {
    error?: string;
    error_description?: string;
  };
  if (!response.ok || !tokenBody.access_token) {
    throw new AppError(
      "AUTH_PROVIDER_UNAVAILABLE",
      tokenBody.error_description ?? tokenBody.error ?? "Google token refresh failed.",
    );
  }

  const definition = getOAuthProviderDefinition(providerKey);
  return {
    accessToken: tokenBody.access_token,
    refreshToken: refreshToken,
    expiresAt: expiresAtFromSeconds(tokenBody.expires_in),
    grantedScopes: parseScopes(tokenBody.scope, definition?.defaultScopes ?? []),
    externalAccountId: undefined,
    externalLabel: undefined,
    tokenType: tokenBody.token_type ?? "bearer",
  };
}

async function discoverGoogleAccounts(
  providerKey: GoogleProviderKey,
  accessToken: string,
): Promise<DiscoveredAccount[]> {
  if (providerKey === "youtube") {
    const response = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const body = (await response.json()) as {
      items?: Array<{ id: string; snippet?: { title?: string } }>;
    };
    return (body.items ?? []).map((channel) => ({
      externalAccountId: channel.id,
      accountType: "youtube_channel",
      displayName: channel.snippet?.title ?? `Channel ${channel.id}`,
    }));
  }

  if (providerKey === "google-analytics") {
    const response = await fetch(
      "https://analyticsadmin.googleapis.com/v1beta/accountSummaries",
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const body = (await response.json()) as {
      accountSummaries?: Array<{
        account?: string;
        displayName?: string;
        propertySummaries?: Array<{ property?: string; displayName?: string }>;
      }>;
    };
    const accounts: DiscoveredAccount[] = [];
    for (const summary of body.accountSummaries ?? []) {
      for (const property of summary.propertySummaries ?? []) {
        if (!property.property) continue;
        accounts.push({
          externalAccountId: property.property,
          accountType: "ga4_property",
          displayName: property.displayName ?? property.property,
          metadata: { account: summary.account },
        });
      }
    }
    return accounts;
  }

  const response = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = (await response.json()) as { siteEntry?: Array<{ siteUrl?: string }> };
  return (body.siteEntry ?? [])
    .filter((site) => site.siteUrl)
    .map((site) => ({
      externalAccountId: site.siteUrl!,
      accountType: "gsc_site",
      displayName: site.siteUrl!,
    }));
}

export function createGoogleOAuthAdapter(providerKey: GoogleProviderKey): ProviderOAuthAdapter {
  return {
    providerKey,

    getConfigStatus(): ProviderOAuthConfigStatus {
      return googleConfigStatus();
    },

    buildAuthorizationUrl(input) {
      const env = getServerEnv();
      if (!env.GOOGLE_CLIENT_ID) {
        throw new AppError("AUTH_CONFIGURATION_ERROR", "Google OAuth is not configured.");
      }
      const definition = getOAuthProviderDefinition(providerKey);
      if (!definition) {
        throw new AppError("VALIDATION_ERROR", `Unknown Google OAuth provider: ${providerKey}`);
      }

      const params = new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        redirect_uri: input.redirectUri,
        response_type: "code",
        scope: input.scopes.join(" "),
        state: input.state,
        access_type: "offline",
        prompt: "consent",
      });
      if (input.codeChallenge) {
        params.set("code_challenge", input.codeChallenge);
        params.set("code_challenge_method", "S256");
      }
      return `${definition.authorizationUrl}?${params.toString()}`;
    },

    exchangeAuthorizationCode(input) {
      return exchangeGoogleCode({ ...input, providerKey });
    },

    refreshAccessToken(input) {
      return refreshGoogleToken(input.refreshToken, providerKey);
    },

    async revokeToken(input) {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(input.accessToken)}`, {
        method: "POST",
      });
    },

    async getIdentity(input) {
      const response = await fetch(GOOGLE_USERINFO, {
        headers: { Authorization: `Bearer ${input.accessToken}` },
      });
      const user = (await response.json()) as { sub: string; name?: string; email?: string };
      return {
        externalAccountId: user.sub,
        displayName: user.name ?? user.email ?? `Google user ${user.sub}`,
        email: user.email,
      } satisfies ProviderIdentity;
    },

    async discoverAccounts(input) {
      return discoverGoogleAccounts(providerKey, input.accessToken);
    },

    async validateConnection(input) {
      try {
        await this.getIdentity({ accessToken: input.accessToken });
        return { healthy: true };
      } catch (error) {
        return {
          healthy: false,
          message: error instanceof Error ? error.message : "Google connection validation failed.",
        };
      }
    },
  };
}

export const googleAnalyticsOAuthAdapter = createGoogleOAuthAdapter("google-analytics");
export const googleSearchConsoleOAuthAdapter = createGoogleOAuthAdapter("google-search-console");
export const youtubeOAuthAdapter = createGoogleOAuthAdapter("youtube");
