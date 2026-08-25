import type { OrganicProviderDefinition } from "@/lib/organic-growth/types";
import {
  getServerOrganicSocialCatalogue,
  getStaticOrganicSocialProviderKeys,
  type CanonicalOrganicProvider,
  type OrganicProductAvailability,
} from "@/lib/providers/organic-social-catalogue";

function mapProductToUiAvailability(
  productAvailability: OrganicProductAvailability,
  connected: boolean,
  status?: string,
  lastSyncAt?: Date | null,
): OrganicProviderDefinition["availability"] {
  if (productAvailability === "coming_soon") return "coming_soon";
  if (productAvailability === "planned") return "planned";
  if (productAvailability === "unavailable" || productAvailability === "not_configured") {
    return connected ? "error" : "not_connected";
  }
  if (!connected) return "not_connected";
  if (status === "RECONNECT_REQUIRED") return "reauth_required";
  if (status === "ERROR") return "error";
  if (status === "SYNCING") return "syncing";
  if (lastSyncAt) {
    const ageHours = (Date.now() - lastSyncAt.getTime()) / (1000 * 60 * 60);
    if (ageHours > 24) return "stale";
  }
  return "connected";
}

function canonicalToDefinition(
  canonical: CanonicalOrganicProvider,
  connected: boolean,
  status?: string,
  lastSyncAt?: Date | null,
): OrganicProviderDefinition {
  const connectable =
    canonical.productAvailability === "available" || canonical.productAvailability === "beta";

  return {
    provider: canonical.provider as OrganicProviderDefinition["provider"],
    label: canonical.label,
    tier: canonical.tier,
    availability: mapProductToUiAvailability(
      canonical.productAvailability,
      connected,
      status,
      lastSyncAt,
    ),
    accountRead: connectable && canonical.capabilities.accountRead,
    analytics: connected && canonical.capabilities.analytics,
    publish: connected && canonical.capabilities.publish,
    schedule: connected && canonical.capabilities.schedule,
    connectHref: canonical.connectHref,
    formats: canonical.formats,
  };
}

/** Client-safe registry — product keys without live env resolution. */
export const ORGANIC_PROVIDER_REGISTRY: OrganicProviderDefinition[] =
  getStaticOrganicSocialProviderKeys().map((item) =>
    canonicalToDefinition(
      {
        provider: item.provider,
        label: item.label,
        tier: item.tier,
        productAvailability: item.productAvailability,
        availabilityReason: null,
        capabilities: {
          accountRead:
            item.productAvailability === "available" || item.productAvailability === "beta",
          analytics: false,
          publish:
            item.productAvailability === "available" || item.productAvailability === "beta",
          schedule:
            (item.productAvailability === "available" || item.productAvailability === "beta") &&
            item.provider !== "X" &&
            item.provider !== "TIKTOK",
        },
        connectHref: "/integrations",
        formats: [],
      },
      false,
    ),
  );

export function mergeProviderRegistryWithConnections(
  connectedProviders: Set<string>,
  connectionStatus: Map<string, { status?: string; lastSyncAt?: Date | null }>,
): OrganicProviderDefinition[] {
  return getServerOrganicSocialCatalogue().map((canonical) => {
    const key = String(canonical.provider);
    const meta = connectionStatus.get(key);
    return canonicalToDefinition(
      canonical,
      connectedProviders.has(key),
      meta?.status,
      meta?.lastSyncAt ?? null,
    );
  });
}

export function groupProvidersByAvailability(providers: OrganicProviderDefinition[]): {
  connected: OrganicProviderDefinition[];
  availableToConnect: OrganicProviderDefinition[];
  comingSoon: OrganicProviderDefinition[];
  planned: OrganicProviderDefinition[];
} {
  return {
    connected: providers.filter((p) =>
      ["connected", "syncing", "stale", "reauth_required", "error"].includes(p.availability),
    ),
    availableToConnect: providers.filter(
      (p) => p.availability === "not_connected" && p.accountRead,
    ),
    comingSoon: providers.filter((p) => p.availability === "coming_soon"),
    planned: providers.filter((p) => p.availability === "planned"),
  };
}
