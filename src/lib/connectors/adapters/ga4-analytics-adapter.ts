import type { ConnectorType } from "@prisma/client";
import { getServerEnv } from "@/lib/environment";
import { ga4ApiClient } from "@/lib/ga4/client";
import { GA4_OAUTH_REVOKE_URL, GA4_OAUTH_TOKEN_URL } from "@/lib/ga4/constants";
import { GA4_QUERY_DEFINITIONS } from "@/lib/ga4/query-registry";
import type { Ga4Property, Ga4ReportRow, Ga4SyncCursor } from "@/lib/ga4/types";
import type { ConnectorAdapter } from "@/lib/connectors/adapters/types";
import type {
  ConnectorAdapterContext,
  ConnectorSyncPage,
  ConnectorSyncResult,
  OAuthTokenPair,
} from "@/lib/connectors/types";

export type Ga4SyncItem = {
  reportKey: string;
  startDate: string;
  endDate: string;
  rows: Ga4ReportRow[];
  propertyQuota?: Record<string, unknown>;
};

type Ga4SyncCursorPayload = {
  phase: "reports" | "done";
  reportIndex: number;
  windowStart: string;
  windowEnd: string;
  offset: number;
};

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

function parseCursor(cursor?: string): Ga4SyncCursorPayload {
  if (!cursor) {
    const window = defaultSyncWindow();
    return {
      phase: "reports",
      reportIndex: 0,
      windowStart: window.startDate,
      windowEnd: window.endDate,
      offset: 0,
    };
  }
  return JSON.parse(cursor) as Ga4SyncCursorPayload;
}

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
  if (input.codeVerifier) {
    body.code_verifier = input.codeVerifier;
  }

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
    error?: string;
  };
  if (!response.ok || !data.access_token) {
    throw new Error(data.error ?? "Google token exchange failed.");
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
    scopes: data.scope?.split(/\s+/).filter(Boolean) ?? [],
  };
}

export class Ga4AnalyticsAdapter implements ConnectorAdapter {
  readonly connectorType = "GOOGLE_ANALYTICS_4" as ConnectorType;

  async exchangeCode(input: {
    code: string;
    redirectUri: string;
    codeVerifier?: string;
  }): Promise<OAuthTokenPair> {
    return exchangeGoogleCode(input);
  }

  async refreshTokens(refreshToken: string): Promise<OAuthTokenPair> {
    const env = getServerEnv();
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      throw new Error("Google OAuth credentials are not configured.");
    }

    const response = await fetch(GA4_OAUTH_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    const data = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    };
    if (!response.ok || !data.access_token) {
      throw new Error("Google token refresh failed.");
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
      scopes: data.scope?.split(/\s+/).filter(Boolean) ?? [],
    };
  }

  async revokeTokens(accessToken: string): Promise<void> {
    await fetch(`${GA4_OAUTH_REVOKE_URL}?token=${encodeURIComponent(accessToken)}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
  }

  async listAccounts(accessToken: string) {
    return ga4ApiClient.listAccountSummaries(accessToken);
  }

  async listProperties(accessToken: string, accountName: string): Promise<Ga4Property[]> {
    return ga4ApiClient.listProperties(accessToken, accountName);
  }

  async readPropertyMetadata(accessToken: string, propertyId: string) {
    return ga4ApiClient.getPropertyMetadata(accessToken, propertyId);
  }

  async validateConnection(accessToken: string, propertyId: string) {
    return ga4ApiClient.validateConnection(accessToken, propertyId);
  }

  async retrieveReport(
    accessToken: string,
    propertyId: string,
    reportKey: string,
    startDate: string,
    endDate: string,
    offset = 0,
  ) {
    const definition = GA4_QUERY_DEFINITIONS.find((item) => item.key === reportKey);
    if (!definition) {
      throw new Error(`Unknown GA4 report: ${reportKey}`);
    }
    return ga4ApiClient.runReport(
      accessToken,
      propertyId,
      definition,
      startDate,
      endDate,
      offset,
    );
  }

  async retrieveRealtimeSummary(accessToken: string, propertyId: string) {
    return ga4ApiClient.runRealtimeSummary(accessToken, propertyId);
  }

  async fetchPage<T>(input: {
    context: ConnectorAdapterContext;
    accessToken: string;
    cursor?: string;
    pageSize?: number;
  }): Promise<ConnectorSyncPage<T>> {
    const account = await import("@/lib/database/prisma").then((m) =>
      m.prisma.connectorAccount.findUnique({
        where: { id: input.context.connectorAccountId },
      }),
    );
    const propertyId = account?.externalAccountId;
    if (!propertyId) {
      throw new Error("GA4 property has not been selected.");
    }

    const state = parseCursor(input.cursor);
    if (state.phase === "done") {
      return { items: [] as T[] };
    }

    const definition = GA4_QUERY_DEFINITIONS[state.reportIndex];
    if (!definition) {
      const nextCursor = JSON.stringify({ ...state, phase: "done" });
      return { items: [] as T[], nextCursor };
    }

    const report = await ga4ApiClient.runReport(
      input.accessToken,
      propertyId,
      definition,
      state.windowStart,
      state.windowEnd,
      state.offset,
      input.pageSize ?? 10_000,
    );

    const item: Ga4SyncItem = {
      reportKey: definition.key,
      startDate: state.windowStart,
      endDate: state.windowEnd,
      rows: report.rows,
      propertyQuota: report.propertyQuota,
    };

    const hasMoreRows = report.rows.length > 0 && report.rowCount > state.offset + report.rows.length;
    let nextCursor: string | undefined;
    if (hasMoreRows) {
      nextCursor = JSON.stringify({
        ...state,
        offset: state.offset + report.rows.length,
      });
    } else if (state.reportIndex + 1 < GA4_QUERY_DEFINITIONS.length) {
      nextCursor = JSON.stringify({
        ...state,
        reportIndex: state.reportIndex + 1,
        offset: 0,
      });
    } else {
      nextCursor = JSON.stringify({ ...state, phase: "done" });
    }

    return {
      items: [item as T],
      nextCursor,
    };
  }

  mapPageToSyncResult<T>(page: ConnectorSyncPage<T>): ConnectorSyncResult {
    const items = page.items as Ga4SyncItem[];
    const rowCount = items.reduce((sum, item) => sum + item.rows.length, 0);
    return {
      recordsProcessed: rowCount,
      recordsFailed: 0,
      partialFailure: false,
      nextCursor: page.nextCursor,
    };
  }
}

export const ga4AnalyticsAdapter = new Ga4AnalyticsAdapter();

export function parseGa4SyncCursor(cursor: string): Ga4SyncCursor | null {
  try {
    const parsed = JSON.parse(cursor) as Ga4SyncCursorPayload;
    const definition = GA4_QUERY_DEFINITIONS[parsed.reportIndex];
    if (!definition) return null;
    return {
      reportKey: definition.key,
      startDate: parsed.windowStart,
      endDate: parsed.windowEnd,
      offset: parsed.offset,
    };
  } catch {
    return null;
  }
}
