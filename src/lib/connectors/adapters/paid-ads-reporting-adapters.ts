import type { ConnectorType } from "@prisma/client";
import { getServerEnv } from "@/lib/environment";
import { GA4_OAUTH_REVOKE_URL, GA4_OAUTH_TOKEN_URL } from "@/lib/ga4/constants";
import { META_OAUTH_TOKEN_URL, META_GRAPH_API_BASE } from "@/lib/connectors/oauth/meta";
import { LINKEDIN_OAUTH_TOKEN_URL, LINKEDIN_API_BASE } from "@/lib/connectors/oauth/linkedin";
import { TIKTOK_OAUTH_TOKEN_URL, TIKTOK_API_BASE } from "@/lib/connectors/oauth/tiktok";
import type { PaidAdsReportingAdapter } from "@/lib/connectors/adapters/paid-ads-reporting-types";
import type {
  ConnectorAdapterContext,
  ConnectorSyncPage,
  ConnectorSyncResult,
  OAuthTokenPair,
} from "@/lib/connectors/types";
import { normalisePaidAdsHttpError, PaidAdsApiError } from "@/lib/paid-ads/errors";
import type {
  PaidAdsAccount,
  PaidAdsAd,
  PaidAdsAdGroup,
  PaidAdsCampaign,
  PaidAdsConversionRow,
  PaidAdsCreative,
  PaidAdsMetricsRow,
  PaidAdsProviderError,
  PaidAdsSpendRow,
  PaidAdsSyncRecord,
} from "@/lib/paid-ads/types";
import { googleAdsApiClient } from "@/lib/google-ads/client";

type SyncCursor = {
  phase: "hierarchy" | "metrics" | "done";
  campaignIndex: number;
  adGroupIndex: number;
  metricsCursor?: string;
  windowStart: string;
  windowEnd: string;
};

async function exchangeGoogleCode(input: {
  code: string;
  redirectUri: string;
  codeVerifier?: string;
}): Promise<OAuthTokenPair> {
  const env = getServerEnv();
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new Error("Google OAuth credentials are not configured.");
  }
  const body: Record<string, string> = {
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    code: input.code,
    grant_type: "authorization_code",
    redirect_uri: input.redirectUri,
  };
  if (input.codeVerifier) body.code_verifier = input.codeVerifier;
  const response = await fetch(GA4_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const data = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
  if (!response.ok || !data.access_token) throw new Error("Google token exchange failed.");
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
    scopes: data.scope?.split(/\s+/).filter(Boolean) ?? [],
  };
}

async function exchangeMetaCode(input: { code: string; redirectUri: string }): Promise<OAuthTokenPair> {
  const env = getServerEnv();
  if (!env.META_APP_ID || !env.META_APP_SECRET) throw new Error("Meta OAuth credentials are not configured.");
  const params = new URLSearchParams({
    client_id: env.META_APP_ID,
    client_secret: env.META_APP_SECRET,
    redirect_uri: input.redirectUri,
    code: input.code,
  });
  const response = await fetch(`${META_OAUTH_TOKEN_URL}?${params.toString()}`);
  const data = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!response.ok || !data.access_token) throw new Error("Meta token exchange failed.");
  return {
    accessToken: data.access_token,
    expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
    scopes: ["ads_read"],
  };
}

async function exchangeLinkedInCode(input: { code: string; redirectUri: string }): Promise<OAuthTokenPair> {
  const env = getServerEnv();
  if (!env.LINKEDIN_CLIENT_ID || !env.LINKEDIN_CLIENT_SECRET) {
    throw new Error("LinkedIn OAuth credentials are not configured.");
  }
  const response = await fetch(LINKEDIN_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: input.redirectUri,
      client_id: env.LINKEDIN_CLIENT_ID,
      client_secret: env.LINKEDIN_CLIENT_SECRET,
    }),
  });
  const data = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
  if (!response.ok || !data.access_token) throw new Error("LinkedIn token exchange failed.");
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
    scopes: data.scope?.split(/\s+/).filter(Boolean) ?? [],
  };
}

