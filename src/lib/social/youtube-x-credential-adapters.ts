import { getServerEnv } from "@/lib/environment";
import type { SocialOAuthTokenPair } from "@/lib/social/types";

async function refresh(
  tokenUrl: string,
  values: Record<string, string>,
  fallbackScope: string[],
): Promise<SocialOAuthTokenPair> {
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(values),
  });
  const data = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
  if (!response.ok || !data.access_token)
    throw new Error("Provider rejected the refresh credentials.");
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? values.refresh_token,
    expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
    scopes: data.scope?.split(/\s+/) ?? fallbackScope,
  };
}

export const youtubeCredentialAdapter = {
  async refreshAccessToken(refreshToken: string) {
    const env = getServerEnv();
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !refreshToken) {
      throw new Error("YouTube credentials cannot be refreshed. Reconnect the channel.");
    }
    return refresh(
      "https://oauth2.googleapis.com/token",
      {
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      },
      ["https://www.googleapis.com/auth/youtube.upload"],
    );
  },
};

export const xCredentialAdapter = {
  async refreshAccessToken(refreshToken: string) {
    const env = getServerEnv();
    if (!env.X_CLIENT_ID || !env.X_CLIENT_SECRET || !refreshToken) {
      throw new Error("X credentials cannot be refreshed. Reconnect the account.");
    }
    return refresh(
      "https://api.x.com/2/oauth2/token",
      {
        client_id: env.X_CLIENT_ID,
        client_secret: env.X_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      },
      ["tweet.write", "media.write", "offline.access"],
    );
  },
};
