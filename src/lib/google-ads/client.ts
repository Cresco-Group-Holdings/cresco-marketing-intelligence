import { getServerEnv } from "@/lib/environment";
import { normalisePaidAdsHttpError, PaidAdsApiError } from "@/lib/paid-ads/errors";
import type {
  PaidAdsAccount,
  PaidAdsAd,
  PaidAdsAdGroup,
  PaidAdsCampaign,
  PaidAdsConversionRow,
  PaidAdsCreative,
  PaidAdsMetricsRow,
  PaidAdsSpendRow,
} from "@/lib/paid-ads/types";

export const GOOGLE_ADS_API_BASE = "https://googleads.googleapis.com/v18";
export const GOOGLE_ADS_SCOPE = "https://www.googleapis.com/auth/adwords";

export type GoogleAdsHttpClient = {
  get<T>(url: string, accessToken: string, headers?: Record<string, string>): Promise<T>;
  post<T>(url: string, accessToken: string, body: unknown, headers?: Record<string, string>): Promise<T>;
};

export const defaultGoogleAdsHttpClient: GoogleAdsHttpClient = {
  async get<T>(url: string, accessToken: string, headers: Record<string, string> = {}): Promise<T> {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}`, ...headers },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new PaidAdsApiError(normalisePaidAdsHttpError("GOOGLE_ADS", response.status, body));
    return body as T;
  },
  async post<T>(url: string, accessToken: string, body: unknown, headers: Record<string, string> = {}): Promise<T> {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new PaidAdsApiError(normalisePaidAdsHttpError("GOOGLE_ADS", response.status, payload));
    return payload as T;
  },
};

function developerHeaders(): Record<string, string> {
  const token = getServerEnv().GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!token) return {};
  return { "developer-token": token };
}

export class GoogleAdsApiClient {
  constructor(private readonly http: GoogleAdsHttpClient = defaultGoogleAdsHttpClient) {}

  async listAccounts(accessToken: string): Promise<PaidAdsAccount[]> {
    const data = await this.http.get<{ resourceNames?: string[] }>(
      `${GOOGLE_ADS_API_BASE}/customers:listAccessibleCustomers`,
      accessToken,
      developerHeaders(),
    );
    return (data.resourceNames ?? []).map((name) => ({
      accountId: name.replace("customers/", ""),
      name,
    }));
  }

  async validateAccount(accessToken: string, accountId: string): Promise<boolean> {
    try {
      await this.http.get(
        `${GOOGLE_ADS_API_BASE}/customers/${accountId}`,
        accessToken,
        developerHeaders(),
      );
      return true;
    } catch {
      return false;
    }
  }

  async search<T>(accessToken: string, customerId: string, query: string): Promise<T[]> {
    const data = await this.http.post<{ results?: T[] }>(
      `${GOOGLE_ADS_API_BASE}/customers/${customerId}/googleAds:search`,
      accessToken,
      { query },
      developerHeaders(),
    );
    return data.results ?? [];
  }

  async getCampaigns(accessToken: string, accountId: string): Promise<PaidAdsCampaign[]> {
    const rows = await this.search<{
      campaign?: { id?: string; name?: string; status?: string; advertisingChannelType?: string };
    }>(
      accessToken,
      accountId,
      `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type FROM campaign`,
    );
    return rows.map((row) => ({
      campaignId: String(row.campaign?.id ?? ""),
      accountId,
      name: row.campaign?.name ?? "Unknown",
      status: row.campaign?.status,
      campaignType: row.campaign?.advertisingChannelType,
    }));
  }

  async getAdGroups(accessToken: string, accountId: string, campaignId: string): Promise<PaidAdsAdGroup[]> {
    const rows = await this.search<{
      adGroup?: { id?: string; name?: string; status?: string };
    }>(
      accessToken,
      accountId,
      `SELECT ad_group.id, ad_group.name, ad_group.status FROM ad_group WHERE campaign.id = ${campaignId}`,
    );
    return rows.map((row) => ({
      adGroupId: String(row.adGroup?.id ?? ""),
      campaignId,
      name: row.adGroup?.name ?? "Unknown",
      status: row.adGroup?.status,
    }));
  }

  async getAds(accessToken: string, accountId: string, adGroupId: string): Promise<PaidAdsAd[]> {
    const rows = await this.search<{
      adGroupAd?: { ad?: { id?: string; name?: string; type?: string }; status?: string };
    }>(
      accessToken,
      accountId,
      `SELECT ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.ad.type, ad_group_ad.status FROM ad_group_ad WHERE ad_group.id = ${adGroupId}`,
    );
    return rows.map((row) => ({
      adId: String(row.adGroupAd?.ad?.id ?? ""),
      adGroupId,
      name: row.adGroupAd?.ad?.name,
      status: row.adGroupAd?.status,
      adType: row.adGroupAd?.ad?.type,
    }));
  }

  async getCreatives(accessToken: string, accountId: string, adId: string): Promise<PaidAdsCreative[]> {
    const rows = await this.search<{
      adGroupAd?: { ad?: { id?: string; name?: string; type?: string } };
    }>(
      accessToken,
      accountId,
      `SELECT ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.ad.type FROM ad_group_ad WHERE ad_group_ad.ad.id = ${adId}`,
    );
    return rows.map((row) => ({
      creativeId: String(row.adGroupAd?.ad?.id ?? adId),
      adId,
      name: row.adGroupAd?.ad?.name,
      creativeType: row.adGroupAd?.ad?.type,
    }));
  }

  async getMetrics(
    accessToken: string,
    accountId: string,
    startDate: string,
    endDate: string,
  ): Promise<PaidAdsMetricsRow[]> {
    const rows = await this.search<{
      segments?: { date?: string };
      metrics?: Record<string, string | number>;
      campaign?: { id?: string };
      adGroup?: { id?: string };
      adGroupAd?: { ad?: { id?: string } };
    }>(
      accessToken,
      accountId,
      `SELECT segments.date, campaign.id, ad_group.id, ad_group_ad.ad.id, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value, metrics.ctr, metrics.average_cpc FROM ad_group_ad WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'`,
    );

    return rows.map((row) => {
      const metrics: Record<string, number> = {};
      if (row.metrics?.impressions) metrics.impressions = Number(row.metrics.impressions);
      if (row.metrics?.clicks) metrics.clicks = Number(row.metrics.clicks);
      if (row.metrics?.cost_micros) metrics.cost = Number(row.metrics.cost_micros) / 1_000_000;
      if (row.metrics?.conversions) metrics.conversions = Number(row.metrics.conversions);
      if (row.metrics?.conversions_value) metrics.conversion_value = Number(row.metrics.conversions_value);
      if (row.metrics?.ctr) metrics.ctr = Number(row.metrics.ctr);
      if (row.metrics?.average_cpc) metrics.cpc = Number(row.metrics.average_cpc) / 1_000_000;

      return {
        date: row.segments?.date ?? startDate,
        accountId,
        campaignId: row.campaign?.id ? String(row.campaign.id) : undefined,
        adGroupId: row.adGroup?.id ? String(row.adGroup.id) : undefined,
        adId: row.adGroupAd?.ad?.id ? String(row.adGroupAd.ad.id) : undefined,
        metrics,
        attributionWindow: "30d_click_default",
        metadata: { provider: "GOOGLE_ADS" },
      };
    });
  }

  async getConversions(
    accessToken: string,
    accountId: string,
    startDate: string,
    endDate: string,
  ): Promise<PaidAdsConversionRow[]> {
    const rows = await this.search<{
      segments?: { date?: string; conversionAction?: string };
      metrics?: { conversions?: string; conversionsValue?: string };
    }>(
      accessToken,
      accountId,
      `SELECT segments.date, segments.conversion_action, metrics.conversions, metrics.conversions_value FROM campaign WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'`,
    );

    return rows.map((row) => ({
      date: row.segments?.date ?? startDate,
      accountId,
      conversionActionId: row.segments?.conversionAction ?? "unknown",
      conversionActionName: row.segments?.conversionAction ?? "unknown",
      conversions: Number(row.metrics?.conversions ?? 0),
      conversionValue: Number(row.metrics?.conversionsValue ?? 0),
      attributionWindow: "30d_click_default",
    }));
  }

  async getSpend(
    accessToken: string,
    accountId: string,
    startDate: string,
    endDate: string,
  ): Promise<PaidAdsSpendRow[]> {
    const metrics = await this.getMetrics(accessToken, accountId, startDate, endDate);
    return metrics
      .filter((row) => row.metrics.cost !== undefined)
      .map((row) => ({
        date: row.date,
        accountId,
        campaignId: row.campaignId,
        adGroupId: row.adGroupId,
        adId: row.adId,
        amount: row.metrics.cost ?? 0,
        currency: row.currency ?? "USD",
        metadata: row.metadata,
      }));
  }
}

export const googleAdsApiClient = new GoogleAdsApiClient();
