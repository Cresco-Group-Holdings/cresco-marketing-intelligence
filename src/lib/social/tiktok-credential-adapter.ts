import { getServerEnv } from "@/lib/environment";
import { TikTokProviderError } from "@/lib/social/tiktok-publishing-adapter";
import type { SocialOAuthTokenPair } from "@/lib/social/types";

/** TikTok uses a standard OAuth refresh grant against the open API token endpoint. */
export class TikTokCredentialAdapter {
  constructor(private readonly tokenUrl = "https://open.tiktokapis.com/v2/oauth/token/") {}

  async refreshAccessToken(input: { refreshToken: string }): Promise<SocialOAuthTokenPair> {
    const env = getServerEnv();
    if (!env.TIKTOK_CLIENT_KEY || !env.TIKTOK_CLIENT_SECRET) {
      throw new TikTokProviderError(
        "PROVIDER_ERROR",
        "TikTok application credentials are not configured, so tokens cannot be refreshed.",
        false,
      );
    }
    if (!input.refreshToken) {
      throw new TikTokProviderError(
        "TOKEN_EXPIRED",
        "No TikTok refresh token is stored for this connection.",
        false,
      );
    }

    const response = await fetch(this.tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: env.TIKTOK_CLIENT_KEY,
        client_secret: env.TIKTOK_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: input.refreshToken,
      }),
    });

    const data = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
      error?: string;
      error_description?: string;
    };

    if (!response.ok || !data.access_token) {
      throw new TikTokProviderError(
        "TOKEN_EXPIRED",
        data.error_description ??
          "TikTok credentials could not be refreshed. Reconnect the account.",
        false,
      );
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? input.refreshToken,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
      scopes: data.scope ? data.scope.split(/[,\s]+/).filter(Boolean) : ["video.publish"],
    };
  }
}

export const tikTokCredentialAdapter = new TikTokCredentialAdapter();
