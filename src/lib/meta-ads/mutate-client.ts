import { META_GRAPH_API_BASE } from "@/lib/connectors/oauth/meta";
import { normalisePaidAdsHttpError, PaidAdsApiError } from "@/lib/paid-ads/errors";

export type MetaGraphClient = {
  get<T>(accessToken: string, path: string): Promise<T>;
  post<T>(accessToken: string, path: string, body: Record<string, unknown>): Promise<T>;
};

export const defaultMetaGraphClient: MetaGraphClient = {
  async get<T>(accessToken: string, path: string): Promise<T> {
    const separator = path.includes("?") ? "&" : "?";
    const response = await fetch(`${META_GRAPH_API_BASE}${path}${separator}access_token=${accessToken}`);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new PaidAdsApiError(normalisePaidAdsHttpError("META", response.status, body));
    return body as T;
  },
  async post<T>(accessToken: string, path: string, body: Record<string, unknown>): Promise<T> {
    const params = new URLSearchParams();
    params.set("access_token", accessToken);
    for (const [key, value] of Object.entries(body)) {
      params.set(key, typeof value === "object" ? JSON.stringify(value) : String(value));
    }
    const response = await fetch(`${META_GRAPH_API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new PaidAdsApiError(normalisePaidAdsHttpError("META", response.status, payload));
    return payload as T;
  },
};

export class MetaAdsMutateClient {
  constructor(private readonly http: MetaGraphClient = defaultMetaGraphClient) {}

  async getAdAccount(accessToken: string, adAccountId: string) {
    const id = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
    return this.http.get<{
      account_id?: string;
      name?: string;
      currency?: string;
      timezone_name?: string;
    }>(accessToken, `/${id}?fields=account_id,name,currency,timezone_name`);
  }

  async listBusinesses(accessToken: string) {
    const data = await this.http.get<{ data?: Array<{ id: string; name: string }> }>(
      accessToken,
      "/me/businesses?fields=id,name",
    );
    return data.data ?? [];
  }

  async listPages(accessToken: string) {
    const data = await this.http.get<{ data?: Array<{ id: string; name: string }> }>(
      accessToken,
      "/me/accounts?fields=id,name,instagram_business_account",
    );
    return data.data ?? [];
  }

  async listPixels(accessToken: string, adAccountId: string) {
    const id = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
    const data = await this.http.get<{ data?: Array<{ id: string; name: string }> }>(
      accessToken,
      `/${id}/adspixels?fields=id,name`,
    );
    return data.data ?? [];
  }

  async createCampaign(accessToken: string, adAccountId: string, payload: Record<string, unknown>) {
    const id = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
    return this.http.post<{ id?: string }>(accessToken, `/${id}/campaigns`, payload);
  }

  async createAdSet(accessToken: string, adAccountId: string, payload: Record<string, unknown>) {
    const id = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
    return this.http.post<{ id?: string }>(accessToken, `/${id}/adsets`, payload);
  }

  async createAdCreative(accessToken: string, adAccountId: string, payload: Record<string, unknown>) {
    const id = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
    return this.http.post<{ id?: string }>(accessToken, `/${id}/adcreatives`, payload);
  }

  async createAd(accessToken: string, adAccountId: string, payload: Record<string, unknown>) {
    const id = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
    return this.http.post<{ id?: string }>(accessToken, `/${id}/ads`, payload);
  }

  async updateCampaignStatus(accessToken: string, campaignId: string, status: "PAUSED" | "ACTIVE") {
    return this.http.post<{ success?: boolean }>(accessToken, `/${campaignId}`, { status });
  }

  async sendCapiEvent(accessToken: string, pixelId: string, payload: Record<string, unknown>) {
    return this.http.post<{ events_received?: number }>(accessToken, `/${pixelId}/events`, {
      data: [payload],
    });
  }
}

export const metaAdsMutateClient = new MetaAdsMutateClient();
