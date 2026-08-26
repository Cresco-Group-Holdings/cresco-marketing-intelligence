import type { SocialProvider } from "@prisma/client";
import { getServerEnv } from "@/lib/environment";
import {
  isProductionOAuthReady,
  resolveOAuthProviderKey,
} from "@/lib/providers/provider-availability";
import { socialAdapterFactory } from "@/lib/social/adapters/mock-social-adapter";
import { createSocialProviderRegistry } from "@/lib/social/registry";
import type { SocialProviderCatalogueItem } from "@/lib/social/types";

/** Product availability — distinct from per-brand connection state. */
export type OrganicProductAvailability =
  | "available"
  | "beta"
  | "not_configured"
  | "unavailable"
  | "coming_soon"
  | "planned";

export type OrganicProviderCapabilities = {
  accountRead: boolean;
  analytics: boolean;
  publish: boolean;
  schedule: boolean;
};

export type CanonicalOrganicProvider = {
  provider: SocialProvider | string;
  label: string;
  tier: "core" | "secondary";
  productAvailability: OrganicProductAvailability;
  availabilityReason: string | null;
  capabilities: OrganicProviderCapabilities;
  connectHref: string;
  formats: string[];
  unifiedProviderKey?: string;
};

const INTEGRATIONS_CONNECT_ROUTE = "/integrations";

const ROADMAP_PROVIDERS: CanonicalOrganicProvider[] = [
  {
    provider: "THREADS",
    label: "Threads",
    tier: "core",
    productAvailability: "coming_soon",
    availabilityReason: "Threads integration is on the provider roadmap.",
    capabilities: { accountRead: false, analytics: false, publish: false, schedule: false },
    connectHref: INTEGRATIONS_CONNECT_ROUTE,
    formats: ["text_post", "image_post"],
  },
  {
    provider: "PINTEREST",
    label: "Pinterest",
    tier: "core",
    productAvailability: "coming_soon",
    availabilityReason: "Pinterest integration is on the provider roadmap.",
    capabilities: { accountRead: false, analytics: false, publish: false, schedule: false },
    connectHref: INTEGRATIONS_CONNECT_ROUTE,
    formats: ["image_post", "carousel"],
  },
  {
    provider: "REDDIT",
    label: "Reddit",
    tier: "secondary",
    productAvailability: "planned",
    availabilityReason: "Reddit is planned for community intelligence.",
    capabilities: { accountRead: false, analytics: false, publish: false, schedule: false },
    connectHref: INTEGRATIONS_CONNECT_ROUTE,
    formats: ["text_post", "image_post"],
  },
  {
    provider: "BLUESKY",
    label: "Bluesky",
    tier: "secondary",
    productAvailability: "planned",
    availabilityReason: "Bluesky is on the long-term roadmap.",
    capabilities: { accountRead: false, analytics: false, publish: false, schedule: false },
    connectHref: INTEGRATIONS_CONNECT_ROUTE,
    formats: ["text_post", "image_post"],
  },
  {
    provider: "MEDIUM",
    label: "Medium",
    tier: "secondary",
    productAvailability: "planned",
    availabilityReason: "Medium distribution is planned.",
    capabilities: { accountRead: false, analytics: false, publish: false, schedule: false },
    connectHref: INTEGRATIONS_CONNECT_ROUTE,
    formats: ["article"],
  },
  {
    provider: "SUBSTACK",
    label: "Substack",
    tier: "secondary",
    productAvailability: "planned",
    availabilityReason: "Substack distribution is planned.",
    capabilities: { accountRead: false, analytics: false, publish: false, schedule: false },
    connectHref: INTEGRATIONS_CONNECT_ROUTE,
    formats: ["article"],
  },
  {
    provider: "TELEGRAM",
    label: "Telegram",
    tier: "secondary",
    productAvailability: "planned",
    availabilityReason: "Telegram is on the long-term roadmap.",
    capabilities: { accountRead: false, analytics: false, publish: false, schedule: false },
    connectHref: INTEGRATIONS_CONNECT_ROUTE,
    formats: ["text_post", "image_post"],
  },
];

