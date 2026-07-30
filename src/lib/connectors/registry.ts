import type { ConnectorType } from "@prisma/client";
import type { ConnectorRegistryEntry } from "@/lib/connectors/types";
import { isStripeConfigured } from "@/lib/revenue/config";

const CATALOGUE: ConnectorRegistryEntry[] = [
  {
    key: "GOOGLE_ANALYTICS_4",
    name: "Google Analytics 4",
    description: "Import website analytics, events, and conversion data from GA4.",
    category: "Analytics",
    requiredScopes: ["https://www.googleapis.com/auth/analytics.readonly"],
    optionalScopes: [],
    supportsOAuth: true,
    platformAvailability: "AVAILABLE",
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
    platformAvailability: "AVAILABLE",
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
    platformAvailability: "AVAILABLE",
    documentationUrl: "https://developers.google.com/google-ads/api",
  },
  {
    key: "META",
    name: "Meta Ads",
    description: "Import advertising performance from Meta (Facebook & Instagram) ad accounts.",
    category: "Advertising",
    requiredScopes: ["ads_read"],
    optionalScopes: ["pages_read_engagement"],
    supportsOAuth: true,
    platformAvailability: "AVAILABLE",
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
    name: "LinkedIn Ads",
    description: "Import LinkedIn advertising campaign and performance data.",
    category: "Advertising",
    requiredScopes: ["r_ads"],
    optionalScopes: ["r_organization_social"],
    supportsOAuth: true,
    platformAvailability: "AVAILABLE",
    documentationUrl: "https://learn.microsoft.com/en-us/linkedin/",
  },
  {
    key: "TIKTOK",
    name: "TikTok Ads",
    description: "Import TikTok advertising performance data.",
    category: "Advertising",
    requiredScopes: ["user.info.basic"],
    optionalScopes: [],
    supportsOAuth: true,
    platformAvailability: "AVAILABLE",
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
    if (key === "STRIPE") return isStripeConfigured();
    return this.get(key).platformAvailability === "AVAILABLE";
  }

  getConnectDisabledReason(key: ConnectorType): string | null {
    if (key === "STRIPE" && !isStripeConfigured()) {
      return "Stripe requires STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET environment variables.";
    }
    const entry = this.get(key);
    if (entry.platformAvailability === "AVAILABLE" || (key === "STRIPE" && isStripeConfigured())) {
      return null;
    }
    return "This integration is not yet available. Connector infrastructure is in place, but provider adapters are coming in a future release.";
  }
}

export const connectorRegistry = new ConnectorRegistry();
