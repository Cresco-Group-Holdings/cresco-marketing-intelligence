import {
  GA4_ADMIN_API_BASE,
  GA4_DATA_API_BASE,
  GA4_MAX_REPORT_ROWS,
  GA4_REPORT_PAGE_SIZE,
} from "@/lib/ga4/constants";
import { AppError } from "@/lib/errors";
import { normaliseGa4HttpError } from "@/lib/ga4/errors";
import type {
  Ga4Account,
  Ga4Property,
  Ga4PropertyMetadata,
  Ga4RealtimeSummary,
  Ga4ReportResult,
  Ga4ReportRow,
} from "@/lib/ga4/types";
import type { Ga4QueryDefinition } from "@/lib/ga4/query-registry";

export type Ga4HttpClient = {
  get<T>(url: string, accessToken: string): Promise<T>;
  post<T>(url: string, accessToken: string, body: unknown): Promise<T>;
};

export const defaultGa4HttpClient: Ga4HttpClient = {
  async get<T>(url: string, accessToken: string): Promise<T> {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw normaliseGa4HttpError(response.status, body);
    }
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
    if (!response.ok) {
      throw normaliseGa4HttpError(response.status, payload);
    }
    return payload as T;
  },
};

function propertyResourceName(propertyId: string): string {
  return propertyId.startsWith("properties/") ? propertyId : `properties/${propertyId}`;
}

function parseReportResponse(data: {
  dimensionHeaders?: Array<{ name?: string }>;
  metricHeaders?: Array<{ name?: string; type?: string }>;
  rows?: Array<{
    dimensionValues?: Array<{ value?: string }>;
    metricValues?: Array<{ value?: string }>;
  }>;
  rowCount?: number;
  propertyQuota?: Record<string, unknown>;
}): Ga4ReportResult {
  const dimensionHeaders = (data.dimensionHeaders ?? []).map((h) => h.name ?? "");
  const metricHeaders = (data.metricHeaders ?? []).map((h) => h.name ?? "");

  const rows: Ga4ReportRow[] = (data.rows ?? []).map((row) => {
    const parsed: Ga4ReportRow = {};
    row.dimensionValues?.forEach((value, index) => {
      const key = dimensionHeaders[index];
      if (key) parsed[key] = value.value ?? null;
    });
    row.metricValues?.forEach((value, index) => {
      const key = metricHeaders[index];
      if (!key) return;
      const numeric = Number(value.value);
      parsed[key] = Number.isFinite(numeric) ? numeric : (value.value ?? null);
    });
    return parsed;
  });

  return {
    rows,
    rowCount: data.rowCount ?? rows.length,
    dimensionHeaders,
    metricHeaders,
    propertyQuota: data.propertyQuota,
  };
}

export class Ga4ApiClient {
  constructor(private readonly http: Ga4HttpClient = defaultGa4HttpClient) {}

  async listAccountSummaries(accessToken: string): Promise<Ga4Account[]> {
    const accounts: Ga4Account[] = [];
    let pageToken: string | undefined;

    do {
      const url = new URL(`${GA4_ADMIN_API_BASE}/accountSummaries`);
      url.searchParams.set("pageSize", "200");
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      const data = await this.http.get<{
        accountSummaries?: Array<{
          account?: string;
          displayName?: string;
          propertySummaries?: Array<{
            property?: string;
            displayName?: string;
            propertyType?: string;
          }>;
        }>;
        nextPageToken?: string;
      }>(url.toString(), accessToken);

      for (const summary of data.accountSummaries ?? []) {
        if (!summary.account) continue;
        accounts.push({
          name: summary.account,
          displayName: summary.displayName ?? summary.account,
        });
      }
      pageToken = data.nextPageToken;
    } while (pageToken);

    return accounts;
  }