const PROVIDER_FORMATS: Record<SocialProvider, string[]> = {
  LINKEDIN: ["text_post", "image_post", "carousel", "long_video", "document"],
  X: ["text_post", "thread", "image_post", "short_video"],
  INSTAGRAM: ["image_post", "carousel", "short_video", "story"],
  FACEBOOK: ["text_post", "image_post", "carousel", "short_video"],
  TIKTOK: ["short_video"],
  YOUTUBE: ["long_video", "short_video"],
};

const UNIFIED_KEY_BY_SOCIAL: Record<SocialProvider, string> = {
  LINKEDIN: "linkedin",
  X: "x",
  INSTAGRAM: "instagram",
  FACEBOOK: "facebook",
  TIKTOK: "tiktok",
  YOUTUBE: "youtube",
};

const SOCIAL_BY_UNIFIED_KEY: Record<string, SocialProvider> = Object.fromEntries(
  Object.entries(UNIFIED_KEY_BY_SOCIAL).map(([social, unified]) => [unified, social as SocialProvider]),
) as Record<string, SocialProvider>;

function mapMaturityToProductAvailability(
  maturity: SocialProviderCatalogueItem["maturity"],
): OrganicProductAvailability {
  switch (maturity) {
    case "available":
      return "available";
    case "beta":
      return "beta";
    case "not_configured":
      return "not_configured";
    case "unavailable":
    default:
      return "unavailable";
  }
}

function capabilitiesForSocialProvider(provider: SocialProvider): OrganicProviderCapabilities {
  return {
    accountRead: true,
    analytics: true,
    publish: true,
    schedule: provider !== "X" && provider !== "TIKTOK",
  };
}

function isOrganicProviderAdapterReady(provider: SocialProvider): boolean {
  const unifiedKey = UNIFIED_KEY_BY_SOCIAL[provider];
  const oauthKey = resolveOAuthProviderKey(unifiedKey);
  if (isProductionOAuthReady(oauthKey)) {
    return true;
  }
  return socialAdapterFactory.getAdapter(provider) !== null;
}

function socialItemToCanonical(item: SocialProviderCatalogueItem): CanonicalOrganicProvider {
  const productAvailability = mapMaturityToProductAvailability(item.maturity);
  const connectable = productAvailability === "available" || productAvailability === "beta";

  return {
    provider: item.provider,
    label: item.name,
    tier: "core",
    productAvailability,
    availabilityReason: connectable ? null : item.maturityReason,
    capabilities: connectable
      ? capabilitiesForSocialProvider(item.provider)
      : { accountRead: false, analytics: false, publish: false, schedule: false },
    connectHref: INTEGRATIONS_CONNECT_ROUTE,
    formats: PROVIDER_FORMATS[item.provider],
    unifiedProviderKey: UNIFIED_KEY_BY_SOCIAL[item.provider],
  };
}

export function createOrganicSocialCatalogue(
  isAdapterRegistered: (provider: SocialProvider) => boolean = isOrganicProviderAdapterReady,
): CanonicalOrganicProvider[] {
  const registry = createSocialProviderRegistry(isAdapterRegistered);
  const socialProviders = registry.list().map(socialItemToCanonical);
  return [...socialProviders, ...ROADMAP_PROVIDERS];
}

export function getCanonicalOrganicSocialCatalogue(): CanonicalOrganicProvider[] {
  return createOrganicSocialCatalogue();
}

