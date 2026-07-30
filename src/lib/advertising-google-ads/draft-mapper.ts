import { PROVIDER_NAME_LIMITS } from "@/lib/advertising-plans/constants";
import { SUPPORTED_BIDDING_STRATEGIES, SUPPORTED_NETWORK_SETTINGS } from "./constants";

export type PlanDraftInput = {
  planId: string;
  planName: string;
  internalCampaignId: string;
  reportingCurrency: string;
  startAt?: Date | null;
  endAt?: Date | null;
  totalBudgetAmount?: number | null;
  channels: Array<{ channelType: string; provider?: string | null }>;
  budgets: Array<{ budgetType: string; currency: string; amount: number; dailyAmount?: number | null }>;
  schedule?: { timezone?: string | null; dayParting?: unknown } | null;
  destinations: Array<{ destinationUrl?: string | null; utmSource?: string | null; utmMedium?: string | null; utmCampaign?: string | null }>;
  conversionGoals: Array<{ isPrimary: boolean; trackingVerified: boolean; conversionDefinitionId?: string }>;
  placements?: Array<{ targetCountries?: string[]; targetLanguages?: string[] }>;
  creatives?: Array<{
    format: string;
    headlines?: string[];
    descriptions?: string[];
    finalUrl?: string;
    path1?: string;
    path2?: string;
  }>;
  keywords?: Array<{ text: string; matchType: "BROAD" | "PHRASE" | "EXACT" }>;
  negativeKeywords?: string[];
};

export type GoogleAdsDraftPayload = {
  campaign: {
    name: string;
    advertisingChannelType: "SEARCH";
    status: "PAUSED";
    biddingStrategy: string;
    networkSettings: typeof SUPPORTED_NETWORK_SETTINGS;
    startDate?: string;
    endDate?: string;
  };
  budget: {
    name: string;
    amountMicros: number;
    deliveryMethod: "STANDARD";
    currency: string;
  };
  adGroups: Array<{
    name: string;
    status: "ENABLED";
    cpcBidMicros?: number;
    keywords: Array<{ text: string; matchType: string }>;
    negativeKeywords: string[];
    ads: Array<{
      type: "RESPONSIVE_SEARCH_AD";
      headlines: string[];
      descriptions: string[];
      finalUrls: string[];
      path1?: string;
      path2?: string;
    }>;
  }>;
  locations: string[];
  languages: string[];
  conversions: Array<{ conversionDefinitionId?: string; trackingVerified: boolean }>;
  assets: {
    sitelinks: Array<{ text: string; finalUrl: string }>;
    callouts: string[];
  };
  schedule?: { timezone?: string | null };
};

function truncateName(name: string, limit: number): string {
  return name.length <= limit ? name : `${name.slice(0, limit - 3)}...`;
}

function toMicros(amount: number): number {
  return Math.round(amount * 1_000_000);
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

export function mapPlanToGoogleAdsDraft(input: PlanDraftInput): GoogleAdsDraftPayload {
  const searchChannel = input.channels.find((c) => c.channelType === "GOOGLE_SEARCH");
  if (!searchChannel) {
    throw new Error("Plan must include a GOOGLE_SEARCH channel for Google Ads draft generation.");
  }

  const dailyBudget = input.budgets.find((b) => b.budgetType === "DAILY") ?? input.budgets[0];
  const amount = dailyBudget?.dailyAmount ?? dailyBudget?.amount ?? input.totalBudgetAmount ?? 0;
  const currency = dailyBudget?.currency ?? input.reportingCurrency;
  const nameLimit = PROVIDER_NAME_LIMITS.GOOGLE_ADS;
  const campaignName = truncateName(`${input.internalCampaignId}_${input.planName}`, nameLimit);
  const primaryDestination = input.destinations[0]?.destinationUrl ?? "https://example.com";
  const placement = input.placements?.[0];

  const headlines =
    input.creatives?.flatMap((c) => c.headlines ?? []).filter(Boolean).slice(0, 15) ??
    ["Learn more about our solution"];
  const descriptions =
    input.creatives?.flatMap((c) => c.descriptions ?? []).filter(Boolean).slice(0, 4) ??
    ["Discover how we can help your business grow."];

  const keywords =
    input.keywords?.length ?
      input.keywords
    : [{ text: input.planName.split(" ")[0] ?? "marketing", matchType: "PHRASE" as const }];

  return {
    campaign: {
      name: campaignName,
      advertisingChannelType: "SEARCH",
      status: "PAUSED",
      biddingStrategy: SUPPORTED_BIDDING_STRATEGIES[0],
      networkSettings: SUPPORTED_NETWORK_SETTINGS,
      startDate: input.startAt ? formatDate(input.startAt) : undefined,
      endDate: input.endAt ? formatDate(input.endAt) : undefined,
    },
    budget: {
      name: truncateName(`${campaignName}_budget`, nameLimit),
      amountMicros: toMicros(amount),
      deliveryMethod: "STANDARD",
      currency,
    },
    adGroups: [
      {
        name: truncateName(`${campaignName}_ad_group_1`, nameLimit),
        status: "ENABLED",
        keywords: keywords.map((k) => ({ text: k.text, matchType: k.matchType })),
        negativeKeywords: input.negativeKeywords ?? [],
        ads: [
          {
            type: "RESPONSIVE_SEARCH_AD",
            headlines: headlines.slice(0, 15),
            descriptions: descriptions.slice(0, 4),
            finalUrls: [primaryDestination],
            path1: input.creatives?.[0]?.path1,
            path2: input.creatives?.[0]?.path2,
          },
        ],
      },
    ],
    locations: placement?.targetCountries ?? ["US"],
    languages: placement?.targetLanguages ?? ["en"],
    conversions: input.conversionGoals.map((g) => ({
      conversionDefinitionId: g.conversionDefinitionId,
      trackingVerified: g.trackingVerified,
    })),
    assets: {
      sitelinks: input.destinations.slice(0, 4).map((d, i) => ({
        text: `Link ${i + 1}`,
        finalUrl: d.destinationUrl ?? primaryDestination,
      })),
      callouts: ["Free consultation", "Trusted provider"],
    },
    schedule: input.schedule ? { timezone: input.schedule.timezone } : undefined,
  };
}

export function isSearchCampaignSupported(channelTypes: string[]): boolean {
  return channelTypes.includes("GOOGLE_SEARCH");
}