  async listProperties(accessToken: string, accountName: string): Promise<Ga4Property[]> {
    const properties: Ga4Property[] = [];
    let pageToken: string | undefined;

    do {
      const url = new URL(`${GA4_ADMIN_API_BASE}/properties`);
      url.searchParams.set("filter", `parent:${accountName}`);
      url.searchParams.set("pageSize", "200");
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      const data = await this.http.get<{
        properties?: Array<{
          name?: string;
          displayName?: string;
          propertyType?: string;
          timeZone?: string;
          currencyCode?: string;
          createTime?: string;
        }>;
        nextPageToken?: string;
      }>(url.toString(), accessToken);

      for (const property of data.properties ?? []) {
        if (!property.name || property.propertyType !== "PROPERTY_TYPE_ORDINARY") continue;
        properties.push({
          name: property.name,
          displayName: property.displayName ?? property.name,
          propertyType: property.propertyType,
          timeZone: property.timeZone,
          currencyCode: property.currencyCode,
          createTime: property.createTime,
          accountName,
        });
      }
      pageToken = data.nextPageToken;
    } while (pageToken);

    return properties;
  }

  async getPropertyMetadata(accessToken: string, propertyId: string): Promise<Ga4PropertyMetadata> {
    const name = propertyResourceName(propertyId);
    const data = await this.http.get<{
      name?: string;
      displayName?: string;
      timeZone?: string;
      currencyCode?: string;
      propertyType?: string;
    }>(`${GA4_ADMIN_API_BASE}/${name}`, accessToken);

    const id = data.name?.replace("properties/", "") ?? propertyId.replace("properties/", "");
    return {
      propertyId: id,
      displayName: data.displayName ?? id,
      timeZone: data.timeZone ?? "UTC",
      currencyCode: data.currencyCode ?? "USD",
      propertyType: data.propertyType ?? "PROPERTY_TYPE_ORDINARY",
    };
  }

  async validateConnection(accessToken: string, propertyId: string): Promise<boolean> {
    try {
      await this.getPropertyMetadata(accessToken, propertyId);
      return true;
    } catch (error) {
      if (error instanceof AppError && error.code === "NOT_FOUND") {
        return false;
      }
      throw error;
    }
  }

  async runReport(
    accessToken: string,
    propertyId: string,
    definition: Ga4QueryDefinition,
    startDate: string,
    endDate: string,
    offset = 0,
    limit = GA4_REPORT_PAGE_SIZE,
  ): Promise<Ga4ReportResult> {
    const name = propertyResourceName(propertyId);
    const data = await this.http.post<{
      dimensionHeaders?: Array<{ name?: string }>;
      metricHeaders?: Array<{ name?: string }>;
      rows?: Array<{
        dimensionValues?: Array<{ value?: string }>;
        metricValues?: Array<{ value?: string }>;
      }>;
      rowCount?: number;
      propertyQuota?: Record<string, unknown>;
    }>(`${GA4_DATA_API_BASE}/${name}:runReport`, accessToken, {
      dimensions: definition.dimensions.map((dim) => ({ name: dim })),
      metrics: definition.metrics.map((metric) => ({ name: metric })),
      dateRanges: [{ startDate, endDate }],
      offset: String(offset),
      limit: String(Math.min(limit, GA4_MAX_REPORT_ROWS)),
      returnPropertyQuota: true,
    });

    return parseReportResponse(data);
  }

  async runRealtimeSummary(accessToken: string, propertyId: string): Promise<Ga4RealtimeSummary> {
    const name = propertyResourceName(propertyId);
    const data = await this.http.post<{
      rows?: Array<{ metricValues?: Array<{ value?: string }> }>;
    }>(`${GA4_DATA_API_BASE}/${name}:runRealtimeReport`, accessToken, {
      metrics: [{ name: "activeUsers" }],
    });

    const activeUsers = Number(data.rows?.[0]?.metricValues?.[0]?.value ?? 0);
    return {
      activeUsers: Number.isFinite(activeUsers) ? activeUsers : 0,
      fetchedAt: new Date().toISOString(),
    };
  }
}

export const ga4ApiClient = new Ga4ApiClient();