export function resolveUnifiedProviderOrganicStatus(unifiedKey: string): {
  status: "AVAILABLE" | "BETA" | "MISCONFIGURED" | "DISABLED";
  statusLabel: string;
  connectRoute: string | null;
  organicSocial: boolean;
} | null {
  const socialProvider = SOCIAL_BY_UNIFIED_KEY[unifiedKey];
  if (!socialProvider) return null;

  const registry = createSocialProviderRegistry(isOrganicProviderAdapterReady);

  const item = registry.get(socialProvider);
  const productAvailability = mapMaturityToProductAvailability(item.maturity);
  const connectable = productAvailability === "available" || productAvailability === "beta";

  switch (productAvailability) {
    case "available":
      return {
        status: "AVAILABLE",
        statusLabel: "Available",
        connectRoute: INTEGRATIONS_CONNECT_ROUTE,
        organicSocial: true,
      };
    case "beta":
      return {
        status: "BETA",
        statusLabel: "Beta",
        connectRoute: INTEGRATIONS_CONNECT_ROUTE,
        organicSocial: true,
      };
    case "not_configured":
      return {
        status: "MISCONFIGURED",
        statusLabel: "Not configured",
        connectRoute: null,
        organicSocial: true,
      };
    case "unavailable":
    default:
      return {
        status: "DISABLED",
        statusLabel: "Unavailable",
        connectRoute: null,
        organicSocial: true,
      };
  }
}

export function isOrganicSocialUnifiedKey(unifiedKey: string): boolean {
  return unifiedKey in SOCIAL_BY_UNIFIED_KEY;
}

export function mapProductAvailabilityToConnectAction(
  availability: OrganicProductAvailability,
): "connect" | "coming_soon" | "planned" | "unavailable" | "reconnect" {
  switch (availability) {
    case "available":
    case "beta":
      return "connect";
    case "coming_soon":
      return "coming_soon";
    case "planned":
      return "planned";
    case "not_configured":
    case "unavailable":
    default:
      return "unavailable";
  }
}

export function resolveConnectionAvailability(
  productAvailability: OrganicProductAvailability,
  connected: boolean,
  connectionStatus?: string,
): OrganicProductAvailability | "connected" | "reauth_required" | "syncing" | "stale" | "error" {
  if (productAvailability === "coming_soon" || productAvailability === "planned") {
    return productAvailability;
  }
  if (!connected) {
    return productAvailability;
  }
  if (connectionStatus === "RECONNECT_REQUIRED") return "reauth_required";
  if (connectionStatus === "ERROR") return "error";
  if (connectionStatus === "SYNCING") return "syncing";
  return "connected";
}

export function getServerOrganicSocialCatalogue(): CanonicalOrganicProvider[] {
  return createOrganicSocialCatalogue(isOrganicProviderAdapterReady);
}

const STATIC_SOCIAL_PROVIDER_KEYS: Array<{
  provider: SocialProvider;
  label: string;
  formats: string[];
  schedule: boolean;
}> = [
  { provider: "LINKEDIN", label: "LinkedIn", formats: PROVIDER_FORMATS.LINKEDIN, schedule: true },
  { provider: "X", label: "X", formats: PROVIDER_FORMATS.X, schedule: false },
  { provider: "INSTAGRAM", label: "Instagram", formats: PROVIDER_FORMATS.INSTAGRAM, schedule: true },
  { provider: "FACEBOOK", label: "Facebook", formats: PROVIDER_FORMATS.FACEBOOK, schedule: true },
  { provider: "TIKTOK", label: "TikTok", formats: PROVIDER_FORMATS.TIKTOK, schedule: false },
  { provider: "YOUTUBE", label: "YouTube", formats: PROVIDER_FORMATS.YOUTUBE, schedule: true },
];

/** Client-safe provider list without environment resolution. */
export function getStaticOrganicSocialProviderKeys(): Array<{
  provider: string;
  label: string;
  tier: "core" | "secondary";
  productAvailability: OrganicProductAvailability;
}> {
  return [
    ...STATIC_SOCIAL_PROVIDER_KEYS.map((item) => ({
      provider: item.provider,
      label: item.label,
      tier: "core" as const,
      productAvailability: "available" as const,
    })),
    ...ROADMAP_PROVIDERS.map((item) => ({
      provider: String(item.provider),
      label: item.label,
      tier: item.tier,
      productAvailability: item.productAvailability,
    })),
  ];
}
