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
  creatives?: Array<{ format: string; headline?: string | null; description?: string | null }>;
  targeting?: ApprovedTargetingInput;
  placements?: Array<{ platforms?: string[] }>;
};

export type TikTokAdsDraftPayload = {
  campaign: {
    name: string;
    objective: string;
    objectiveLabel: string;
    status: "DISABLE";
    budgetMode: "BUDGET_MODE_DAY";
  };
  adGroup: {
    name: string;
    placementType: "PLACEMENT_TYPE_AUTOMATIC" | "PLACEMENT_TYPE_NORMAL";
    budget: number;
    scheduleType: "SCHEDULE_FROM_NOW";
    targeting: Record<string, unknown>;
    optimizationGoal: string;
  };
  ad: {
    name: string;
    adText: string;
    landingPageUrl: string;
    callToAction: string;
  };
  creative: { format: string; videoUrl?: string };
  tracking: { pixelId?: string };
};

function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function mapPlanToTikTokAdsDraft(
  input: PlanDraftInput,
  assets: { pixelId?: string },
): TikTokAdsDraftPayload {
  const hasTikTok = input.channels.some((c) => c.channelType === "TIKTOK");
  if (!hasTikTok) throw new Error("Plan must include TIKTOK channel.");

  const objective = translatePlanObjective(input.primaryObjective);
  if (!objective.supported) {
    throw new Error(`TikTok objective not supported: ${input.primaryObjective}`);
  }

  const targetingResult = validateTargetingPolicy(input.targeting ?? { countries: ["US"], ageMin: 18, ageMax: 65 });
  if (!targetingResult.allowed) {
    throw new Error(targetingResult.violations.join(" "));
  }

  const dailyBudget = input.budgets.find((b) => b.budgetType === "DAILY") ?? input.budgets[0];
  const destination = input.destinations[0]?.destinationUrl ?? "https://example.com";
  const creative = input.creatives?.[0];
  const manualPlacements = input.placements?.some((p) => p.platforms?.length);

  return {
    campaign: {
      name: `${input.internalCampaignId}_${input.planName}`.slice(0, 512),
      objective: objective.tiktokObjective,
      objectiveLabel: objective.label,
      status: "DISABLE",
      budgetMode: "BUDGET_MODE_DAY",
    },
    adGroup: {
      name: `${input.planName} Ad Group`.slice(0, 512),
      placementType: manualPlacements ? "PLACEMENT_TYPE_NORMAL" : "PLACEMENT_TYPE_AUTOMATIC",
      budget: dailyBudget ? toCents(dailyBudget.amount) : toCents(50),
      scheduleType: "SCHEDULE_FROM_NOW",
      targeting: targetingResult.normalised,
      optimizationGoal: objective.tiktokObjective === "WEB_CONVERSIONS" ? "CONVERT" : "CLICK",
    },
    ad: {
      name: `${input.planName} Ad`.slice(0, 512),
      adText: creative?.description ?? creative?.headline ?? "Learn more",
      landingPageUrl: destination,
      callToAction: objective.tiktokObjective === "LEAD_GENERATION" ? "SIGN_UP" : "LEARN_MORE",
    },
    creative: { format: "SHORT_VIDEO" },
    tracking: { pixelId: assets.pixelId },
  };
}
