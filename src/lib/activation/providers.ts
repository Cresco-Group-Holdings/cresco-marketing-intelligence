import type { BrandMarketingChannel } from "@prisma/client";

export type ActivationProviderRecommendation = {
  providerKey: string;
  label: string;
  category: "website_analytics" | "social" | "paid" | "optional";
  unlocks: string[];
  connectHref: string;
  priority: number;
};

export const ACTIVATION_PROVIDER_CATALOG: ActivationProviderRecommendation[] = [
  {
    providerKey: "google_analytics_4",
    label: "Google Analytics 4",
    category: "website_analytics",
    unlocks: [
      "Website sessions",
      "Conversions",
      "Funnel analytics",
      "Attribution",
    ],
    connectHref: "/integrations?provider=google_analytics_4",
    priority: 1,
  },
  {
    providerKey: "linkedin",
    label: "LinkedIn",
    category: "social",
    unlocks: [
      "Organic reach",
      "Engagement analytics",
      "Publishing",
      "Winning content detection",
    ],
    connectHref: "/integrations?provider=linkedin",
    priority: 2,
  },
  {
    providerKey: "instagram",
    label: "Instagram",
    category: "social",
    unlocks: ["Organic analytics", "Publishing", "Content performance"],
    connectHref: "/integrations?provider=instagram",
    priority: 3,
  },
  {
    providerKey: "facebook",
    label: "Facebook",
    category: "social",
    unlocks: ["Organic analytics", "Publishing", "Page insights"],
    connectHref: "/integrations?provider=facebook",
    priority: 4,
  },
  {
    providerKey: "x",
    label: "X",
    category: "social",
    unlocks: ["Organic analytics", "Publishing"],
    connectHref: "/integrations?provider=x",
    priority: 5,
  },
  {
    providerKey: "youtube",
    label: "YouTube",
    category: "social",
    unlocks: ["Channel analytics", "Publishing"],
    connectHref: "/integrations?provider=youtube",
    priority: 6,
  },
];

const CHANNEL_TO_PROVIDER: Partial<Record<BrandMarketingChannel, string>> = {
  LINKEDIN: "linkedin",
  INSTAGRAM: "instagram",
  FACEBOOK: "facebook",
  X: "x",
  YOUTUBE: "youtube",
  TIKTOK: "tiktok",
};

export type ActivationGoal =
  | "grow_organic_reach"
  | "create_better_content"
  | "understand_performance"
  | "improve_paid_advertising"
  | "track_conversions"
  | "manage_in_one_place";

export function recommendProviders(input: {
  goal?: ActivationGoal | null;
  channels?: BrandMarketingChannel[];
  connectedProviderKeys?: string[];
}): {
  recommended: ActivationProviderRecommendation[];
  optional: ActivationProviderRecommendation[];
} {
  const connected = new Set((input.connectedProviderKeys ?? []).map((key) => key.toLowerCase()));
  const available = ACTIVATION_PROVIDER_CATALOG.filter((provider) => !connected.has(provider.providerKey));

  const channelProviderKeys = new Set(
    (input.channels ?? [])
      .map((channel) => CHANNEL_TO_PROVIDER[channel])
      .filter((value): value is string => Boolean(value)),
  );

  const scoreProvider = (provider: ActivationProviderRecommendation): number => {
    let score = 100 - provider.priority;

    if (channelProviderKeys.has(provider.providerKey)) {
      score += 50;
    }

    if (input.goal === "understand_performance" || input.goal === "track_conversions") {
      if (provider.category === "website_analytics") score += 40;
    }

    if (input.goal === "grow_organic_reach" || input.goal === "create_better_content") {
      if (provider.category === "social") score += 40;
    }

    if (input.goal === "improve_paid_advertising") {
      if (provider.category === "website_analytics") score += 20;
    }

    return score;
  };

  const sorted = [...available].sort((left, right) => scoreProvider(right) - scoreProvider(left));
  const recommended = sorted.slice(0, 2);
  const optional = sorted.slice(2);

  return { recommended, optional };
}
