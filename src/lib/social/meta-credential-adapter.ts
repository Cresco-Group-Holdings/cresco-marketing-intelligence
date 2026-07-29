import { getServerEnv } from "@/lib/environment";
import { InstagramProviderError } from "@/lib/social/instagram-publishing-adapter";
import type { SocialOAuthTokenPair } from "@/lib/social/types";

/**
 * Meta long-lived user tokens are extended with `fb_exchange_token` rather than a
 * standard OAuth refresh grant, so the stored access token is exchanged for a new one.
 */
export class MetaCredentialAdapter {
  constructor(private readonly graphBaseUrl = "https://graph.facebook.com/v22.0") {}

  async refreshAccessToken(input: { accessToken: string }): Promise<SocialOAuthTokenPair> {
    const env = getServerEnv();
    if (!env.META_APP_ID || !env.META_APP_SECRET) {
      throw new InstagramProviderError(
        "PROVIDER_ERROR",
        "Meta application credentials are not configured, so Instagram tokens cannot be refreshed.",
        false,
      );
    }
    if (!input.accessToken) {
      throw new InstagramProviderError(
        "TOKEN_EXPIRED",
        "No Instagram token is available to refresh.",
        false,
      );
    }

    const url = new URL(`${this.graphBaseUrl}/oauth/access_token`);
    url.searchParams.set("grant_type", "fb_exchange_token");
    url.searchParams.set("client_id", env.META_APP_ID);
    url.searchParams.set("client_secret", env.META_APP_SECRET);
    url.searchParams.set("fb_exchange_token", input.accessToken);

    const response = await fetch(url.toString());
    const data = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
      error?: { message?: string };
    };

    if (!response.ok || !data.access_token) {
      throw new InstagramProviderError(
        "TOKEN_EXPIRED",
        data.error?.message ??
          "Instagram credentials could not be refreshed. Reconnect the account.",
        false,
      );
    }

    return {
      accessToken: data.access_token,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
      scopes: ["instagram_basic", "instagram_content_publish"],
    };
  }
}

export const metaCredentialAdapter = new MetaCredentialAdapter();
