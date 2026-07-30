import { TIKTOK_API_BASE } from "@/lib/connectors/oauth/tiktok";
import { normalisePaidAdsHttpError, PaidAdsApiError } from "@/lib/paid-ads/errors";
import type {
  AdvertisingProviderAdapter,
  NormalisedProviderError,
  ProviderAssetSummary,
  ProviderDraftPayload,
  ProviderMutationPlanPreview,
  ProviderOperationStatus,
  ProviderValidationResult,
} from "@/lib/advertising-providers/adapter-contract";
import { requireCapability, TIKTOK_ADS_CAPABILITIES } from "@/lib/advertising-providers/capability-gates";
import { mapPlanToTikTokAdsDraft, type PlanDraftInput } from "./draft-mapper";
import { buildMutationOperations } from "./mutation-plan";
import { validateTikTokAdsDraft } from "./validation";
import { classifyTikTokLaunchError } from "./error-recovery";

async function tikTokFetch<T>(accessToken: string, path: string, body?: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${TIKTOK_API_BASE}${path}`, {
    method: "POST",
    headers: { "Access-Token": accessToken, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || (payload as { code?: number }).code !== 0) {
    throw new PaidAdsApiError(normalisePaidAdsHttpError("TIKTOK", response.status, payload));
  }
  return payload as T;
}

export const tikTokAdsAdapter: AdvertisingProviderAdapter = {
  provider: "TIKTOK",

  async listAccounts(accessToken) {
    requireCapability(TIKTOK_ADS_CAPABILITIES, "account_access");
    const data = await tikTokFetch<{ data?: { list?: Array<{ advertiser_id: string; advertiser_name?: string; currency?: string; timezone?: string }> } }>(
      accessToken,
      "/oauth2/advertiser/get/",
      {},
    );
    return (data.data?.list ?? []).map((a) => ({
      accountId: a.advertiser_id,
      accountName: a.advertiser_name,
      currency: a.currency,
      timezone: a.timezone,
    }));
  },

  async validateAccount(accessToken, accountId) {
    const data = await tikTokFetch<{ data?: { advertiser_id?: string; name?: string; currency?: string; timezone?: string } }>(
      accessToken,
      "/advertiser/info/",
      { advertiser_ids: [accountId] },
    );
    const info = data.data;
    return {
      accountId: info?.advertiser_id ?? accountId,
      accountName: info?.name,
      currency: info?.currency,
      timezone: info?.timezone,
    };
  },

  async listAssets(accessToken, accountId) {
    const assets: ProviderAssetSummary[] = [];
    const pixels = await tikTokFetch<{ data?: { pixels?: Array<{ pixel_id: string; pixel_name?: string }> } }>(
      accessToken,
      "/pixel/list/",
      { advertiser_id: accountId },
    ).catch(() => ({ data: { pixels: [] } }));
    for (const pixel of pixels.data?.pixels ?? []) {
      assets.push({ assetType: "PIXEL", assetId: pixel.pixel_id, name: pixel.pixel_name });
    }
    return assets;
  },

  buildDraft(planInput, account) {
    return mapPlanToTikTokAdsDraft(planInput as PlanDraftInput, {
      pixelId: (account as { pixelId?: string }).pixelId,
    }) as ProviderDraftPayload;
  },

  validateDraft(draft) {
    return validateTikTokAdsDraft(draft as ReturnType<typeof mapPlanToTikTokAdsDraft>) as ProviderValidationResult;
  },

  createMutationPlan(draft, account) {
    return buildMutationOperations(
      draft as ReturnType<typeof mapPlanToTikTokAdsDraft>,
      account,
    ) as ProviderMutationPlanPreview;
  },

  async executeApprovedPlan(accessToken, accountId, operations) {
    requireCapability(TIKTOK_ADS_CAPABILITIES, "campaign_create");
    const resourceMap = new Map<string, string>();
    const providerResponse: Record<string, unknown> = {};

    for (const op of operations) {
      if (op.resourceType === "CAMPAIGN") {
        const res = await tikTokFetch<{ data?: { campaign_id?: string } }>(
          accessToken,
          "/campaign/create/",
          { advertiser_id: accountId, ...op.payload },
        );
        if (res.data?.campaign_id) resourceMap.set(op.internalRef, res.data.campaign_id);
        providerResponse.campaign = res.data;
      }
      if (op.resourceType === "AD_GROUP") {
        const payload: Record<string, unknown> = { ...op.payload, advertiser_id: accountId };
        if (typeof payload.campaign_id === "string" && payload.campaign_id.startsWith("{{")) {
          payload.campaign_id = resourceMap.get("campaign:primary");
        }
        const res = await tikTokFetch<{ data?: { adgroup_id?: string } }>(
          accessToken,
          "/adgroup/create/",
          payload,
        );
        if (res.data?.adgroup_id) resourceMap.set(op.internalRef, res.data.adgroup_id);
        providerResponse.adGroup = res.data;
      }
    }

    return { resourceMap, providerResponse };
  },

  async getOperationStatus(_accessToken, _accountId, operationRef) {
    return { operationId: operationRef, status: "UNKNOWN" } as ProviderOperationStatus;
  },

  async pauseCampaign(accessToken, accountId, campaignId) {
    return tikTokFetch(accessToken, "/campaign/status/update/", {
      advertiser_id: accountId,
      campaign_ids: [campaignId],
      operation_status: "DISABLE",
    });
  },

  async resumeCampaign(accessToken, accountId, campaignId) {
    return tikTokFetch(accessToken, "/campaign/status/update/", {
      advertiser_id: accountId,
      campaign_ids: [campaignId],
      operation_status: "ENABLE",
    });
  },

  async syncCampaign(accessToken, accountId, campaignId) {
    return tikTokFetch(accessToken, "/campaign/get/", {
      advertiser_id: accountId,
      filtering: { campaign_ids: [campaignId] },
    });
  },

  normaliseError(error: unknown): NormalisedProviderError {
    return classifyTikTokLaunchError(error);
  },
};
