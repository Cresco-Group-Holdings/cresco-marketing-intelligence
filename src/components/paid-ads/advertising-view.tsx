"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { ConnectorType } from "@prisma/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { apiFetch } from "@/lib/api/client";

const CONNECTOR_LABELS: Record<string, string> = {
  GOOGLE_ADS: "Google Ads",
  META: "Meta Ads",
  LINKEDIN: "LinkedIn Ads",
  TIKTOK: "TikTok Ads",
};

type AdAccount = { accountId: string; name: string; currency?: string; timezone?: string };

export function PaidAdsConnectorView({ connectorType }: { connectorType: ConnectorType }) {
  const { preference } = useWorkspace();
  const searchParams = useSearchParams();
  const organisationId = preference.currentOrganisationId;
  const brandId = preference.currentBrandId;
  const label = CONNECTOR_LABELS[connectorType] ?? connectorType;

  const [status, setStatus] = useState<Record<string, unknown> | null>(null);
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!brandId || !organisationId) return;
    const data = await apiFetch<{ connection: Record<string, unknown>; sync: Record<string, unknown> }>(
      `/api/brands/${brandId}/paid-ads/${connectorType}?organisationId=${organisationId}`,
      { organisationId },
    );
    setStatus({ ...data.connection, sync: data.sync });
  }, [brandId, organisationId, connectorType]);

  useEffect(() => {
    void load().catch(() => setMessage(`Failed to load ${label} status.`));
  }, [load, label]);

  useEffect(() => {
    async function completeOAuth() {
      const state = searchParams.get("state");
      const code = searchParams.get("code");
      if (!state || !code || !brandId || !organisationId) return;
      setLoading(true);
      try {
        await apiFetch(
          `/api/brands/${brandId}/connectors/${connectorType}/complete?organisationId=${organisationId}`,
          { method: "POST", organisationId, body: JSON.stringify({ state, code }) },
        );
        setMessage("Account connected. Select an ad account below.");
        const accountData = await apiFetch<{ items: AdAccount[] }>(
          `/api/brands/${brandId}/paid-ads/${connectorType}/accounts?organisationId=${organisationId}`,
          { organisationId },
        );
        setAccounts(accountData.items);
      } catch {
        setMessage("OAuth completion failed.");
      } finally {
        setLoading(false);
      }
    }
    void completeOAuth();
  }, [searchParams, brandId, organisationId, connectorType]);

  async function beginConnect() {
    if (!brandId || !organisationId) return;
    setLoading(true);
    try {
      const data = await apiFetch<{ connection: { authorisationUrl: string } }>(
        `/api/brands/${brandId}/connectors/${connectorType}/connect?organisationId=${organisationId}`,
        { method: "POST", organisationId },
      );
      window.location.href = data.connection.authorisationUrl;
    } catch {
      setMessage("Failed to start OAuth.");
      setLoading(false);
    }
  }

  async function loadAccounts() {
    if (!brandId || !organisationId) return;
    const data = await apiFetch<{ items: AdAccount[] }>(
      `/api/brands/${brandId}/paid-ads/${connectorType}/accounts?organisationId=${organisationId}`,
      { organisationId },
    );
    setAccounts(data.items);
  }

  async function selectAccount(account: AdAccount) {
    if (!brandId || !organisationId) return;
    await apiFetch(
      `/api/brands/${brandId}/paid-ads/${connectorType}/select-account?organisationId=${organisationId}`,
      {
        method: "POST",
        organisationId,
        body: JSON.stringify({
          accountId: account.accountId,
          accountLabel: account.name,
          currency: account.currency,
          timezone: account.timezone,
        }),
      },
    );
    setMessage(`Ad account "${account.name}" assigned to this brand.`);
    await load();
  }

  async function runSync(syncType: "INITIAL" | "INCREMENTAL") {
    if (!brandId || !organisationId) return;
    setLoading(true);
    try {
      await apiFetch(`/api/brands/${brandId}/paid-ads/${connectorType}?organisationId=${organisationId}`, {
        method: "POST",
        organisationId,
        body: JSON.stringify({ syncType }),
      });
      setMessage(`${syncType} sync started.`);
      await load();
    } catch {
      setMessage("Sync failed.");
    } finally {
      setLoading(false);
    }
  }

  const connection = status as {
    connected?: boolean;
    accountSelected?: boolean;
    account?: Record<string, unknown>;
    sync?: Record<string, unknown>;
  } | null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={label}
        description="Connect ad accounts and import read-only advertising performance. Budgets are never modified."
      />
      <nav className="flex flex-wrap gap-2">
        <Link href="/analytics/advertising">
          <Button variant="outline" size="sm">Advertising dashboard</Button>
        </Link>
        <Link href="/connectors">
          <Button variant="outline" size="sm">All connectors</Button>
        </Link>
      </nav>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      <Card>
        <CardHeader><CardTitle>Connection</CardTitle></CardHeader>
        <CardContent className="space-y-4 text-sm">
          {!connection?.connected ? (
            <Button onClick={() => void beginConnect()} disabled={loading}>Connect {label}</Button>
          ) : (
            <>
              <p>Status: <Badge>{String(connection.account?.status ?? "CONNECTED")}</Badge></p>
              {!connection.accountSelected ? (
                <div className="space-y-3">
                  <p>Select an ad account — one account can be linked to multiple brands.</p>
                  <Button variant="outline" size="sm" onClick={() => void loadAccounts()}>Load ad accounts</Button>
                  {accounts.map((account) => (
                    <div key={account.accountId} className="flex items-center justify-between gap-2 rounded border p-2">
                      <div>
                        <p className="font-medium">{account.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {account.currency ?? "—"} · {account.timezone ?? "—"}
                        </p>
                      </div>
                      <Button size="sm" onClick={() => void selectAccount(account)}>Select</Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-1">
                  <p>Account: {String(connection.account?.adAccountLabel)}</p>
                  <p>Currency: {String(connection.account?.currency ?? "—")}</p>
                  <p>Timezone: {String(connection.account?.timezone ?? "—")}</p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      {connection?.accountSelected && (
        <Card>
          <CardHeader><CardTitle className="text-base">Sync</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Last synced: {String((connection.sync as { lastSyncedDate?: string })?.lastSyncedDate ?? "—")}</p>
            <p className="text-muted-foreground">Read-only import. No budget or campaign changes are made.</p>
            <div className="flex gap-2 pt-2">
              <Button size="sm" disabled={loading} onClick={() => void runSync("INITIAL")}>Initial backfill</Button>
              <Button size="sm" variant="outline" disabled={loading} onClick={() => void runSync("INCREMENTAL")}>Incremental</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export type AdvertisingMode = "overview" | "campaigns" | "ads" | "creatives" | "conversions";

const nav: Array<{ label: string; href: string; mode: AdvertisingMode }> = [
  { label: "Overview", href: "/analytics/advertising", mode: "overview" },
  { label: "Campaigns", href: "/analytics/advertising/campaigns", mode: "campaigns" },
  { label: "Ads", href: "/analytics/advertising/ads", mode: "ads" },
  { label: "Creatives", href: "/analytics/advertising/creatives", mode: "creatives" },
  { label: "Conversions", href: "/analytics/advertising/conversions", mode: "conversions" },
];

export function AdvertisingAnalyticsView({ mode }: { mode: AdvertisingMode }) {
  const { preference } = useWorkspace();
  const brandId = preference.currentBrandId;
  const organisationId = preference.currentOrganisationId;
  const [days, setDays] = useState("28");
  const [data, setData] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => {
    const to = new Date();
    const from = new Date(to.getTime() - Number(days) * 86_400_000);
    return new URLSearchParams({
      organisationId: organisationId ?? "",
      section: mode,
      from: from.toISOString(),
      to: to.toISOString(),
    }).toString();
  }, [organisationId, days, mode]);

  const load = useCallback(async () => {
    if (!brandId || !organisationId) return;
    try {
      setData(await apiFetch(`/api/brands/${brandId}/paid-ads/analytics?${query}`, { organisationId }));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load advertising analytics.");
    }
  }, [brandId, organisationId, query]);

  useEffect(() => { void load(); }, [load]);

  const overview = mode === "overview" && data && typeof data === "object" && "overview" in data
    ? (data as { overview: Record<string, unknown> }).overview : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Advertising analytics"
        description="Unified paid media performance. Conversion metrics preserve provider attribution definitions — cross-provider comparisons are not equivalent."
        breadcrumbs={[{ label: "Analytics", href: "/analytics/advertising" }, { label: mode }]}
      />
      <nav className="flex flex-wrap gap-2">
        {nav.map((item) => (
          <Link key={item.href} href={item.href}>
            <Button variant={item.mode === mode ? "primary" : "outline"} size="sm">{item.label}</Button>
          </Link>
        ))}
      </nav>
      {mode !== "creatives" && (
        <select className="rounded-md border px-3 py-2 text-sm" value={days} onChange={(e) => setDays(e.target.value)}>
          {["7", "14", "28", "90"].map((v) => <option key={v} value={v}>Last {v} days</option>)}
        </select>
      )}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {mode === "overview" && overview && (
        <>
          {(overview.mixedCurrencyWarning as boolean) && (
            <p className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Multiple currencies detected. Spend is not aggregated across currencies.
            </p>
          )}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              ["Spend", overview.spend, "currency"],
              ["Impressions", overview.impressions, "number"],
              ["Clicks", overview.clicks, "number"],
              ["Conversions", overview.conversions, "number"],
            ].map(([label, value, type]) => (
              <Card key={String(label)}>
                <CardHeader><CardTitle className="text-base">{String(label)}</CardTitle></CardHeader>
                <CardContent className="text-2xl font-semibold">
                  {type === "currency" ? Number(value ?? 0).toLocaleString(undefined, { style: "currency", currency: "USD" }) : Number(value ?? 0).toLocaleString()}
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">{String(overview.roasDisclaimer)}</p>
        </>
      )}
      {mode === "campaigns" && data && typeof data === "object" && "campaigns" in data ? (
        <Card>
          <CardHeader><CardTitle>Campaigns</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left"><th className="py-2">Campaign</th><th>Provider</th><th>Spend</th><th>Clicks</th></tr></thead>
              <tbody>
                {((data as { campaigns: Array<Record<string, unknown>> }).campaigns ?? []).map((c) => (
                  <tr key={String(c.id)} className="border-b">
                    <td className="py-2">{String(c.name)}</td>
                    <td>{String(c.provider)}</td>
                    <td>{Number(c.spend ?? 0).toLocaleString()}</td>
                    <td>{Number(c.clicks ?? 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}
      {mode === "conversions" && data && typeof data === "object" && "conversions" in data ? (
        <Card>
          <CardHeader><CardTitle>Conversions by provider</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {((data as { conversions: Array<Record<string, unknown>> }).conversions ?? []).map((c, i) => (
              <div key={i} className="rounded border p-2">
                <p className="font-medium">{String(c.provider)} · {String(c.metricKey)}</p>
                <p>Value: {Number(c.value ?? 0).toLocaleString()}</p>
                {c.attributionWindow ? <p className="text-muted-foreground">Attribution: {String(c.attributionWindow)}</p> : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
