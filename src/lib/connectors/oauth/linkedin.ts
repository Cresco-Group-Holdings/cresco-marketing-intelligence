import { getServerEnv } from "@/lib/environment";

export const LINKEDIN_OAUTH_AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
export const LINKEDIN_OAUTH_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
export const LINKEDIN_API_BASE = "https://api.linkedin.com/rest";

export function buildLinkedInOAuthAuthorisationUrl(input: {
  state: string;
  redirectUri: string;
  scopes: string[];
}): string {
  const env = getServerEnv();
  if (!env.LINKEDIN_CLIENT_ID) throw new Error("LINKEDIN_CLIENT_ID is not configured.");
  const params = new URLSearchParams({
    response_type: "code",
    client_id: env.LINKEDIN_CLIENT_ID,
    redirect_uri: input.redirectUri,
    state: input.state,
    scope: input.scopes.join(" "),
  });
  return `${LINKEDIN_OAUTH_AUTH_URL}?${params.toString()}`;
}
