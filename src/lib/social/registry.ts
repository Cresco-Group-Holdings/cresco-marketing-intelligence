import type { SocialProvider } from "@prisma/client";
import { getServerEnv } from "@/lib/environment";
import type { SocialProviderCatalogueItem } from "@/lib/social/types";

type ProviderDefinition = Omit<SocialProviderCatalogueItem, "maturity" | "maturityReason"> & {
  envCheck: (env: ReturnType<typeof getServerEnv>) => boolean;
  beta?: boolean;
};

const PROVIDER_DEFINITIONS: ProviderDefinition[] = [
  {
    provider: "INSTAGRAM",
    name: "Instagram",
    description: "Connect an Instagram Business account for publishing and insights.",
    requiredScopes: ["instagram_basic", "instagram_content_publish", "pages_show_list"],
    optionalScopes: ["pages_read_engagement", "instagram_manage_insights"],
    supportsPkce: true,
    documentationUrl: "https://developers.facebook.com/docs/instagram-api",
    envCheck: (env) => Boolean(env.META_APP_ID && env.META_APP_SECRET),
  },
  {
    provider: "FACEBOOK",
    name: "Facebook",
    description: "Connect a Facebook Page for publishing and community management.",
    requiredScopes: ["pages_manage_posts", "pages_read_engagement", "pages_show_list"],
    optionalScopes: ["pages_messaging"],
    supportsPkce: true,
    documentationUrl: "https://developers.facebook.com/docs/pages",
    envCheck: (env) => Boolean(env.META_APP_ID && env.META_APP_SECRET),
  },
  {
    provider: "LINKEDIN",
    name: "LinkedIn",
    description: "Connect a LinkedIn organisation or member profile.",
    requiredScopes: ["r_organization_social", "w_organization_social"],
    optionalScopes: ["r_basicprofile", "w_member_social"],
    supportsPkce: true,
    documentationUrl: "https://learn.microsoft.com/en-us/linkedin/",
    envCheck: (env) => Boolean(env.LINKEDIN_CLIENT_ID && env.LINKEDIN_CLIENT_SECRET),
  },
  {
    provider: "TIKTOK",
    name: "TikTok",
    description: "Connect a TikTok Business account for video publishing.",
    requiredScopes: ["user.info.basic", "video.upload"],
    optionalScopes: ["video.list"],
    supportsPkce: true,
    documentationUrl: "https://developers.tiktok.com/",
    envCheck: (env) => Boolean(env.TIKTOK_CLIENT_KEY && env.TIKTOK_CLIENT_SECRET),
    beta: true,
  },
  {
    provider: "YOUTUBE",
    name: "YouTube",
    description: "Connect a YouTube channel for video publishing and analytics.",
    requiredScopes: [
      "https://www.googleapis.com/auth/youtube",
      "https://www.googleapis.com/auth/youtube.readonly",
    ],
    optionalScopes: ["https://www.googleapis.com/auth/youtube.upload"],
    supportsPkce: true,
    documentationUrl: "https://developers.google.com/youtube/v3",
    envCheck: (env) => Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
  },
  {
    provider: "X",
    name: "X",
    description: "Connect an X account for posting and engagement.",
    requiredScopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
    optionalScopes: ["dm.read", "dm.write"],
    supportsPkce: true,
    documentationUrl: "https://developer.x.com/en/docs",
    envCheck: (env) => Boolean(env.X_CLIENT_ID && env.X_CLIENT_SECRET),
    beta: true,
  },
];

function resolveMaturity(
  definition: ProviderDefinition,
  env: ReturnType<typeof getServerEnv>,
  adapterRegistered: boolean,
): Pick<SocialProviderCatalogueItem, "maturity" | "maturityReason"> {
  if (!adapterRegistered) {
    return {
      maturity: "unavailable",
      maturityReason: "Provider adapter is not registered.",
    };
  }

  if (!definition.envCheck(env)) {
    return {
      maturity: "not_configured",
      maturityReason: "Provider credentials are not configured in the environment.",
    };
  }

  if (definition.beta) {
    return {
      maturity: "beta",
      maturityReason: "Provider integration is in beta.",
    };
  }

  return {
    maturity: "available",
    maturityReason: null,
  };
}

export class SocialProviderRegistry {
  constructor(
    private readonly isAdapterRegistered: (provider: SocialProvider) => boolean = () => false,
  ) {}

  list(): SocialProviderCatalogueItem[] {
    const env = getServerEnv();
    return PROVIDER_DEFINITIONS.map((definition) => ({
      provider: definition.provider,
      name: definition.name,
      description: definition.description,
      requiredScopes: definition.requiredScopes,
      optionalScopes: definition.optionalScopes,
      supportsPkce: definition.supportsPkce,
      documentationUrl: definition.documentationUrl,
      ...resolveMaturity(definition, env, this.isAdapterRegistered(definition.provider)),
    }));
  }

  get(provider: SocialProvider): SocialProviderCatalogueItem {
    const item = this.list().find((entry) => entry.provider === provider);
    if (!item) {
      throw new Error(`Unknown social provider: ${provider}`);
    }
    return item;
  }

  isConnectable(provider: SocialProvider): boolean {
    const item = this.get(provider);
    return item.maturity === "available" || item.maturity === "beta";
  }

  getConnectDisabledReason(provider: SocialProvider): string | null {
    const item = this.get(provider);
    if (this.isConnectable(provider)) {
      return null;
    }
    return item.maturityReason ?? "Provider is not available.";
  }
}

export function createSocialProviderRegistry(
  isAdapterRegistered: (provider: SocialProvider) => boolean,
): SocialProviderRegistry {
  return new SocialProviderRegistry(isAdapterRegistered);
}
