import type { MarketingDataProvider } from "@prisma/client";
import {
  CHANNEL_CLASSIFICATION_RULE_VERSION,
  TOP_LEVEL_CHANNELS,
  type TopLevelChannel,
} from "@/lib/warehouse/constants";

export type ChannelClassificationInput = {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  referrer?: string | null;
  provider?: MarketingDataProvider | string | null;
};

export type ChannelClassificationResult = {
  channel: TopLevelChannel;
  confidence: number;
  ruleVersion: string;
  matchedRule: string;
};

type Rule = {
  id: string;
  channel: TopLevelChannel;
  confidence: number;
  match: (input: ChannelClassificationInput) => boolean;
};

const paidMediums = new Set(["cpc", "ppc", "paid", "paid_social", "paidsocial", "display", "cpm"]);
const socialMediums = new Set(["social", "social-network", "sm", "organic_social"]);
const emailMediums = new Set(["email", "newsletter", "e-mail"]);
const affiliateMediums = new Set(["affiliate", "partner", "referral_program"]);
const videoMediums = new Set(["video", "youtube", "ctv"]);

const searchReferrers = ["google.", "bing.", "yahoo.", "duckduckgo.", "baidu."];
const socialReferrers = [
  "facebook.",
  "instagram.",
  "linkedin.",
  "twitter.",
  "x.com",
  "tiktok.",
  "youtube.",
  "pinterest.",
];

function normalise(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

const RULES: Rule[] = [
  {
    id: "provider-social",
    channel: "ORGANIC_SOCIAL",
    confidence: 0.85,
    match: (input) =>
      ["INSTAGRAM", "LINKEDIN", "TIKTOK", "YOUTUBE", "X", "SOCIAL_BRIDGE"].includes(
        String(input.provider ?? ""),
      ),
  },
  {
    id: "provider-paid-ads",
    channel: "PAID_SOCIAL",
    confidence: 0.9,
    match: (input) => ["META", "GOOGLE_ADS"].includes(String(input.provider ?? "")),
  },
  {
    id: "provider-search-console",
    channel: "ORGANIC_SEARCH",
    confidence: 0.95,
    match: (input) => input.provider === "GOOGLE_SEARCH_CONSOLE",
  },
  {
    id: "provider-email",
    channel: "EMAIL",
    confidence: 0.95,
    match: (input) => input.provider === "EMAIL_PROVIDER",
  },
  {
    id: "utm-medium-paid-search",
    channel: "PAID_SEARCH",
    confidence: 0.9,
    match: (input) => {
      const medium = normalise(input.utmMedium);
      return paidMediums.has(medium) && /search|sem|google/.test(normalise(input.utmSource));
    },
  },
  {
    id: "utm-medium-paid-social",
    channel: "PAID_SOCIAL",
    confidence: 0.88,
    match: (input) => {
      const medium = normalise(input.utmMedium);
      return paidMediums.has(medium) && /facebook|instagram|meta|linkedin|tiktok|x|twitter/.test(
        normalise(input.utmSource),
      );
    },
  },
  {
    id: "utm-medium-display",
    channel: "DISPLAY",
    confidence: 0.85,
    match: (input) => normalise(input.utmMedium) === "display" || normalise(input.utmMedium) === "banner",
  },
  {
    id: "utm-medium-email",
    channel: "EMAIL",
    confidence: 0.92,
    match: (input) => emailMediums.has(normalise(input.utmMedium)),
  },
  {
    id: "utm-medium-affiliate",
    channel: "AFFILIATE",
    confidence: 0.9,
    match: (input) => affiliateMediums.has(normalise(input.utmMedium)),
  },
  {
    id: "utm-medium-video",
    channel: "VIDEO",
    confidence: 0.85,
    match: (input) => videoMediums.has(normalise(input.utmMedium)),
  },
  {
    id: "utm-medium-social",
    channel: "ORGANIC_SOCIAL",
    confidence: 0.8,
    match: (input) => socialMediums.has(normalise(input.utmMedium)),
  },
  {
    id: "referrer-search",
    channel: "ORGANIC_SEARCH",
    confidence: 0.75,
    match: (input) => {
      const referrer = normalise(input.referrer);
      return searchReferrers.some((host) => referrer.includes(host));
    },
  },
  {
    id: "referrer-social",
    channel: "ORGANIC_SOCIAL",
    confidence: 0.72,
    match: (input) => {
      const referrer = normalise(input.referrer);
      return socialReferrers.some((host) => referrer.includes(host));
    },
  },
  {
    id: "utm-medium-direct",
    channel: "DIRECT",
    confidence: 0.7,
    match: (input) => {
      const medium = normalise(input.utmMedium);
      return medium === "(none)" || medium === "direct" || medium === "none";
    },
  },
  {
    id: "referrer-present",
    channel: "REFERRAL",
    confidence: 0.65,
    match: (input) => Boolean(normalise(input.referrer)),
  },
];

export function classifyChannel(input: ChannelClassificationInput): ChannelClassificationResult {
  for (const rule of RULES) {
    if (rule.match(input)) {
      return {
        channel: rule.channel,
        confidence: rule.confidence,
        ruleVersion: CHANNEL_CLASSIFICATION_RULE_VERSION,
        matchedRule: rule.id,
      };
    }
  }

  return {
    channel: "OTHER",
    confidence: 0.5,
    ruleVersion: CHANNEL_CLASSIFICATION_RULE_VERSION,
    matchedRule: "fallback-other",
  };
}

export function isValidTopLevelChannel(value: string): value is TopLevelChannel {
  return (TOP_LEVEL_CHANNELS as readonly string[]).includes(value);
}
