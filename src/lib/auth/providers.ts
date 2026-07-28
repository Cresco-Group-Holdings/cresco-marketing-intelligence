export type OAuthProviderId = "google" | "azure";

export type OAuthProviderConfig = {
  id: OAuthProviderId;
  label: string;
  enabled: boolean;
  supabaseProvider: "google" | "azure";
};

export const OAUTH_PROVIDERS: Record<OAuthProviderId, OAuthProviderConfig> = {
  google: {
    id: "google",
    label: "Google",
    enabled: true,
    supabaseProvider: "google",
  },
  azure: {
    id: "azure",
    label: "Microsoft",
    enabled: false,
    supabaseProvider: "azure",
  },
};

export function getEnabledOAuthProviders(): OAuthProviderConfig[] {
  return Object.values(OAUTH_PROVIDERS).filter((provider) => provider.enabled);
}

export function getOAuthProvider(id: string): OAuthProviderConfig | null {
  const provider = OAUTH_PROVIDERS[id as OAuthProviderId];
  if (!provider || !provider.enabled) {
    return null;
  }

  return provider;
}
