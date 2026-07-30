import { createHash } from "crypto";
import type { GoogleAdsDraftPayload } from "./draft-mapper";

export type MutationOperation = {
  resourceType: string;
  operation: "create" | "update" | "remove";
  internalRef: string;
  summary: string;
  payload: Record<string, unknown>;
};

export type MutationPlanPreview = {
  operations: MutationOperation[];
  resourcesCreated: string[];
  resourcesChanged: string[];
  budgetSummary: {
    dailyAmountMicros: number;
    currency: string;
    deliveryMethod: string;
  };
  accountSnapshot: {
    customerId: string;
    managerCustomerId?: string | null;
    currency?: string | null;
    timezone?: string | null;
    accessLevel?: string | null;
  };
  destinationSummary: {
    finalUrls: string[];
    locations: string[];
    languages: string[];
  };
  risks: string[];
};

export function buildMutationOperations(
  draft: GoogleAdsDraftPayload,
  account: MutationPlanPreview["accountSnapshot"],
): MutationPlanPreview {
  const operations: MutationOperation[] = [];
  const resourcesCreated: string[] = [];

  operations.push({
    resourceType: "CAMPAIGN_BUDGET",
    operation: "create",
    internalRef: "budget:primary",
    summary: `Create daily budget ${draft.budget.amountMicros} micros (${draft.budget.currency})`,
    payload: {
      name: draft.budget.name,
      amountMicros: draft.budget.amountMicros,
      deliveryMethod: draft.budget.deliveryMethod,
      explicitlyShared: false,
    },
  });
  resourcesCreated.push("CAMPAIGN_BUDGET");

  operations.push({
    resourceType: "CAMPAIGN",
    operation: "create",
    internalRef: "campaign:primary",
    summary: `Create Search campaign "${draft.campaign.name}" (paused)`,
    payload: {
      name: draft.campaign.name,
      advertisingChannelType: draft.campaign.advertisingChannelType,
      status: draft.campaign.status,
      manualCpc: draft.campaign.biddingStrategy === "MANUAL_CPC" ? {} : undefined,
      networkSettings: draft.campaign.networkSettings,
      campaignBudget: "{{budget:primary}}",
      startDate: draft.campaign.startDate,
      endDate: draft.campaign.endDate,
    },
  });
  resourcesCreated.push("CAMPAIGN");

  draft.adGroups.forEach((group, groupIndex) => {
    const groupRef = `ad_group:${groupIndex}`;
    operations.push({
      resourceType: "AD_GROUP",
      operation: "create",
      internalRef: groupRef,
      summary: `Create ad group "${group.name}"`,
      payload: {
        name: group.name,
        status: group.status,
        campaign: "{{campaign:primary}}",
        cpcBidMicros: group.cpcBidMicros,
      },
    });
    resourcesCreated.push("AD_GROUP");

    group.ads.forEach((ad, adIndex) => {
      const adRef = `ad:${groupIndex}:${adIndex}`;
      operations.push({
        resourceType: "AD",
        operation: "create",
        internalRef: adRef,
        summary: `Create responsive search ad with ${ad.headlines.length} headlines`,
        payload: {
          adGroup: `{{${groupRef}}}`,
          ad: {
            responsiveSearchAd: {
              headlines: ad.headlines.map((text) => ({ text })),
              descriptions: ad.descriptions.map((text) => ({ text })),
              path1: ad.path1,
              path2: ad.path2,
            },
            finalUrls: ad.finalUrls,
          },
        },
      });
      resourcesCreated.push("AD");
    });

    group.keywords.forEach((keyword, kwIndex) => {
      operations.push({
        resourceType: "KEYWORD",
        operation: "create",
        internalRef: `keyword:${groupIndex}:${kwIndex}`,
        summary: `Add keyword "${keyword.text}" (${keyword.matchType})`,
        payload: {
          adGroup: `{{${groupRef}}}`,
          keyword: { text: keyword.text, matchType: keyword.matchType },
        },
      });
      resourcesCreated.push("KEYWORD");
    });

    group.negativeKeywords.forEach((text, nkIndex) => {
      operations.push({
        resourceType: "NEGATIVE_KEYWORD",
        operation: "create",
        internalRef: `negative_keyword:${groupIndex}:${nkIndex}`,
        summary: `Add negative keyword "${text}"`,
        payload: {
          campaign: "{{campaign:primary}}",
          keyword: { text, matchType: "BROAD" },
        },
      });
      resourcesCreated.push("NEGATIVE_KEYWORD");
    });
  });

  const risks: string[] = [];
  if (!account.currency || account.currency !== draft.budget.currency) {
    risks.push("Account currency may not match plan reporting currency.");
  }
  if (draft.conversions.some((c) => !c.trackingVerified)) {
    risks.push("Primary conversion tracking is not verified.");
  }
  if (account.accessLevel === "READ_ONLY") {
    risks.push("Account access level appears read-only.");
  }

  const finalUrls = draft.adGroups.flatMap((g) => g.ads.flatMap((a) => a.finalUrls));

  return {
    operations,
    resourcesCreated: [...new Set(resourcesCreated)],
    resourcesChanged: [],
    budgetSummary: {
      dailyAmountMicros: draft.budget.amountMicros,
      currency: draft.budget.currency,
      deliveryMethod: draft.budget.deliveryMethod,
    },
    accountSnapshot: account,
    destinationSummary: {
      finalUrls,
      locations: draft.locations,
      languages: draft.languages,
    },
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
