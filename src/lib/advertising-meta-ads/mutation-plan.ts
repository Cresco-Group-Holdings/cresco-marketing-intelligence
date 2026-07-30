import { createHash } from "crypto";
import type { MetaAdsDraftPayload } from "./draft-mapper";

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
  risks: string[];
};

export function buildMutationOperations(
  draft: MetaAdsDraftPayload,
  account: Record<string, unknown>,
): MutationPlanPreview {
  const operations: MutationOperation[] = [];
  const resourcesCreated = ["CAMPAIGN", "AD_SET", "AD", "AD_CREATIVE"];

  operations.push({
    resourceType: "CAMPAIGN",
    operation: "create",
    internalRef: "campaign:primary",
    summary: `Create campaign "${draft.campaign.name}" (${draft.campaign.objectiveLabel})`,
    payload: {
      name: draft.campaign.name,
      objective: draft.campaign.objective,
      status: draft.campaign.status,
      special_ad_categories: draft.campaign.special_ad_categories,
    },
  });

  operations.push({
    resourceType: "AD_SET",
    operation: "create",
    internalRef: "ad_set:primary",
    summary: `Create ad set with daily budget ${draft.adSet.daily_budget} cents`,
    payload: {
      name: draft.adSet.name,
      campaign_id: "{{campaign:primary}}",
      daily_budget: draft.adSet.daily_budget,
      billing_event: draft.adSet.billing_event,
      optimization_goal: draft.adSet.optimization_goal,
      targeting: draft.adSet.targeting,
      publisher_platforms: draft.adSet.publisher_platforms,
      status: "PAUSED",
    },
  });

  operations.push({
    resourceType: "AD_CREATIVE",
    operation: "create",
    internalRef: "creative:primary",
    summary: `Create ${draft.creative.format} creative`,
    payload: {
      name: `${draft.ad.name} Creative`,
      object_story_spec: {
        page_id: draft.assets.facebook_page_id,
        link_data: {
          message: draft.creative.primaryText,
          name: draft.creative.headline,
          link: draft.creative.link,
          call_to_action: { type: draft.creative.call_to_action_type },
        },
      },
    },
  });

  operations.push({
    resourceType: "AD",
    operation: "create",
    internalRef: "ad:primary",
    summary: "Create ad linked to creative",
    payload: {
      name: draft.ad.name,
      adset_id: "{{ad_set:primary}}",
      creative: { creative_id: "{{creative:primary}}" },
      status: draft.ad.status,
    },
  });

  const risks: string[] = [];
  if (!draft.tracking.pixel_id && !draft.tracking.dataset_id) {
    risks.push("No pixel or dataset configured — conversion tracking may be limited.");
  }
  if (!draft.assets.instagram_actor_id && draft.adSet.publisher_platforms.includes("instagram")) {
    risks.push("Instagram placement without linked Instagram account.");
  }

  return {
    operations,
    resourcesCreated,
    budgetSummary: {
      dailyBudgetCents: draft.adSet.daily_budget,
      billingEvent: draft.adSet.billing_event,
      optimizationGoal: draft.adSet.optimization_goal,
    },
    accountSnapshot: account,
    targetingSummary: draft.adSet.targeting as Record<string, unknown>,
    creativeSummary: draft.creative as unknown as Record<string, unknown>,
    trackingSummary: draft.tracking as unknown as Record<string, unknown>,
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