async function exchangeTikTokCode(input: { code: string; redirectUri: string }): Promise<OAuthTokenPair> {
  const env = getServerEnv();
  if (!env.TIKTOK_CLIENT_KEY || !env.TIKTOK_CLIENT_SECRET) {
    throw new Error("TikTok OAuth credentials are not configured.");
  }
  const response = await fetch(TIKTOK_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_id: env.TIKTOK_CLIENT_KEY,
      secret: env.TIKTOK_CLIENT_SECRET,
      auth_code: input.code,
    }),
  });
  const data = (await response.json()) as {
    data?: { access_token?: string; refresh_token?: string };
  };
  if (!response.ok || !data.data?.access_token) throw new Error("TikTok token exchange failed.");
  return {
    accessToken: data.data.access_token,
    refreshToken: data.data.refresh_token,
    scopes: ["user.info.basic"],
  };
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function defaultSyncWindow(): { startDate: string; endDate: string } {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);
  return { startDate: formatDate(start), endDate: formatDate(end) };
}

function parseCursor(cursor?: string): SyncCursor {
  if (!cursor) {
    const window = defaultSyncWindow();
    return { phase: "hierarchy", campaignIndex: 0, adGroupIndex: 0, windowStart: window.startDate, windowEnd: window.endDate };
  }
  return JSON.parse(cursor) as SyncCursor;
}

