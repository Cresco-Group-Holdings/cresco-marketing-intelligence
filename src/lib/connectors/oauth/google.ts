import { getServerEnv } from "@/lib/environment";
import { GA4_OAUTH_AUTH_URL, GA4_READONLY_SCOPE } from "@/lib/ga4/constants";

export function buildGoogleOAuthAuthorisationUrl(input: {
  state: string;
  redirectUri: string;
  scopes: string[];
  codeChallenge?: string;
}): string {
  const env = getServerEnv();
  if (!env.GOOGLE_CLIENT_ID) {
    throw new Error("GOOGLE_CLIENT_ID is not configured.");
  }

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: input.scopes.join(" "),
    state: input.state,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
  });

  if (input.codeChallenge) {
    params.set("code_challenge", input.codeChallenge);
    params.set("code_challenge_method", "S256");
  }

  return `${GA4_OAUTH_AUTH_URL}?${params.toString()}`;
}

export function ga4RequiredScopes(): string[] {
  return [GA4_READONLY_SCOPE];
}
