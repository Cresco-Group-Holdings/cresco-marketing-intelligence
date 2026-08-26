import { getProviderOAuthConfigDetail } from "@/lib/providers/oauth/provider-config";
import {
  isProductionOAuthProvider,
  type ProductionOAuthProviderKey,
} from "@/lib/providers/oauth/production-providers";
import type { ProviderProductAvailability } from "@/lib/providers/connection-health";

/** Maps unified / social provider keys to the OAuth provider used for connection. */
export function resolveOAuthProviderKey(providerKey: string): string {
  if (providerKey === "facebook" || providerKey === "instagram") {
    return "meta";
  }
  return providerKey;
}

export function resolveProviderProductAvailability(providerKey: string): ProviderProductAvailability {
  const oauthKey = resolveOAuthProviderKey(providerKey);

  if (isProductionOAuthProvider(oauthKey)) {
    const config = getProviderOAuthConfigDetail(oauthKey);
    if (config.status === "READY") {
      return oauthKey === "x" || oauthKey === "tiktok" ? "beta" : "available";
    }
    return "not_configured";
  }

  return "unavailable";
}

export function isProviderConnectableInProduction(providerKey: string): boolean {
  const availability = resolveProviderProductAvailability(providerKey);
  return availability === "available" || availability === "beta";
}

export function isProductionOAuthReady(providerKey: string): boolean {
  const oauthKey = resolveOAuthProviderKey(providerKey);
  if (!isProductionOAuthProvider(oauthKey)) return false;
  return getProviderOAuthConfigDetail(oauthKey).status === "READY";
}

export function listLaunchCriticalProviderKeys(): ProductionOAuthProviderKey[] {
  return [
    "google-analytics",
    "meta",
    "linkedin",
    "youtube",
    "x",
  ] as ProductionOAuthProviderKey[];
}