async function metaGet<T>(accessToken: string, path: string): Promise<T> {
  const response = await fetch(`${META_GRAPH_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new PaidAdsApiError(normalisePaidAdsHttpError("META", response.status, body));
  return body as T;
}

async function linkedInGet<T>(accessToken: string, path: string): Promise<T> {
  const response = await fetch(`${LINKEDIN_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "LinkedIn-Version": "202405",
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new PaidAdsApiError(normalisePaidAdsHttpError("LINKEDIN", response.status, body));
  return body as T;
}

async function tikTokGet<T>(accessToken: string, path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${TIKTOK_API_BASE}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const response = await fetch(url.toString(), {
    headers: { "Access-Token": accessToken },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new PaidAdsApiError(normalisePaidAdsHttpError("TIKTOK", response.status, body));
  return body as T;
}

function createPaidAdsAdapter(config: {
  connectorType: ConnectorType;
  provider: PaidAdsSyncRecord["provider"];
  oauth: "google" | "meta" | "linkedin" | "tiktok";
  scopes: string[];
}): PaidAdsReportingAdapter {
  const { connectorType, provider, oauth, scopes } = config;

  return {
    connectorType,
    provider,

    async exchangeCode(input) {
      if (oauth === "google") return exchangeGoogleCode(input);
      if (oauth === "meta") return exchangeMetaCode(input);
      if (oauth === "linkedin") return exchangeLinkedInCode(input);
      return exchangeTikTokCode(input);
    },

    async refreshTokens(refreshToken: string) {
      if (oauth === "google") {
        const env = getServerEnv();
        const response = await fetch(GA4_OAUTH_TOKEN_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: env.GOOGLE_CLIENT_ID!,
            client_secret: env.GOOGLE_CLIENT_SECRET!,
            refresh_token: refreshToken,
            grant_type: "refresh_token",
          }),
        });
        const data = (await response.json()) as { access_token?: string; expires_in?: number };
        if (!response.ok || !data.access_token) throw new Error("Token refresh failed.");
        return {
          accessToken: data.access_token,
          refreshToken,
          expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
          scopes,
        };
      }
      throw new Error(`Token refresh not implemented for ${provider}`);
    },

    async revokeTokens(accessToken: string) {
      if (oauth === "google") {
        await fetch(`${GA4_OAUTH_REVOKE_URL}?token=${encodeURIComponent(accessToken)}`, { method: "POST" });
      }
    },

    normaliseError(error: unknown): PaidAdsProviderError {
      if (error instanceof PaidAdsApiError) {
        return { code: error.code, message: error.message, retryable: error.retryable, provider };
      }
      return { code: "UNKNOWN", message: error instanceof Error ? error.message : "Unknown error", retryable: false, provider };
    },

    async listAccounts(accessToken: string): Promise<PaidAdsAccount[]> {
      if (provider === "GOOGLE_ADS") return googleAdsApiClient.listAccounts(accessToken);
      if (provider === "META") {
        const data = await metaGet<{ data?: Array<{ id: string; name: string; currency?: string; timezone_name?: string }> }>(
          accessToken,
          "/me/adaccounts?fields=id,name,currency,timezone_name",
        );
        return (data.data ?? []).map((a) => ({
          accountId: a.id,
          name: a.name,
          currency: a.currency,
          timezone: a.timezone_name,
        }));
      }
      if (provider === "LINKEDIN") {
        const data = await linkedInGet<{ elements?: Array<{ id: number; name?: string; currency?: string; timezone?: string }> }>(
          accessToken,
          "/adAccounts?q=search",
        );
        return (data.elements ?? []).map((a) => ({
          accountId: String(a.id),
          name: a.name ?? `Account ${a.id}`,
          currency: a.currency,
          timezone: a.timezone,
        }));
      }
      const data = await tikTokGet<{ data?: { list?: Array<{ advertiser_id: string; advertiser_name: string; currency?: string; timezone?: string }> } }>(
        accessToken,
        "/oauth2/advertiser/get/",
      );
      return (data.data?.list ?? []).map((a) => ({
        accountId: a.advertiser_id,
        name: a.advertiser_name,
        currency: a.currency,
        timezone: a.timezone,
      }));
    },

    async validateAccount(accessToken: string, accountId: string) {
      if (provider === "GOOGLE_ADS") return googleAdsApiClient.validateAccount(accessToken, accountId);
      try {
        const accounts = await this.listAccounts(accessToken);
        return accounts.some((a) => a.accountId === accountId);
      } catch {
        return false;
      }
    },

    async getCampaigns(accessToken, accountId) {
      if (provider === "GOOGLE_ADS") return googleAdsApiClient.getCampaigns(accessToken, accountId);
      if (provider === "META") {
        const data = await metaGet<{ data?: Array<{ id: string; name: string; status?: string; objective?: string }> }>(
          accessToken,
          `/act_${accountId.replace("act_", "")}/campaigns?fields=id,name,status,objective`,
        );
        return (data.data ?? []).map((c) => ({
          campaignId: c.id,
          accountId,
          name: c.name,
          status: c.status,
          campaignType: c.objective,
        }));
      }
      if (provider === "LINKEDIN") {
        const data = await linkedInGet<{ elements?: Array<{ id: number; name?: string; status?: string }> }>(
          accessToken,
          `/adCampaigns?q=search&search=(account:(values:List(urn:li:sponsoredAccount:${accountId})))`,
        );
        return (data.elements ?? []).map((c) => ({
          campaignId: String(c.id),
          accountId,
          name: c.name ?? "Campaign",
          status: c.status,
        }));
      }
      const data = await tikTokGet<{ data?: { list?: Array<{ campaign_id: string; campaign_name: string; operation_status?: string }> } }>(
        accessToken,
        "/campaign/get/",
        { advertiser_id: accountId },
      );
      return (data.data?.list ?? []).map((c) => ({
        campaignId: c.campaign_id,
        accountId,
        name: c.campaign_name,
        status: c.operation_status,
      }));
    },

    async getAdGroups(accessToken, accountId, campaignId) {
      if (provider === "GOOGLE_ADS") return googleAdsApiClient.getAdGroups(accessToken, accountId, campaignId);
      if (provider === "META") {
        const data = await metaGet<{ data?: Array<{ id: string; name: string; status?: string }> }>(
          accessToken,
          `/${campaignId}/adsets?fields=id,name,status`,
        );
        return (data.data ?? []).map((g) => ({ adGroupId: g.id, campaignId, name: g.name, status: g.status }));
      }
      if (provider === "LINKEDIN") {
        return [{ adGroupId: `${campaignId}-group`, campaignId, name: "Campaign group", metadata: { linkedinHierarchy: true } }];
      }
      const data = await tikTokGet<{ data?: { list?: Array<{ adgroup_id: string; adgroup_name: string; operation_status?: string }> } }>(
        accessToken,
        "/adgroup/get/",
        { advertiser_id: accountId, campaign_id: campaignId },
      );
      return (data.data?.list ?? []).map((g) => ({
        adGroupId: g.adgroup_id,
        campaignId,
        name: g.adgroup_name,
        status: g.operation_status,
      }));
    },

    async getAds(accessToken, accountId, adGroupId) {
      if (provider === "GOOGLE_ADS") return googleAdsApiClient.getAds(accessToken, accountId, adGroupId);
      if (provider === "META") {
        const data = await metaGet<{ data?: Array<{ id: string; name?: string; status?: string }> }>(
          accessToken,
          `/${adGroupId}/ads?fields=id,name,status`,
        );
        return (data.data ?? []).map((a) => ({ adId: a.id, adGroupId, name: a.name, status: a.status }));
      }
      const data = await tikTokGet<{ data?: { list?: Array<{ ad_id: string; ad_name?: string; operation_status?: string }> } }>(
        accessToken,
        "/ad/get/",
        { advertiser_id: accountId, adgroup_id: adGroupId },
      );
      return (data.data?.list ?? []).map((a) => ({
        adId: a.ad_id,
        adGroupId,
        name: a.ad_name,
        status: a.operation_status,
      }));
    },

    async getCreatives(accessToken, accountId, adId) {
      if (provider === "GOOGLE_ADS") return googleAdsApiClient.getCreatives(accessToken, accountId, adId);
      return [{ creativeId: `${adId}-creative`, adId, metadata: { provider } }];
    },

    async getMetrics(accessToken, accountId, startDate, endDate, cursor) {
      if (provider === "GOOGLE_ADS") {
        const rows = await googleAdsApiClient.getMetrics(accessToken, accountId, startDate, endDate);
        return { rows };
      }
      if (provider === "META") {
        const data = await metaGet<{
          data?: Array<{
            date_start: string;
            impressions?: string;
            clicks?: string;
            spend?: string;
            reach?: string;
            frequency?: string;
            ctr?: string;
            cpc?: string;
            cpm?: string;
            actions?: Array<{ action_type: string; value: string }>;
          }>;
          paging?: { cursors?: { after?: string } };
        }>(
          accessToken,
          `/act_${accountId.replace("act_", "")}/insights?fields=impressions,clicks,spend,reach,frequency,ctr,cpc,cpm,actions&time_range={"since":"${startDate}","until":"${endDate}"}&time_increment=1${cursor ? `&after=${cursor}` : ""}`,
        );
        const rows: PaidAdsMetricsRow[] = (data.data ?? []).map((row) => {
          const metrics: Record<string, number> = {};
          if (row.impressions) metrics.impressions = Number(row.impressions);
          if (row.clicks) metrics.clicks = Number(row.clicks);
          if (row.spend) metrics.cost = Number(row.spend);
          if (row.reach) metrics.reach = Number(row.reach);
          if (row.frequency) metrics.frequency = Number(row.frequency);
          if (row.ctr) metrics.ctr = Number(row.ctr);
          if (row.cpc) metrics.cpc = Number(row.cpc);
          if (row.cpm) metrics.cpm = Number(row.cpm);
          const purchase = row.actions?.find((a) => a.action_type === "purchase");
          if (purchase) metrics.conversions = Number(purchase.value);
          return {
            date: row.date_start,
            accountId,
            metrics,
            attributionWindow: "7d_click_1d_view_default",
            metadata: { provider: "META" },
          };
        });
        return { rows, nextCursor: data.paging?.cursors?.after };
      }
      return { rows: [] };
    },

    async getConversions(accessToken, accountId, startDate, endDate) {
      if (provider === "GOOGLE_ADS") return googleAdsApiClient.getConversions(accessToken, accountId, startDate, endDate);
      return [];
    },

    async getSpend(accessToken, accountId, startDate, endDate, cursor) {
      const { rows: metrics } = await this.getMetrics(accessToken, accountId, startDate, endDate, cursor);
      return {
        rows: metrics
          .filter((r) => r.metrics.cost !== undefined)
          .map((r) => ({
            date: r.date,
            accountId,
            campaignId: r.campaignId,
            adGroupId: r.adGroupId,
            adId: r.adId,
            amount: r.metrics.cost ?? 0,
            currency: r.currency ?? "USD",
          })),
        nextCursor: undefined,
      };
    },

    async fetchPage<T>(input: {
      context: ConnectorAdapterContext;
      accessToken: string;
      cursor?: string;
      pageSize?: number;
    }): Promise<ConnectorSyncPage<T>> {
      const account = await import("@/lib/database/prisma").then((m) =>
        m.prisma.connectorAccount.findUnique({ where: { id: input.context.connectorAccountId } }),
      );
      const accountId = account?.externalAccountId;
      if (!accountId) throw new Error("Ad account has not been selected.");

      const state = parseCursor(input.cursor);
      const records: PaidAdsSyncRecord[] = [];

      if (state.phase === "hierarchy") {
        const campaigns = await this.getCampaigns(input.accessToken, accountId);
        const campaign = campaigns[state.campaignIndex];
        if (!campaign) {
          return {
            items: [{ records, phase: "metrics", windowStart: state.windowStart, windowEnd: state.windowEnd } as T],
            nextCursor: JSON.stringify({ ...state, phase: "metrics" }),
          };
        }

        records.push({ recordType: "campaign", provider, payload: { ...campaign } });
        const adGroups = await this.getAdGroups(input.accessToken, accountId, campaign.campaignId);
        const adGroup = adGroups[state.adGroupIndex];
        if (adGroup) {
          records.push({ recordType: "ad_group", provider, payload: { ...adGroup } });
          const ads = await this.getAds(input.accessToken, accountId, adGroup.adGroupId);
          for (const ad of ads.slice(0, 10)) {
            records.push({ recordType: "ad", provider, payload: { ...ad } });
            const creatives = await this.getCreatives(input.accessToken, accountId, ad.adId);
            for (const creative of creatives) {
              records.push({ recordType: "creative", provider, payload: { ...creative } });
            }
          }
        }

        const nextAdGroupIndex = state.adGroupIndex + 1;
        const nextCampaignIndex = nextAdGroupIndex >= adGroups.length ? state.campaignIndex + 1 : state.campaignIndex;
        const nextCursor =
          nextCampaignIndex >= campaigns.length
            ? JSON.stringify({ ...state, phase: "metrics", campaignIndex: 0, adGroupIndex: 0 })
            : JSON.stringify({
                ...state,
                campaignIndex: nextCampaignIndex,
                adGroupIndex: nextAdGroupIndex >= adGroups.length ? 0 : nextAdGroupIndex,
              });

        return {
          items: [{ records, accountId } as T],
          nextCursor,
        };
      }

      const { rows, nextCursor: metricsCursor } = await this.getMetrics(
        input.accessToken,
        accountId,
        state.windowStart,
        state.windowEnd,
        state.metricsCursor,
      );
      for (const row of rows) {
        records.push({ recordType: "metrics_row", provider, payload: { ...row } });
      }
      const spend = await this.getSpend(input.accessToken, accountId, state.windowStart, state.windowEnd);
      for (const row of spend.rows) {
        records.push({ recordType: "spend_row", provider, payload: { ...row } });
      }

      const nextCursor = metricsCursor
        ? JSON.stringify({ ...state, metricsCursor })
        : JSON.stringify({ ...state, phase: "done" });

      return { items: [{ records, accountId } as T], nextCursor };
    },

    mapPageToSyncResult<T>(page: ConnectorSyncPage<T>): ConnectorSyncResult {
      const items = page.items as Array<{ records: PaidAdsSyncRecord[] }>;
      const count = items.reduce((sum, item) => sum + item.records.length, 0);
      return { recordsProcessed: count, recordsFailed: 0, partialFailure: false, nextCursor: page.nextCursor };
    },
  };
}

export const googleAdsReportingAdapter = createPaidAdsAdapter({
  connectorType: "GOOGLE_ADS",
  provider: "GOOGLE_ADS",
  oauth: "google",
  scopes: ["https://www.googleapis.com/auth/adwords"],
});

export const metaAdsReportingAdapter = createPaidAdsAdapter({
  connectorType: "META",
  provider: "META",
  oauth: "meta",
  scopes: ["ads_read"],
});

export const linkedInAdsReportingAdapter = createPaidAdsAdapter({
  connectorType: "LINKEDIN",
  provider: "LINKEDIN",
  oauth: "linkedin",
  scopes: ["r_ads", "r_organization_social"],
});

export const tikTokAdsReportingAdapter = createPaidAdsAdapter({
  connectorType: "TIKTOK",
  provider: "TIKTOK",
  oauth: "tiktok",
  scopes: ["user.info.basic"],
});

export const paidAdsAdapterByProvider = {
  GOOGLE_ADS: googleAdsReportingAdapter,
  META: metaAdsReportingAdapter,
  LINKEDIN: linkedInAdsReportingAdapter,
  TIKTOK: tikTokAdsReportingAdapter,
} as const;

export function getPaidAdsAdapter(provider: keyof typeof paidAdsAdapterByProvider): PaidAdsReportingAdapter {
  return paidAdsAdapterByProvider[provider];
}
