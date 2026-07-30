import { getServerEnv } from "@/lib/environment";

export const TIKTOK_OAUTH_AUTH_URL = "https://business-api.tiktok.com/portal/auth";
export const TIKTOK_OAUTH_TOKEN_URL = "https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/";
export const TIKTOK_API_BASE = "https://business-api.tiktok.com/open_api/v1.3";

export function buildTikTokOAuthAuthorisationUrl(input: {
  state: string;
  redirectUri: string;
  scopes: string[];
}): string {
  const env = getServerEnv();
  if (!env.TIKTOK_CLIENT_KEY) throw new Error("TIKTOK_CLIENT_KEY is not configured.");
  const params = new URLSearchParams({
    app_id: env.TIKTOK_CLIENT_KEY,
    redirect_uri: input.redirectUri,
    state: input.state,
  });
  return `${TIKTOK_OAUTH_AUTH_URL}?${params.toString()}`;
}
