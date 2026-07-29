import { getServerEnv } from "@/lib/environment";
import { LinkedInProviderError } from "@/lib/social/linkedin-publishing-adapter";
import type { SocialOAuthTokenPair } from "@/lib/social/types";

export class LinkedInCredentialAdapter {
  constructor(private readonly tokenUrl = "https://www.linkedin.com/oauth/v2/accessToken") {}

  async refreshAccessToken(refreshToken: string): Promise<SocialOAuthTokenPair> {
    const env = getServerEnv();
    if (!env.LINKEDIN_CLIENT_ID || !env.LINKEDIN_CLIENT_SECRET || !refreshToken) {
      throw new LinkedInProviderError(
        "TOKEN_EXPIRED",
        "LinkedIn credentials cannot be refreshed. Reconnect the account.",
        false,
      );
    }
    const response = await fetch(this.tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: env.LINKEDIN_CLIENT_ID,
        client_secret: env.LINKEDIN_CLIENT_SECRET,
      }),
    });
    const data = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    };
    if (!response.ok || !data.access_token) {
      throw new LinkedInProviderError(
        "TOKEN_EXPIRED",
        "LinkedIn rejected the refresh credentials. Reconnect the account.",
        false,
      );
    }
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
      scopes: data.scope?.split(/\s+/) ?? [],
    };
  }
}

export const linkedInCredentialAdapter = new LinkedInCredentialAdapter();
