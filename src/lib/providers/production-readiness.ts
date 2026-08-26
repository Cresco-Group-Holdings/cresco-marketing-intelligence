import { getProviderOAuthConfigDetail } from "@/lib/providers/oauth/provider-config";
import {
  PRODUCTION_OAUTH_PROVIDER_KEYS,
  type ProductionOAuthProviderKey,
} from "@/lib/providers/oauth/production-providers";
import { getOAuthProviderDefinition } from "@/lib/integrations/oauth/provider-definitions";

export type ProviderReadinessRow = {
  providerKey: string;
  displayName: string;
  tier: "launch_critical" | "tier_2" | "post_launch";
  productionStatus: "ready" | "beta" | "not_configured" | "unavailable";
  adapterRegistered: boolean;
  envConfigured: boolean;
  oauthFlowAvailable: boolean;
  accountDiscoveryImplemented: boolean;
  analyticsImplemented: boolean;
  publishingImplemented: boolean;
  tokenRefreshImplemented: boolean;
  syncJobImplemented: boolean;
  testsPresent: boolean;
};

const TIER_1_KEYS = [
  "google-analytics",
  "meta",
  "linkedin",
  "youtube",
  "x",
] as const;

const TIER_2_KEYS = ["tiktok", "google-search-console"] as const;

export const CAPABILITY_MATRIX: Record<
  string,
  Pick<
    ProviderReadinessRow,
    | "analyticsImplemented"
    | "publishingImplemented"
    | "accountDiscoveryImplemented"
    | "tokenRefreshImplemented"
    | "syncJobImplemented"
    | "tier"
  >
> = {
  "google-analytics": {
    tier: "launch_critical",
    accountDiscoveryImplemented: true,
    analyticsImplemented: true,
    publishingImplemented: false,
    tokenRefreshImplemented: true,
    syncJobImplemented: true,
  },
  meta: {
    tier: "launch_critical",
    accountDiscoveryImplemented: true,
    analyticsImplemented: true,
    publishingImplemented: true,
    tokenRefreshImplemented: true,
    syncJobImplemented: true,
  },
  linkedin: {
    tier: "launch_critical",
    accountDiscoveryImplemented: true,
    analyticsImplemented: true,
    publishingImplemented: true,
    tokenRefreshImplemented: true,
    syncJobImplemented: true,
  },
  youtube: {
    tier: "launch_critical",
    accountDiscoveryImplemented: true,
    analyticsImplemented: true,
    publishingImplemented: true,
    tokenRefreshImplemented: true,
    syncJobImplemented: true,
  },
  x: {
    tier: "launch_critical",
    accountDiscoveryImplemented: true,
    analyticsImplemented: true,
    publishingImplemented: true,
    tokenRefreshImplemented: true,
    syncJobImplemented: true,
  },
  tiktok: {
    tier: "tier_2",
    accountDiscoveryImplemented: true,
    analyticsImplemented: true,
    publishingImplemented: true,
    tokenRefreshImplemented: true,
    syncJobImplemented: true,
  },
  "google-search-console": {
    tier: "tier_2",
    accountDiscoveryImplemented: true,
    analyticsImplemented: true,
    publishingImplemented: false,
    tokenRefreshImplemented: true,
    syncJobImplemented: true,
  },
  "meta-ads": {
    tier: "launch_critical",
    accountDiscoveryImplemented: true,
    analyticsImplemented: true,
    publishingImplemented: false,
    tokenRefreshImplemented: true,
    syncJobImplemented: true,
  },
};

export function buildProviderReadinessMatrix(): ProviderReadinessRow[] {
  return PRODUCTION_OAUTH_PROVIDER_KEYS.map((providerKey) => {
    const definition = getOAuthProviderDefinition(providerKey);
    const config = getProviderOAuthConfigDetail(providerKey);
    const matrix = CAPABILITY_MATRIX[providerKey] ?? {
      tier: "post_launch" as const,
      accountDiscoveryImplemented: false,
      analyticsImplemented: false,
      publishingImplemented: false,
      tokenRefreshImplemented: false,
      syncJobImplemented: false,
    };

    const envConfigured = config.status === "READY";
    const productionStatus = envConfigured
      ? providerKey === "x"
        ? "beta"
        : "ready"
      : "not_configured";

    return {
      providerKey,
      displayName: definition?.displayName ?? providerKey,
      productionStatus,
      adapterRegistered: true,
      envConfigured,
      oauthFlowAvailable: Boolean(definition),
      testsPresent: true,
      ...matrix,
    };
  });
}

export function getLaunchMinimumSet(): ProductionOAuthProviderKey[] {
  const ready = buildProviderReadinessMatrix().filter((row) => row.productionStatus === "ready");
  const keys = ready.map((row) => row.providerKey as ProductionOAuthProviderKey);
  const hasGa4 = keys.includes("google-analytics");
  const hasMeta = keys.includes("meta");
  const hasLinkedIn = keys.includes("linkedin");
  const hasSecondary = keys.includes("youtube") || keys.includes("x");
  if (hasGa4 && hasMeta && hasLinkedIn && hasSecondary) {
    return keys.filter((k) =>
      ["google-analytics", "meta", "linkedin", "youtube", "x"].includes(k),
    ) as ProductionOAuthProviderKey[];
  }
  return keys;
}

export function isTier1Provider(providerKey: string): boolean {
  return (TIER_1_KEYS as readonly string[]).includes(providerKey);
}

export function isTier2Provider(providerKey: string): boolean {
  return (TIER_2_KEYS as readonly string[]).includes(providerKey);
}
