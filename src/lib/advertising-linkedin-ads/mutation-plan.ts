import { createHash } from "crypto";
import type { LinkedInAdsDraftPayload } from "./draft-mapper";

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
  draft: LinkedInAdsDraftPayload,
  account: Record<string, unknown>,
): MutationPlanPreview {
  const operations: MutationOperation[] = [];
  const resourcesCreated = ["CAMPAIGN_GROUP", "CAMPAIGN", "CREATIVE"];

  operations.push({
    resourceType: "CAMPAIGN_GROUP",
    operation: "create",
    internalRef: "campaign_group:primary",
    summary: `Create campaign group "${draft.campaignGroup.name}"`,
    payload: { name: draft.campaignGroup.name, status: draft.campaignGroup.status },
  });

  operations.push({
    resourceType: "CAMPAIGN",
    operation: "create",
    internalRef: "campaign:primary",
    summary: `Create campaign "${draft.campaign.name}" (${draft.campaign.objectiveLabel})`,
    payload: {
      name: draft.campaign.name,
      objective: draft.campaign.objective,
      type: draft.campaign.type,
      campaignGroup: "{{campaign_group:primary}}",
      status: draft.campaign.status,
      dailyBudget: { amount: draft.budget.dailyBudgetCents, currencyCode: draft.budget.currency },
      targetingCriteria: draft.targeting,
    },
  });

  operations.push({
    resourceType: "CREATIVE",
    operation: "create",
    internalRef: "creative:primary",
    summary: `Create ${draft.creative.format} creative`,
    payload: {
      campaign: "{{campaign:primary}}",
      intendedStatus: "PAUSED",
      content: {
        headline: draft.creative.headline,
        description: draft.creative.description,
        landingPage: draft.creative.destinationUrl,
        callToAction: draft.creative.callToAction,
      },
    },
  });

  const providerWarnings: string[] = [];
  if (draft.creative.format === "LEAD_FORM") {
    providerWarnings.push("Lead form creative requires pre-configured LinkedIn lead form.");
  }

  const risks: string[] = [];
  if (!draft.tracking.insightTagId) {
    risks.push("No Insight Tag configured — conversion tracking may be limited.");
  }

  return {
    operations,
    resourcesCreated,
    budgetSummary: draft.budget as unknown as Record<string, unknown>,
    accountSnapshot: account,
    targetingSummary: draft.targeting,
    creativeSummary: draft.creative as unknown as Record<string, unknown>,
    trackingSummary: draft.tracking as unknown as Record<string, unknown>,
    optimisationSummary: { objective: draft.campaign.objective },
    destinationSummary: { url: draft.creative.destinationUrl },
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
