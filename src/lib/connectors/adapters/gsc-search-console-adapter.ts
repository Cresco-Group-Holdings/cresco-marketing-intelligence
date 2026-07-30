import { createHash } from "node:crypto";
import type { ConnectorType } from "@prisma/client";
import { getServerEnv } from "@/lib/environment";
import { GA4_OAUTH_REVOKE_URL, GA4_OAUTH_TOKEN_URL } from "@/lib/ga4/constants";
import { buildGoogleOAuthAuthorisationUrl } from "@/lib/connectors/oauth/google";
import { gscApiClient } from "@/lib/gsc/client";
import { GSC_QUERY_DEFINITIONS } from "@/lib/gsc/query-registry";
import type { GscSearchAnalyticsRow } from "@/lib/gsc/types";
import type { ConnectorAdapter } from "@/lib/connectors/adapters/types";
import type {
  ConnectorAdapterContext,
  ConnectorSyncPage,
  ConnectorSyncResult,
  OAuthTokenPair,
} from "@/lib/connectors/types";

export type GscSyncItem = {
  reportKey: string;
  startDate: string;
  endDate: string;
  rows: GscSearchAnalyticsRow[];
  grain: string;
};

type GscSyncCursorPayload = {
  phase: "reports" | "done";
  reportIndex: number;
  windowStart: string;
  windowEnd: string;
  startRow: number;
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
  if (!response.ok || !data.access_token) {
    throw new Error("Google token exchange failed.");
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
    scopes: data.scope?.split(/\s+/).filter(Boolean) ?? [],
  };
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function defaultSyncWindow(): { startDate: string; endDate: string } {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 3);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);
  return { startDate: formatDate(start), endDate: formatDate(end) };
}

function parseCursor(cursor?: string): GscSyncCursorPayload {
  if (!cursor) {
    const window = defaultSyncWindow();
    return { phase: "reports", reportIndex: 0, windowStart: window.startDate, windowEnd: window.endDate, startRow: 0 };
  }
  return JSON.parse(cursor) as GscSyncCursorPayload;
}

export class GscSearchConsoleAdapter implements ConnectorAdapter {
  readonly connectorType = "GOOGLE_SEARCH_CONSOLE" as ConnectorType;

  buildAuthorisationUrl(input: {
    state: string;
    redirectUri: string;
    scopes: string[];
    codeChallenge?: string;
  }): string {
    return buildGoogleOAuthAuthorisationUrl(input);
  }

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
    if (!response.ok || !data.access_token) throw new Error("Google token refresh failed.");
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
      scopes: data.scope?.split(/\s+/).filter(Boolean) ?? [],
    };
  }

  async revokeTokens(accessToken: string): Promise<void> {
    await fetch(`${GA4_OAUTH_REVOKE_URL}?token=${encodeURIComponent(accessToken)}`, { method: "POST" });
  }

  async listSites(accessToken: string) {
    return gscApiClient.listSites(accessToken);
  }

  async validateSite(accessToken: string, siteUrl: string) {
    return gscApiClient.validateSiteAccess(accessToken, siteUrl);
  }

  async listSitemaps(accessToken: string, siteUrl: string) {
    return gscApiClient.listSitemaps(accessToken, siteUrl);
  }

  async inspectUrl(accessToken: string, siteUrl: string, inspectionUrl: string) {
    return gscApiClient.inspectUrl(accessToken, siteUrl, inspectionUrl);
  }

  async fetchPage<T>(input: {
    context: ConnectorAdapterContext;
    accessToken: string;
    cursor?: string;
    pageSize?: number;
  }): Promise<ConnectorSyncPage<T>> {
    const account = await import("@/lib/database/prisma").then((m) =>
      m.prisma.connectorAccount.findUnique({ where: { id: input.context.connectorAccountId } }),
    );
    const siteUrl = account?.externalAccountId;
    if (!siteUrl) throw new Error("Search Console site has not been selected.");

    const state = parseCursor(input.cursor);
    if (state.phase === "done") return { items: [] as T[] };

    const definition = GSC_QUERY_DEFINITIONS[state.reportIndex];
    if (!definition) {
      return { items: [] as T[], nextCursor: JSON.stringify({ ...state, phase: "done" }) };
    }

    const result = await gscApiClient.querySearchAnalytics(
      input.accessToken,
      siteUrl,
      definition,
      state.windowStart,
      state.windowEnd,
      state.startRow,
      input.pageSize ?? 25_000,
    );

    const item: GscSyncItem = {
      reportKey: definition.key,
      startDate: state.windowStart,
      endDate: state.windowEnd,
      rows: result.rows,
      grain: definition.grain,
    };

    const hasMore = result.rows.length >= (input.pageSize ?? 25_000);
    let nextCursor: string | undefined;
    if (hasMore) {
      nextCursor = JSON.stringify({ ...state, startRow: state.startRow + result.rows.length });
    } else if (state.reportIndex + 1 < GSC_QUERY_DEFINITIONS.length) {
      nextCursor = JSON.stringify({ ...state, reportIndex: state.reportIndex + 1, startRow: 0 });
    } else {
      nextCursor = JSON.stringify({ ...state, phase: "done" });
    }

    return { items: [item as T], nextCursor };
  }

  mapPageToSyncResult<T>(page: ConnectorSyncPage<T>): ConnectorSyncResult {
    const items = page.items as GscSyncItem[];
    const rowCount = items.reduce((sum, item) => sum + item.rows.length, 0);
    return { recordsProcessed: rowCount, recordsFailed: 0, partialFailure: false, nextCursor: page.nextCursor };
  }
}

export const gscSearchConsoleAdapter = new GscSearchConsoleAdapter();

export function rowToPayload(
  reportKey: string,
  grain: string,
  dimensions: string[],
  row: GscSearchAnalyticsRow,
  siteUrl: string,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    reportKey,
    grain,
    siteUrl,
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position,
  };
  dimensions.forEach((dimension, index) => {
    payload[dimension] = row.keys[index];
  });
  if (typeof payload.date === "string") {
    const d = String(payload.date);
    payload.date = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  }
  return payload;
}

export function providerIdForValue(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex").slice(0, 32);
}
