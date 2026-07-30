import { createHash } from "crypto";
import type { TikTokAdsDraftPayload } from "./draft-mapper";

export type MutationOperation = {
  resourceType: string;
  operation: "create" | "update";
  internalRef: string;
  summary: string;
  payload: Record<string, unknown>;
};

export type MutationPlanPreview = {
  operations: MutationOperation[];
  resourcesCreated: string[];
  budgetSummary: Record<string, unknown>;
  accountSnapshot: Record<string, unknown>;
  targetingSummary: Record<string, unknown>;
  creativeSummary: Record<string, unknown>;
  trackingSummary: Record<string, unknown>;
  optimisationSummary: Record<string, unknown>;
  destinationSummary: Record<string, unknown>;
  providerWarnings: string[];
  risks: string[];
};

export function buildMutationOperations(
  draft: TikTokAdsDraftPayload,
  account: Record<string, unknown>,
): MutationPlanPreview {
  const operations: MutationOperation[] = [];
  const resourcesCreated = ["CAMPAIGN", "AD_GROUP", "AD"];

  operations.push({
    resourceType: "CAMPAIGN",
    operation: "create",
    internalRef: "campaign:primary",
    summary: `Create campaign "${draft.campaign.name}" (${draft.campaign.objectiveLabel})`,
    payload: {
      campaign_name: draft.campaign.name,
      objective_type: draft.campaign.objective,
      budget_mode: draft.campaign.budgetMode,
      operation_status: draft.campaign.status,
    },
  });

  operations.push({
    resourceType: "AD_GROUP",
    operation: "create",
    internalRef: "ad_group:primary",
    summary: `Create ad group with budget ${draft.adGroup.budget} cents`,
    payload: {
      campaign_id: "{{campaign:primary}}",
      adgroup_name: draft.adGroup.name,
      placement_type: draft.adGroup.placementType,
      budget: draft.adGroup.budget,
      schedule_type: draft.adGroup.scheduleType,
      targeting: draft.adGroup.targeting,
      optimization_goal: draft.adGroup.optimizationGoal,
    },
  });

  operations.push({
    resourceType: "AD",
    operation: "create",
    internalRef: "ad:primary",
    summary: "Create short-video ad",
    payload: {
      adgroup_id: "{{ad_group:primary}}",
      ad_name: draft.ad.name,
      ad_text: draft.ad.adText,
      landing_page_url: draft.ad.landingPageUrl,
      call_to_action: draft.ad.callToAction,
    },
  });

  const providerWarnings: string[] = [];
  if (draft.adGroup.placementType === "PLACEMENT_TYPE_AUTOMATIC") {
    providerWarnings.push("Automatic placements may expand beyond selected inventory.");
  }

  const risks: string[] = [];
  if (!draft.tracking.pixelId) {
    risks.push("No pixel configured — conversion tracking may be limited.");
  }

  return {
    operations,
    resourcesCreated,
    budgetSummary: { dailyBudgetCents: draft.adGroup.budget, budgetMode: draft.campaign.budgetMode },
    accountSnapshot: account,
    targetingSummary: draft.adGroup.targeting,
    creativeSummary: draft.creative as unknown as Record<string, unknown>,
    trackingSummary: draft.tracking as unknown as Record<string, unknown>,
    optimisationSummary: { goal: draft.adGroup.optimizationGoal },
    destinationSummary: { url: draft.ad.landingPageUrl },
    providerWarnings,
    risks,
  };
}

export function hashMutationPlan(operations: MutationOperation[]): string {
  const canonical = JSON.stringify(
    operations.map((op) => ({
      resourceType: op.resourceType,
      operation: op.operation,
      internalRef: op.internalRef,
      payload: op.payload,
    })),
  );
  return createHash("sha256").update(canonical).digest("hex");
}

export function planHashMatches(storedHash: string, operations: MutationOperation[]): boolean {
  return storedHash === hashMutationPlan(operations);
}

export function materialChangeInvalidatesApproval(changedFields: string[]): boolean {
  const material = ["budget", "audience", "destination", "creative", "schedule", "objective"];
  return changedFields.some((f) => material.includes(f));
}
