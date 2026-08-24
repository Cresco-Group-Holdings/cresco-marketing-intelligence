import type { OrganicProviderDefinition } from "@/lib/organic-growth/types";

/** Canonical organic provider registry — availability reflects real adapter support, not marketing claims. */
export const ORGANIC_PROVIDER_REGISTRY: OrganicProviderDefinition[] = [
  {
    provider: "LINKEDIN",
    label: "LinkedIn",
    tier: "core",
    availability: "not_connected",
    accountRead: true,
    analytics: true,
    publish: true,
    schedule: true,
    connectHref: "/integrations?provider=linkedin",
    formats: ["text_post", "image_post", "carousel", "long_video", "document"],
  },
  {
    provider: "X",
    label: "X",
    tier: "core",
    availability: "not_connected",
    accountRead: true,
    analytics: true,
    publish: true,
    schedule: false,
    connectHref: "/integrations?provider=x",
    formats: ["text_post", "thread", "image_post", "short_video"],
  },
  {
    provider: "INSTAGRAM",
    label: "Instagram",
    tier: "core",
    availability: "not_connected",
    accountRead: true,
    analytics: true,
    publish: true,
    schedule: true,
    connectHref: "/integrations?provider=instagram",
    formats: ["image_post", "carousel", "short_video", "story"],
  },
  {
    provider: "FACEBOOK",
    label: "Facebook",
    tier: "core",
    availability: "not_connected",
    accountRead: true,
    analytics: true,
    publish: true,
    schedule: true,
    connectHref: "/integrations?provider=facebook",
    formats: ["text_post", "image_post", "carousel", "short_video"],
  },
  {
    provider: "TIKTOK",
    label: "TikTok",
    tier: "core",
    availability: "not_connected",
    accountRead: true,
    analytics: true,
    publish: true,
    schedule: false,
    connectHref: "/integrations?provider=tiktok",
    formats: ["short_video"],
  },
  {
    provider: "YOUTUBE",
    label: "YouTube",
    tier: "core",
    availability: "not_connected",
    accountRead: true,
    analytics: true,
    publish: true,
    schedule: true,
    connectHref: "/integrations?provider=youtube",
    formats: ["long_video", "short_video"],
  },
  {
    provider: "THREADS",
    label: "Threads",
    tier: "core",
    availability: "coming_soon",
    accountRead: false,
    analytics: false,
    publish: false,
    schedule: false,
    connectHref: "/integrations?provider=threads",
    formats: ["text_post", "image_post"],
  },
  {
    provider: "PINTEREST",
    label: "Pinterest",
    tier: "core",
    availability: "coming_soon",
    accountRead: false,
    analytics: false,
    publish: false,
    schedule: false,
    connectHref: "/integrations?provider=pinterest",
    formats: ["image_post", "carousel"],
  },
  {
    provider: "REDDIT",
    label: "Reddit",
    tier: "secondary",
    availability: "planned",
    accountRead: false,
    analytics: false,
    publish: false,
    schedule: false,
    connectHref: "/integrations?provider=reddit",
    formats: ["text_post", "image_post"],
  },
  {
    provider: "BLUESKY",
    label: "Bluesky",
    tier: "secondary",
    availability: "planned",
    accountRead: false,
    analytics: false,
    publish: false,
    schedule: false,
    connectHref: "/integrations?provider=bluesky",
    formats: ["text_post", "image_post"],
  },
  {
    provider: "MEDIUM",
    label: "Medium",
    tier: "secondary",
    availability: "planned",
    accountRead: false,
    analytics: false,
    publish: false,
    schedule: false,
    connectHref: "/integrations",
    formats: ["article"],
  },
  {
    provider: "SUBSTACK",
    label: "Substack",
    tier: "secondary",
    availability: "planned",
    accountRead: false,
    analytics: false,
    publish: false,
    schedule: false,
    connectHref: "/integrations",
    formats: ["article"],
  },
  {
    provider: "TELEGRAM",
    label: "Telegram",
    tier: "secondary",
    availability: "planned",
    accountRead: false,
    analytics: false,
    publish: false,
    schedule: false,
    connectHref: "/integrations",
    formats: ["text_post", "image_post"],
  },
];

export function resolveProviderAvailability(
  providerKey: string,
  connected: boolean,
  status?: string,
  lastSyncAt?: Date | null,
): OrganicProviderDefinition["availability"] {
  const registry = ORGANIC_PROVIDER_REGISTRY.find(
    (p) => p.provider === providerKey || p.label.toUpperCase() === providerKey.toUpperCase(),
  );
  if (registry?.availability === "coming_soon" || registry?.availability === "planned") {
    return registry.availability;
  }
  if (!connected) return "not_connected";
  if (status === "RECONNECT_REQUIRED") return "reauth_required";
  if (status === "ERROR") return "error";
  if (lastSyncAt) {
    const ageHours = (Date.now() - lastSyncAt.getTime()) / (1000 * 60 * 60);
    if (ageHours > 24) return "stale";
    if (ageHours > 1 && status === "SYNCING") return "syncing";
  }
  return "connected";
}

export function mergeProviderRegistryWithConnections(
  connectedProviders: Set<string>,
  connectionStatus: Map<string, { status?: string; lastSyncAt?: Date | null }>,
): OrganicProviderDefinition[] {
  return ORGANIC_PROVIDER_REGISTRY.map((provider) => {
    const key = String(provider.provider);
    const isConnected = connectedProviders.has(key);
    const meta = connectionStatus.get(key);
    return {
      ...provider,
      availability: resolveProviderAvailability(key, isConnected, meta?.status, meta?.lastSyncAt ?? null),
      accountRead: isConnected ? provider.accountRead : provider.availability !== "planned",
      analytics: isConnected && provider.analytics,
      publish: isConnected && provider.publish,
    };
  });
}
