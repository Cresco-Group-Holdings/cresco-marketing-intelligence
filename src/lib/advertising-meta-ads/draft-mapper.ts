import { translatePlanObjective } from "./objective-mapper";
import { validateTargetingPolicy, type ApprovedTargetingInput } from "./targeting-policy";

export type PlanDraftInput = {
  planId: string;
  planName: string;
  internalCampaignId: string;
  primaryObjective?: string | null;
  reportingCurrency: string;
  channels: Array<{ channelType: string }>;
  budgets: Array<{ budgetType: string; currency: string; amount: number }>;
  destinations: Array<{ destinationUrl?: string | null }>;
  placements?: Array<{ platforms?: string[] }>;
  creatives?: Array<{ format: string; headline?: string | null; description?: string | null }>;
  targeting?: ApprovedTargetingInput;
};

export type MetaAdsDraftPayload = {
  campaign: {
    name: string;
    objective: string;
    objectiveLabel: string;
    status: "PAUSED";
    special_ad_categories: string[];
  };
  adSet: {
    name: string;
    daily_budget?: number;
    lifetime_budget?: number;
    billing_event: string;
    optimization_goal: string;
    targeting: Record<string, unknown>;
    publisher_platforms: string[];
    facebook_positions?: string[];
    instagram_positions?: string[];
    start_time?: string;
    end_time?: string;
  };
  ad: {
    name: string;
    status: "PAUSED";
  };
  creative: {
    format: string;
    primaryText: string;
    headline: string;
    description?: string;
    link: string;
    call_to_action_type: string;
  };
  tracking: {
    pixel_id?: string;
    dataset_id?: string;
    url_tags?: string;
  };
  assets: {
    facebook_page_id?: string;
    instagram_actor_id?: string;
  };
};

function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function mapPlanToMetaAdsDraft(
  input: PlanDraftInput,
  assets: { facebookPageId?: string; instagramAccountId?: string; pixelId?: string; datasetId?: string },
): MetaAdsDraftPayload {
  const hasFacebook = input.channels.some((c) => c.channelType === "META_FACEBOOK");
  const hasInstagram = input.channels.some((c) => c.channelType === "META_INSTAGRAM");
  if (!hasFacebook && !hasInstagram) {
    throw new Error("Plan must include META_FACEBOOK or META_INSTAGRAM channel.");
  }

  const objective = translatePlanObjective(input.primaryObjective);
  const dailyBudget = input.budgets.find((b) => b.budgetType === "DAILY") ?? input.budgets[0];
  const targetingResult = validateTargetingPolicy(input.targeting ?? { countries: ["US"] });
  if (!targetingResult.allowed) {
    throw new Error(targetingResult.violations.join(" "));
  }

  const destination = input.destinations[0]?.destinationUrl ?? "https://example.com";
  const creative = input.creatives?.[0];
  const platforms: string[] = [];
  if (hasFacebook) platforms.push("facebook");
  if (hasInstagram) platforms.push("instagram");

  return {
    campaign: {
      name: `${input.internalCampaignId}_${input.planName}`.slice(0, 255),
      objective: objective.metaObjective,
      objectiveLabel: objective.label,
      status: "PAUSED",
      special_ad_categories: [],
    },
    adSet: {
      name: `${input.planName} Ad Set`.slice(0, 255),
      daily_budget: dailyBudget ? toCents(dailyBudget.amount) : toCents(50),
      billing_event: "IMPRESSIONS",
      optimization_goal: objective.metaObjective === "OUTCOME_SALES" ? "OFFSITE_CONVERSIONS" : "LINK_CLICKS",
      targeting: targetingResult.normalised,
      publisher_platforms: platforms,
      facebook_positions: hasFacebook ? ["feed"] : undefined,
      instagram_positions: hasInstagram ? ["stream", "story", "reels"] : undefined,
    },
    ad: {
      name: `${input.planName} Ad`.slice(0, 255),
      status: "PAUSED",
    },
    creative: {
      format: creative?.format ?? "FEED",
      primaryText: creative?.description ?? "Learn more about our offer.",
      headline: creative?.headline ?? input.planName,
      description: creative?.description ?? undefined,
      link: destination,
      call_to_action_type: objective.metaObjective === "OUTCOME_LEADS" ? "SIGN_UP" : "LEARN_MORE",
    },
    tracking: {
      pixel_id: assets.pixelId,
      dataset_id: assets.datasetId,
      url_tags: "utm_source=meta&utm_medium=paid",
    },
    assets: {
      facebook_page_id: assets.facebookPageId,
      instagram_actor_id: assets.instagramAccountId,
    },
  };
}
