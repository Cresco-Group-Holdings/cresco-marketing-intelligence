import { translatePlanObjective } from "./objective-mapper";
import { validateTargetingPolicy, type ApprovedTargetingInput } from "./targeting-policy";
import { isCapabilityAvailable, LINKEDIN_ADS_CAPABILITIES } from "@/lib/advertising-providers/capability-gates";

export type PlanDraftInput = {
  planId: string;
  planName: string;
  internalCampaignId: string;
  primaryObjective?: string | null;
  reportingCurrency: string;
  channels: Array<{ channelType: string }>;
  budgets: Array<{ budgetType: string; currency: string; amount: number }>;
  destinations: Array<{ destinationUrl?: string | null }>;
  creatives?: Array<{ format: string; headline?: string | null; description?: string | null }>;
  targeting?: ApprovedTargetingInput;
};

export type LinkedInAdsDraftPayload = {
  campaignGroup: { name: string; status: "PAUSED" };
  campaign: {
    name: string;
    objective: string;
    objectiveLabel: string;
    status: "PAUSED";
    type: "SPONSORED_CONTENT";
  };
  creative: {
    format: string;
    headline: string;
    description?: string;
    destinationUrl: string;
    callToAction: string;
  };
  targeting: Record<string, unknown>;
  budget: { dailyBudgetCents: number; currency: string };
  schedule: { startDate?: string; endDate?: string };
  tracking: { insightTagId?: string };
};

function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function mapPlanToLinkedInAdsDraft(input: PlanDraftInput): LinkedInAdsDraftPayload {
  const hasLinkedIn = input.channels.some((c) => c.channelType === "LINKEDIN");
  if (!hasLinkedIn) throw new Error("Plan must include LINKEDIN channel.");

  const objective = translatePlanObjective(input.primaryObjective);
  if (!objective.supported) {
    throw new Error(`LinkedIn objective not supported: ${input.primaryObjective}`);
  }

  const targetingResult = validateTargetingPolicy(input.targeting ?? { countries: ["US"] });
  if (!targetingResult.allowed) {
    throw new Error(targetingResult.violations.join(" "));
  }

  const dailyBudget = input.budgets.find((b) => b.budgetType === "DAILY") ?? input.budgets[0];
  const destination = input.destinations[0]?.destinationUrl ?? "https://example.com";
  const creative = input.creatives?.[0];

  const format =
    creative?.format === "VIDEO" ? "VIDEO"
    : objective.linkedInObjective === "LEAD_GENERATION" ? "LEAD_FORM"
    : "SINGLE_IMAGE";

  if (format === "LEAD_FORM" && !isCapabilityAvailable(LINKEDIN_ADS_CAPABILITIES, "lead_gen_ads")) {
    throw new Error("Lead-generation ads capability is not available.");
  }

  return {
    campaignGroup: {
      name: `${input.internalCampaignId}_group`.slice(0, 255),
      status: "PAUSED",
    },
    campaign: {
      name: `${input.internalCampaignId}_${input.planName}`.slice(0, 255),
      objective: objective.linkedInObjective,
      objectiveLabel: objective.label,
      status: "PAUSED",
      type: "SPONSORED_CONTENT",
    },
    creative: {
      format,
      headline: creative?.headline ?? input.planName,
      description: creative?.description ?? undefined,
      destinationUrl: destination,
      callToAction: objective.linkedInObjective === "LEAD_GENERATION" ? "SIGN_UP" : "LEARN_MORE",
    },
    targeting: targetingResult.normalised,
    budget: {
      dailyBudgetCents: dailyBudget ? toCents(dailyBudget.amount) : toCents(50),
      currency: dailyBudget?.currency ?? input.reportingCurrency,
    },
    schedule: {},
    tracking: {},
  };
}
