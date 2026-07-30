import { LINKEDIN_API_BASE } from "@/lib/connectors/oauth/linkedin";
import { normalisePaidAdsHttpError, PaidAdsApiError } from "@/lib/paid-ads/errors";
import type {
  AdvertisingProviderAdapter,
  NormalisedProviderError,
  ProviderAccountSummary,
  ProviderAssetSummary,
  ProviderDraftPayload,
  ProviderMutationOperation,
  ProviderMutationPlanPreview,
  ProviderOperationStatus,
  ProviderValidationResult,
} from "@/lib/advertising-providers/adapter-contract";
import { requireCapability, LINKEDIN_ADS_CAPABILITIES } from "@/lib/advertising-providers/capability-gates";
import { mapPlanToLinkedInAdsDraft, type PlanDraftInput } from "./draft-mapper";
import { buildMutationOperations } from "./mutation-plan";
import { validateLinkedInAdsDraft } from "./validation";
import { classifyLinkedInLaunchError } from "./error-recovery";

async function linkedInFetch<T>(accessToken: string, path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${LINKEDIN_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "LinkedIn-Version": "202405",
      "X-Restli-Protocol-Version": "2.0.0",
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new PaidAdsApiError(normalisePaidAdsHttpError("LINKEDIN", response.status, body));
  return body as T;
}

export const linkedInAdsAdapter: AdvertisingProviderAdapter = {
  provider: "LINKEDIN",

  async listAccounts(accessToken) {
    requireCapability(LINKEDIN_ADS_CAPABILITIES, "account_access");
    const data = await linkedInFetch<{ elements?: Array<{ id: number; name: string; currency?: string; timezone?: string }> }>(
      accessToken,
      "/adAccounts?q=search&search=(status:(values:List(ACTIVE)))",
    );
    return (data.elements ?? []).map((a) => ({
      accountId: String(a.id),
      accountName: a.name,
      currency: a.currency,
      timezone: a.timezone,
    }));
  },

  async validateAccount(accessToken, accountId) {
    const data = await linkedInFetch<{ id?: number; name?: string; currency?: string; timezone?: string }>(
      accessToken,
      `/adAccounts/${accountId}`,
    );
    return {
      accountId: String(data.id ?? accountId),
      accountName: data.name,
      currency: data.currency,
      timezone: data.timezone,
    };
  },

  async listAssets(accessToken, accountId) {
    const assets: ProviderAssetSummary[] = [];
    const orgs = await linkedInFetch<{ elements?: Array<{ organization: string }> }>(
      accessToken,
      `/adAccounts/${accountId}/adDirectSponsoredContents`,
    ).catch(() => ({ elements: [] }));
    for (const org of orgs.elements ?? []) {
      assets.push({ assetType: "ORGANIZATION", assetId: org.organization });
    }
    return assets;
  },

  buildDraft(planInput, _account) {
    return mapPlanToLinkedInAdsDraft(planInput as PlanDraftInput) as ProviderDraftPayload;
  },

  validateDraft(draft) {
    const result = validateLinkedInAdsDraft(draft as ReturnType<typeof mapPlanToLinkedInAdsDraft>);
    return result as ProviderValidationResult;
  },

  createMutationPlan(draft, account) {
    return buildMutationOperations(
      draft as ReturnType<typeof mapPlanToLinkedInAdsDraft>,
      account,
    ) as ProviderMutationPlanPreview;
  },

  async executeApprovedPlan(accessToken, accountId, operations) {
    requireCapability(LINKEDIN_ADS_CAPABILITIES, "campaign_create");
    const resourceMap = new Map<string, string>();
    const providerResponse: Record<string, unknown> = {};

    for (const op of operations) {
      if (op.resourceType === "CAMPAIGN_GROUP") {
        const res = await linkedInFetch<{ id?: string }>(accessToken, `/adAccounts/${accountId}/adCampaignGroups`, {
          method: "POST",
          body: JSON.stringify(op.payload),
        });
        if (res.id) resourceMap.set(op.internalRef, res.id);
        providerResponse.campaignGroup = res;
      }
      if (op.resourceType === "CAMPAIGN") {
        const payload = { ...op.payload };
        if (typeof payload.campaignGroup === "string" && payload.campaignGroup.startsWith("{{")) {
          payload.campaignGroup = resourceMap.get("campaign_group:primary");
        }
        const res = await linkedInFetch<{ id?: string }>(accessToken, `/adAccounts/${accountId}/adCampaigns`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        if (res.id) resourceMap.set(op.internalRef, res.id);
        providerResponse.campaign = res;
      }
    }

    return { resourceMap, providerResponse };
  },

  async getOperationStatus(_accessToken, _accountId, operationRef) {
    return { operationId: operationRef, status: "UNKNOWN" } as ProviderOperationStatus;
  },

  async pauseCampaign(accessToken, accountId, campaignId) {
    return linkedInFetch(accessToken, `/adAccounts/${accountId}/adCampaigns/${campaignId}`, {
      method: "POST",
      body: JSON.stringify({ patch: { $set: { status: "PAUSED" } } }),
    });
  },

  async resumeCampaign(accessToken, accountId, campaignId) {
    return linkedInFetch(accessToken, `/adAccounts/${accountId}/adCampaigns/${campaignId}`, {
      method: "POST",
      body: JSON.stringify({ patch: { $set: { status: "ACTIVE" } } }),
    });
  },

  async syncCampaign(accessToken, accountId, campaignId) {
    return linkedInFetch(accessToken, `/adAccounts/${accountId}/adCampaigns/${campaignId}`);
  },

  normaliseError(error: unknown): NormalisedProviderError {
    return classifyLinkedInLaunchError(error);
  },
};
