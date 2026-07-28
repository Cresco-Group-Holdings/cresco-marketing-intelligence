import type { ConnectorType } from "@prisma/client";
import type { ConnectorRegistryEntry } from "@/lib/connectors/types";

const CATALOGUE: ConnectorRegistryEntry[] = [
  {
    key: "GOOGLE_ANALYTICS_4",
    name: "Google Analytics 4",
    description: "Import website analytics, events, and conversion data from GA4.",
    category: "Analytics",
    requiredScopes: ["https://www.googleapis.com/auth/analytics.readonly"],
    optionalScopes: [],
    supportsOAuth: true,
    platformAvailability: "COMING_SOON",
    documentationUrl: "https://developers.google.com/analytics",
  },
  {
    key: "GOOGLE_SEARCH_CONSOLE",
    name: "Google Search Console",
    description: "Import search performance, indexing, and query data.",
    category: "SEO",
    requiredScopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
    optionalScopes: [],
    supportsOAuth: true,
    platformAvailability: "COMING_SOON",
    documentationUrl: "https://developers.google.com/webmaster-tools",
  },
  {
    key: "GOOGLE_ADS",
    name: "Google Ads",
    description: "Import campaign, ad group, and spend data from Google Ads.",
    category: "Advertising",
    requiredScopes: ["https://www.googleapis.com/auth/adwords"],
    optionalScopes: [],
    supportsOAuth: true,
    platformAvailability: "COMING_SOON",
    documentationUrl: "https://developers.google.com/google-ads/api",
  },
  {
    key: "META",
    name: "Meta",
    description: "Import advertising and page insights from Meta platforms.",
    category: "Advertising",
    requiredScopes: ["ads_read"],
    optionalScopes: ["pages_read_engagement"],
    supportsOAuth: true,
    platformAvailability: "COMING_SOON",
    documentationUrl: "https://developers.facebook.com/docs/marketing-apis",
  },
  {
    key: "INSTAGRAM",
    name: "Instagram",
    description: "Import Instagram business account content and insights.",
    category: "Social",
    requiredScopes: ["instagram_basic"],
    optionalScopes: ["instagram_manage_insights"],
    supportsOAuth: true,
    platformAvailability: "COMING_SOON",
    documentationUrl: "https://developers.facebook.com/docs/instagram-api",
  },
  {
    key: "LINKEDIN",
    name: "LinkedIn",
    description: "Import LinkedIn page and advertising performance data.",
    category: "Social",
    requiredScopes: ["r_organization_social"],
    optionalScopes: ["r_ads"],
    supportsOAuth: true,
    platformAvailability: "COMING_SOON",
    documentationUrl: "https://learn.microsoft.com/en-us/linkedin/",
  },
  {
    key: "TIKTOK",
    name: "TikTok",
    description: "Import TikTok advertising and organic performance data.",
    category: "Social",
    requiredScopes: ["user.info.basic"],
    optionalScopes: ["video.list"],
    supportsOAuth: true,
    platformAvailability: "COMING_SOON",
    documentationUrl: "https://developers.tiktok.com/",
  },
  {
    key: "YOUTUBE",
    name: "YouTube",
    description: "Import YouTube channel analytics and content metadata.",
    category: "Social",
    requiredScopes: ["https://www.googleapis.com/auth/youtube.readonly"],
    optionalScopes: ["https://www.googleapis.com/auth/yt-analytics.readonly"],
    supportsOAuth: true,
    platformAvailability: "COMING_SOON",
    documentationUrl: "https://developers.google.com/youtube",
  },
  {
    key: "X",
    name: "X",
    description: "Import X account analytics and post performance.",
    category: "Social",
    requiredScopes: ["tweet.read"],
    optionalScopes: ["users.read"],
    supportsOAuth: true,
    platformAvailability: "COMING_SOON",
    documentationUrl: "https://developer.x.com/en/docs",
  },
  {
    key: "STRIPE",
    name: "Stripe",
    description: "Import revenue, subscription, and payment events.",
    category: "Commerce",
    requiredScopes: ["read_only"],
    optionalScopes: [],
    supportsOAuth: true,
    platformAvailability: "COMING_SOON",
    documentationUrl: "https://stripe.com/docs/api",
  },
  {
    key: "EMAIL_PROVIDER",
    name: "Email Provider",
    description: "Connect email marketing platforms for campaign and list data.",
    category: "Email",
    requiredScopes: ["campaigns.read"],
    optionalScopes: ["lists.read"],
    supportsOAuth: true,
    platformAvailability: "COMING_SOON",
  },
  {
    key: "CRM_PROVIDER",
    name: "CRM Provider",
    description: "Connect CRM systems for lead and pipeline data.",
    category: "CRM",
    requiredScopes: ["contacts.read"],
    optionalScopes: ["deals.read"],
    supportsOAuth: true,
    platformAvailability: "COMING_SOON",
  },
];

export class ConnectorRegistry {
  list(): ConnectorRegistryEntry[] {
    return CATALOGUE;
  }

  get(key: ConnectorType): ConnectorRegistryEntry {
    const entry = CATALOGUE.find((item) => item.key === key);
    if (!entry) {
      throw new Error(`Connector definition not found: ${key}`);
    }
    return entry;
  }

  isConnectable(key: ConnectorType): boolean {
    return this.get(key).platformAvailability === "AVAILABLE";
  }

  getConnectDisabledReason(key: ConnectorType): string | null {
    const entry = this.get(key);
    if (entry.platformAvailability === "AVAILABLE") {
      return null;
    }
    return "This integration is not yet available. Connector infrastructure is in place, but provider adapters are coming in a future release.";
  }
}

export const connectorRegistry = new ConnectorRegistry();
