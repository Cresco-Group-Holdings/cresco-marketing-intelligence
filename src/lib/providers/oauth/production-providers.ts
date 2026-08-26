/** Providers with real OAuth adapter implementations (not mock-only). */
export const PRODUCTION_OAUTH_PROVIDER_KEYS = [
  "google-analytics",
  "google-search-console",
  "meta",
  "meta-ads",
  "linkedin",
  "youtube",
  "x",
] as const;

export type ProductionOAuthProviderKey = (typeof PRODUCTION_OAUTH_PROVIDER_KEYS)[number];

export function isProductionOAuthProvider(providerKey: string): boolean {
  return (PRODUCTION_OAUTH_PROVIDER_KEYS as readonly string[]).includes(providerKey);
}
