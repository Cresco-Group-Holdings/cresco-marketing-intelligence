import { createHash } from "node:crypto";
import {
  GSC_INSPECTION_API_BASE,
  GSC_MAX_ROW_LIMIT,
  GSC_WEBMASTERS_API_BASE,
} from "@/lib/gsc/constants";
import { normaliseGscHttpError } from "@/lib/gsc/errors";
import type { GscQueryDefinition } from "@/lib/gsc/query-registry";
import type {
  GscSearchAnalyticsResult,
  GscSearchAnalyticsRow,
  GscSite,
  GscSitemap,
  GscUrlInspectionResult,
} from "@/lib/gsc/types";

export type GscHttpClient = {
  get<T>(url: string, accessToken: string): Promise<T>;
  post<T>(url: string, accessToken: string, body: unknown): Promise<T>;
};

export const defaultGscHttpClient: GscHttpClient = {
  async get<T>(url: string, accessToken: string): Promise<T> {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw normaliseGscHttpError(response.status, body);
    return body as T;
  },
  async post<T>(url: string, accessToken: string, body: unknown): Promise<T> {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw normaliseGscHttpError(response.status, payload);
    return payload as T;
  },
};

function encodeSiteUrl(siteUrl: string): string {
  return encodeURIComponent(siteUrl);
}

function parseRows(
  rows: Array<{
    keys?: string[];
    clicks?: number;
    impressions?: number;
    ctr?: number;
    position?: number;
  }> | undefined,
): GscSearchAnalyticsRow[] {
  return (rows ?? []).map((row) => ({
    keys: row.keys ?? [],
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: row.ctr ?? 0,
    position: row.position ?? 0,
  }));
}

export function hashGscValue(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex").slice(0, 32);
}

export class GscApiClient {
  constructor(private readonly http: GscHttpClient = defaultGscHttpClient) {}

  async listSites(accessToken: string): Promise<GscSite[]> {
    const data = await this.http.get<{ siteEntry?: Array<{ siteUrl?: string; permissionLevel?: string }> }>(
      `${GSC_WEBMASTERS_API_BASE}/sites`,
      accessToken,
    );
    return (data.siteEntry ?? [])
      .filter((site) => site.siteUrl)
      .map((site) => ({
        siteUrl: site.siteUrl!,
        permissionLevel: site.permissionLevel ?? "siteUnverifiedUser",
      }));
  }

  async validateSiteAccess(accessToken: string, siteUrl: string): Promise<boolean> {
    try {
      await this.http.get(`${GSC_WEBMASTERS_API_BASE}/sites/${encodeSiteUrl(siteUrl)}`, accessToken);
      return true;
    } catch (error) {
      if (error instanceof Error && "code" in error && (error as { code: string }).code === "NOT_FOUND") {
        return false;
      }
      throw error;
    }
  }

  async querySearchAnalytics(
    accessToken: string,
    siteUrl: string,
    definition: GscQueryDefinition,
    startDate: string,
    endDate: string,
    startRow = 0,
    rowLimit = GSC_MAX_ROW_LIMIT,
  ): Promise<GscSearchAnalyticsResult> {
    const data = await this.http.post<{
      rows?: Array<{
        keys?: string[];
        clicks?: number;
        impressions?: number;
        ctr?: number;
        position?: number;
      }>;
      responseAggregationType?: string;
    }>(
      `${GSC_WEBMASTERS_API_BASE}/sites/${encodeSiteUrl(siteUrl)}/searchAnalytics/query`,
      accessToken,
      {
        startDate,
        endDate,
        dimensions: definition.dimensions,
        rowLimit: Math.min(rowLimit, GSC_MAX_ROW_LIMIT),
        startRow,
        searchType: "web",
      },
    );

    return {
      rows: parseRows(data.rows),
      responseAggregationType: data.responseAggregationType,
    };
  }

  async listSitemaps(accessToken: string, siteUrl: string): Promise<GscSitemap[]> {
    const data = await this.http.get<{
      sitemap?: Array<{
        path?: string;
        lastSubmitted?: string;
        lastDownloaded?: string;
        warnings?: number;
        errors?: number;
        contents?: Array<{ type?: string; submitted?: number }>;
        isPending?: boolean;
      }>;
    }>(`${GSC_WEBMASTERS_API_BASE}/sites/${encodeSiteUrl(siteUrl)}/sitemaps`, accessToken);

    return (data.sitemap ?? []).map((item) => ({
      path: item.path ?? "",
      lastSubmitted: item.lastSubmitted,
      lastDownloaded: item.lastDownloaded,
      warnings: item.warnings,
      errors: item.errors,
      contents: item.contents,
      isPending: item.isPending,
    }));
  }

  async inspectUrl(
    accessToken: string,
    siteUrl: string,
    inspectionUrl: string,
  ): Promise<GscUrlInspectionResult> {
    const data = await this.http.post<{
      inspectionResult?: {
        indexStatusResult?: {
          verdict?: string;
          coverageState?: string;
          robotsTxtState?: string;
          lastCrawlTime?: string;
          pageFetchState?: string;
        };
        mobileUsabilityResult?: { verdict?: string };
        richResultsResult?: { verdict?: string };
      };
    }>(`${GSC_INSPECTION_API_BASE}/urlInspection/index:inspect`, accessToken, {
      inspectionUrl,
      siteUrl,
      languageCode: "en-US",
    });

    const index = data.inspectionResult?.indexStatusResult;
    return {
      inspectionUrl,
      indexedState: index?.verdict ?? index?.coverageState,
      crawlState: index?.pageFetchState,
      canonicalUrl: undefined,
      robotsTxtState: index?.robotsTxtState,
      lastCrawlTime: index?.lastCrawlTime,
      mobileUsability: data.inspectionResult?.mobileUsabilityResult?.verdict,
      richResultsState: data.inspectionResult?.richResultsResult?.verdict,
      raw: data as Record<string, unknown>,
    };
  }
}

export const gscApiClient = new GscApiClient();
