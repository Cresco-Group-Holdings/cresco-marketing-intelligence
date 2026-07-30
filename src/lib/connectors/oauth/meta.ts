import { getServerEnv } from "@/lib/environment";

export const META_OAUTH_AUTH_URL = "https://www.facebook.com/v19.0/dialog/oauth";
export const META_OAUTH_TOKEN_URL = "https://graph.facebook.com/v19.0/oauth/access_token";
export const META_GRAPH_API_BASE = "https://graph.facebook.com/v19.0";

export function buildMetaOAuthAuthorisationUrl(input: {
  state: string;
  redirectUri: string;
  scopes: string[];
}): string {
  const env = getServerEnv();
  if (!env.META_APP_ID) throw new Error("META_APP_ID is not configured.");
  const params = new URLSearchParams({
    client_id: env.META_APP_ID,
    redirect_uri: input.redirectUri,
    state: input.state,
    scope: input.scopes.join(","),
    response_type: "code",
  });
  return `${META_OAUTH_AUTH_URL}?${params.toString()}`;
}
