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

const LINKEDIN_API = "https://api.linkedin.com/v2";

type LinkedInTokenResponse = {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
};

function linkedInConfigStatus(): ProviderOAuthConfigStatus {
  const env = getServerEnv();
  return env.LINKEDIN_CLIENT_ID && env.LINKEDIN_CLIENT_SECRET ? "READY" : "MISCONFIGURED";
}

function expiresAtFromSeconds(seconds?: number): Date | undefined {
  if (!seconds || seconds <= 0) return undefined;
  return new Date(Date.now() + seconds * 1000);
}

async function exchangeLinkedInCode(input: {
  code: string;
  redirectUri: string;
}): Promise<OAuthTokenResult> {
  const env = getServerEnv();
  if (!env.LINKEDIN_CLIENT_ID || !env.LINKEDIN_CLIENT_SECRET) {
    throw new AppError("AUTH_CONFIGURATION_ERROR", "LinkedIn OAuth is not configured.");
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.redirectUri,
    client_id: env.LINKEDIN_CLIENT_ID,
    client_secret: env.LINKEDIN_CLIENT_SECRET,
  });

  const definition = getOAuthProviderDefinition("linkedin");
  const response = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const tokenBody = (await response.json()) as LinkedInTokenResponse & {
    error?: string;
    error_description?: string;
  };
  if (!response.ok || !tokenBody.access_token) {
    throw new AppError(
      "AUTH_PROVIDER_UNAVAILABLE",
      tokenBody.error_description ?? tokenBody.error ?? "LinkedIn token exchange failed.",
    );
  }

  const meResponse = await fetch(`${LINKEDIN_API}/me`, {
    headers: { Authorization: `Bearer ${tokenBody.access_token}` },
  });
  const me = (await meResponse.json()) as { id?: string; localizedFirstName?: string; localizedLastName?: string };

  return {
    accessToken: tokenBody.access_token,
    refreshToken: tokenBody.refresh_token,
    expiresAt: expiresAtFromSeconds(tokenBody.expires_in),
    grantedScopes: tokenBody.scope?.split(/\s+/).filter(Boolean) ?? definition?.defaultScopes ?? [],
    externalAccountId: me.id,
    externalLabel: [me.localizedFirstName, me.localizedLastName].filter(Boolean).join(" ") || `LinkedIn ${me.id}`,
    tokenType: "bearer",
  };
}

async function discoverLinkedInOrganizations(accessToken: string): Promise<DiscoveredAccount[]> {
  const response = await fetch(
    `${LINKEDIN_API}/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const body = (await response.json()) as {
    elements?: Array<{ organization?: string; role?: string }>;
  };

  const accounts: DiscoveredAccount[] = [];
  for (const element of body.elements ?? []) {
    const orgUrn = element.organization;
    if (!orgUrn) continue;
    const orgId = orgUrn.split(":").pop() ?? orgUrn;
    const orgResponse = await fetch(`${LINKEDIN_API}/organizations/${orgId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const org = (await orgResponse.json()) as { localizedName?: string };
    accounts.push({
      externalAccountId: orgUrn,
      accountType: "linkedin_organization",
      displayName: org.localizedName ?? `Organization ${orgId}`,
    });
  }
  return accounts;
}

export const linkedinOAuthAdapter: ProviderOAuthAdapter = {
  providerKey: "linkedin",

  getConfigStatus(): ProviderOAuthConfigStatus {
    return linkedInConfigStatus();
  },

  buildAuthorizationUrl(input) {
    const env = getServerEnv();
    if (!env.LINKEDIN_CLIENT_ID) {
      throw new AppError("AUTH_CONFIGURATION_ERROR", "LinkedIn OAuth is not configured.");
    }
    const definition = getOAuthProviderDefinition("linkedin");
    if (!definition) {
      throw new AppError("VALIDATION_ERROR", "LinkedIn OAuth definition missing.");
    }

    const params = new URLSearchParams({
      response_type: "code",
      client_id: env.LINKEDIN_CLIENT_ID,
      redirect_uri: input.redirectUri,
      state: input.state,
      scope: input.scopes.join(" "),
    });
    return `${definition.authorizationUrl}?${params.toString()}`;
  },

  exchangeAuthorizationCode(input) {
    return exchangeLinkedInCode(input);
  },

  async refreshAccessToken(input) {
    const env = getServerEnv();
    if (!env.LINKEDIN_CLIENT_ID || !env.LINKEDIN_CLIENT_SECRET) {
      throw new AppError("AUTH_CONFIGURATION_ERROR", "LinkedIn OAuth is not configured.");
    }

    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: input.refreshToken,
      client_id: env.LINKEDIN_CLIENT_ID,
      client_secret: env.LINKEDIN_CLIENT_SECRET,
    });

    const definition = getOAuthProviderDefinition("linkedin");
    const response = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const tokenBody = (await response.json()) as LinkedInTokenResponse & {
      error?: string;
      error_description?: string;
    };
    if (!response.ok || !tokenBody.access_token) {
      throw new AppError(
        "AUTH_PROVIDER_UNAVAILABLE",
        tokenBody.error_description ?? tokenBody.error ?? "LinkedIn token refresh failed.",
      );
    }

    return {
      accessToken: tokenBody.access_token,
      refreshToken: tokenBody.refresh_token ?? input.refreshToken,
      expiresAt: expiresAtFromSeconds(tokenBody.expires_in),
      grantedScopes: tokenBody.scope?.split(/\s+/).filter(Boolean) ?? definition?.defaultScopes ?? [],
      tokenType: "bearer",
    };
  },

  async revokeToken() {
    return;
  },

  async getIdentity(input) {
    const response = await fetch(`${LINKEDIN_API}/me`, {
      headers: { Authorization: `Bearer ${input.accessToken}` },
    });
    const me = (await response.json()) as { id: string; localizedFirstName?: string; localizedLastName?: string };
    return {
      externalAccountId: me.id,
      displayName: [me.localizedFirstName, me.localizedLastName].filter(Boolean).join(" ") || me.id,
    } satisfies ProviderIdentity;
  },

  async discoverAccounts(input) {
    return discoverLinkedInOrganizations(input.accessToken);
  },

  async validateConnection(input) {
    try {
      await this.getIdentity({ accessToken: input.accessToken });
      return { healthy: true };
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : "LinkedIn validation failed.",
      };
    }
  },
};
