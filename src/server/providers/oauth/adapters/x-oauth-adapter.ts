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

const X_TOKEN_URL = "https://api.twitter.com/2/oauth2/token";
const X_API = "https://api.twitter.com/2";

type XTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
};

function xConfigStatus(): ProviderOAuthConfigStatus {
  const env = getServerEnv();
  return env.X_CLIENT_ID && env.X_CLIENT_SECRET ? "READY" : "MISCONFIGURED";
}

function expiresAtFromSeconds(seconds?: number): Date | undefined {
  if (!seconds || seconds <= 0) return undefined;
  return new Date(Date.now() + seconds * 1000);
}

async function exchangeXCode(input: {
  code: string;
  redirectUri: string;
  codeVerifier?: string;
}): Promise<OAuthTokenResult> {
  const env = getServerEnv();
  if (!env.X_CLIENT_ID || !env.X_CLIENT_SECRET) {
    throw new AppError("AUTH_CONFIGURATION_ERROR", "X OAuth is not configured.");
  }

  const credentials = Buffer.from(`${env.X_CLIENT_ID}:${env.X_CLIENT_SECRET}`).toString("base64");
  const body = new URLSearchParams({
    code: input.code,
    grant_type: "authorization_code",
    redirect_uri: input.redirectUri,
    client_id: env.X_CLIENT_ID,
  });
  if (input.codeVerifier) {
    body.set("code_verifier", input.codeVerifier);
  }

  const definition = getOAuthProviderDefinition("x");
  const response = await fetch(X_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body,
  });
  const tokenBody = (await response.json()) as XTokenResponse & {
    error?: string;
    error_description?: string;
  };
  if (!response.ok || !tokenBody.access_token) {
    throw new AppError(
      "AUTH_PROVIDER_UNAVAILABLE",
      tokenBody.error_description ?? tokenBody.error ?? "X token exchange failed.",
    );
  }

  const meResponse = await fetch(`${X_API}/users/me`, {
    headers: { Authorization: `Bearer ${tokenBody.access_token}` },
  });
  const me = (await meResponse.json()) as { data?: { id: string; username?: string; name?: string } };

  return {
    accessToken: tokenBody.access_token,
    refreshToken: tokenBody.refresh_token,
    expiresAt: expiresAtFromSeconds(tokenBody.expires_in),
    grantedScopes: tokenBody.scope?.split(/\s+/).filter(Boolean) ?? definition?.defaultScopes ?? [],
    externalAccountId: me.data?.id,
    externalLabel: me.data?.name ?? (me.data?.username ? `@${me.data.username}` : undefined),
    tokenType: tokenBody.token_type ?? "bearer",
  };
}

async function refreshXToken(refreshToken: string): Promise<OAuthTokenResult> {
  const env = getServerEnv();
  if (!env.X_CLIENT_ID || !env.X_CLIENT_SECRET) {
    throw new AppError("AUTH_CONFIGURATION_ERROR", "X OAuth is not configured.");
  }

  const credentials = Buffer.from(`${env.X_CLIENT_ID}:${env.X_CLIENT_SECRET}`).toString("base64");
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    client_id: env.X_CLIENT_ID,
  });

  const response = await fetch(X_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body,
  });
  const tokenBody = (await response.json()) as XTokenResponse & {
    error?: string;
    error_description?: string;
  };
  if (!response.ok || !tokenBody.access_token) {
    throw new AppError(
      "AUTH_PROVIDER_UNAVAILABLE",
      tokenBody.error_description ?? tokenBody.error ?? "X token refresh failed.",
    );
  }

  const definition = getOAuthProviderDefinition("x");
  return {
    accessToken: tokenBody.access_token,
    refreshToken: tokenBody.refresh_token ?? refreshToken,
    expiresAt: expiresAtFromSeconds(tokenBody.expires_in),
    grantedScopes: tokenBody.scope?.split(/\s+/).filter(Boolean) ?? definition?.defaultScopes ?? [],
    tokenType: tokenBody.token_type ?? "bearer",
  };
}

export const xOAuthAdapter: ProviderOAuthAdapter = {
  providerKey: "x",

  getConfigStatus(): ProviderOAuthConfigStatus {
    return xConfigStatus();
  },

  buildAuthorizationUrl(input) {
    const env = getServerEnv();
    if (!env.X_CLIENT_ID) {
      throw new AppError("AUTH_CONFIGURATION_ERROR", "X OAuth is not configured.");
    }
    const definition = getOAuthProviderDefinition("x");
    if (!definition) {
      throw new AppError("VALIDATION_ERROR", "X OAuth definition missing.");
    }

    const params = new URLSearchParams({
      response_type: "code",
      client_id: env.X_CLIENT_ID,
      redirect_uri: input.redirectUri,
      scope: input.scopes.join(" "),
      state: input.state,
      code_challenge: input.codeChallenge ?? "",
      code_challenge_method: "S256",
    });
    return `${definition.authorizationUrl}?${params.toString()}`;
  },

  exchangeAuthorizationCode(input) {
    return exchangeXCode(input);
  },

  refreshAccessToken(input) {
    return refreshXToken(input.refreshToken);
  },

  async revokeToken() {
    return;
  },

  async getIdentity(input) {
    const response = await fetch(`${X_API}/users/me`, {
      headers: { Authorization: `Bearer ${input.accessToken}` },
    });
    const me = (await response.json()) as { data: { id: string; username?: string; name?: string } };
    return {
      externalAccountId: me.data.id,
      displayName: me.data.name ?? `@${me.data.username}`,
    } satisfies ProviderIdentity;
  },

  async discoverAccounts(input) {
    const identity = await this.getIdentity({ accessToken: input.accessToken });
    return [
      {
        externalAccountId: identity.externalAccountId,
        accountType: "x_account",
        displayName: identity.displayName,
      },
    ] satisfies DiscoveredAccount[];
  },

  async validateConnection(input) {
    try {
      await this.getIdentity({ accessToken: input.accessToken });
      return { healthy: true };
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : "X validation failed.",
      };
    }
  },
};
