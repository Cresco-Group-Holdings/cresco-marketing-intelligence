"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { apiFetch } from "@/lib/api/client";

export type Ga4ViewMode = "connect" | "analytics" | "sources";

const nav: Array<{ label: string; href: string; mode: Ga4ViewMode }> = [
  { label: "Connect", href: "/connectors/google-analytics", mode: "connect" },
  { label: "Analytics", href: "/analytics/website/ga4", mode: "analytics" },
  { label: "Data source", href: "/data/sources/ga4", mode: "sources" },
];

type Ga4Account = { name: string; displayName: string };
type Ga4Property = { name: string; displayName: string; timeZone?: string; currencyCode?: string };

export function Ga4View({ mode }: { mode: Ga4ViewMode }) {
  const { preference } = useWorkspace();
  const searchParams = useSearchParams();
  const organisationId = preference.currentOrganisationId;
  const brandId = preference.currentBrandId;

  const [status, setStatus] = useState<Record<string, unknown> | null>(null);
  const [accounts, setAccounts] = useState<Ga4Account[]>([]);
  const [properties, setProperties] = useState<Ga4Property[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [reconciliation, setReconciliation] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!brandId || !organisationId) return;
    const data = await apiFetch<{ connection: Record<string, unknown>; sync: Record<string, unknown> }>(
      `/api/brands/${brandId}/ga4?organisationId=${organisationId}`,
      { organisationId },
    );
    setStatus({ ...data.connection, sync: data.sync });

    if (mode === "analytics") {
      const recon = await apiFetch<{ reconciliation: Record<string, unknown> }>(
        `/api/brands/${brandId}/ga4/reconciliation?organisationId=${organisationId}`,
        { organisationId },
      );
      setReconciliation(recon.reconciliation);
    }
  }, [brandId, organisationId, mode]);

  useEffect(() => {
    void load().catch(() => setMessage("Failed to load GA4 status."));
  }, [load]);

  useEffect(() => {
    async function completeOAuth() {
      const state = searchParams.get("state");
      const code = searchParams.get("code");
      if (!state || !code || !brandId || !organisationId) return;

      setLoading(true);
      try {
        await apiFetch(
          `/api/brands/${brandId}/connectors/GOOGLE_ANALYTICS_4/complete?organisationId=${organisationId}`,
          {
            method: "POST",
            organisationId,
            body: JSON.stringify({ state, code }),
          },
        );
        setMessage("Google account connected. Select a GA4 property below.");
        const accountData = await apiFetch<{ items: Ga4Account[] }>(
          `/api/brands/${brandId}/ga4/accounts?organisationId=${organisationId}`,
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
  }, [searchParams, brandId, organisationId]);

  async function beginConnect() {
    if (!brandId || !organisationId) return;
    setLoading(true);
    try {
      const data = await apiFetch<{ connection: { authorisationUrl: string } }>(
        `/api/brands/${brandId}/connectors/GOOGLE_ANALYTICS_4/connect?organisationId=${organisationId}`,
        { method: "POST", organisationId },
      );
      window.location.href = data.connection.authorisationUrl;
    } catch {
      setMessage("Failed to start Google OAuth.");
      setLoading(false);
    }
  }

  async function loadAccounts() {
    if (!brandId || !organisationId) return;
    const data = await apiFetch<{ items: Ga4Account[] }>(
      `/api/brands/${brandId}/ga4/accounts?organisationId=${organisationId}`,
      { organisationId },
    );
    setAccounts(data.items);
  }

  async function loadProperties(accountName: string) {
    if (!brandId || !organisationId) return;
    setSelectedAccount(accountName);
    const data = await apiFetch<{ items: Ga4Property[] }>(
      `/api/brands/${brandId}/ga4/properties?organisationId=${organisationId}&accountName=${encodeURIComponent(accountName)}`,
      { organisationId },
    );
    setProperties(data.items);
  }

  async function selectProperty(property: Ga4Property) {
    if (!brandId || !organisationId || !selectedAccount) return;
    await apiFetch(
      `/api/brands/${brandId}/ga4/select-property?organisationId=${organisationId}`,
      {
        method: "POST",
        organisationId,
        body: JSON.stringify({
          accountName: selectedAccount,
          propertyName: property.name,
          propertyDisplayName: property.displayName,
        }),
      },
    );
    setMessage(`Property "${property.displayName}" assigned to this brand.`);
    await load();
  }

  async function runSync(syncType: "INITIAL" | "INCREMENTAL") {
    if (!brandId || !organisationId) return;
    setLoading(true);
    try {
      await apiFetch(`/api/brands/${brandId}/ga4?organisationId=${organisationId}`, {
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
    propertySelected?: boolean;
    account?: Record<string, unknown>;
    sync?: Record<string, unknown>;
  } | null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Google Analytics 4"
        description="Connect GA4 properties and import website analytics into the Marketing Data Warehouse."
      />

      <nav className="flex flex-wrap gap-2">
        {nav.map((item) => (
          <Link key={item.href} href={item.href}>
            <Button variant={item.mode === mode ? "primary" : "outline"} size="sm">
              {item.label}
            </Button>
          </Link>
        ))}
      </nav>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      {(mode === "connect" || mode === "sources") && (
        <Card>
          <CardHeader>
            <CardTitle>Connection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {!connection?.connected ? (
              <Button onClick={() => void beginConnect()} disabled={loading}>
                Connect Google account
              </Button>
            ) : (
              <>
                <p>
                  Status: <Badge>{String(connection.account?.status ?? "CONNECTED")}</Badge>
                </p>
                <p className="text-muted-foreground">
                  Scopes: {((connection.account?.grantedScopes as string[]) ?? []).join(", ")}
                </p>
                {!connection.propertySelected ? (
                  <div className="space-y-3">
                    <p>Select a GA4 property — automatic selection is not performed.</p>
                    <Button variant="outline" size="sm" onClick={() => void loadAccounts()}>
                      Load accounts
                    </Button>
                    {accounts.length > 0 && (
                      <ul className="space-y-2">
                        {accounts.map((account) => (
                          <li key={account.name}>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void loadProperties(account.name)}
                            >
                              {account.displayName}
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {properties.length > 0 && (
                      <ul className="space-y-2">
                        {properties.map((property) => (
                          <li key={property.name} className="flex items-center justify-between gap-2 rounded border p-2">
                            <span>{property.displayName}</span>
                            <Button size="sm" onClick={() => void selectProperty(property)}>
                              Select
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : (
                  <p>Property: {String(connection.account?.externalAccountLabel)}</p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {(mode === "analytics" || mode === "sources") && connection?.propertySelected && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sync status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>Property ID: {String(connection.account?.externalAccountId)}</p>
              <p>Timezone: {String(connection.account?.timezone ?? "—")}</p>
              <p>Currency: {String(connection.account?.currency ?? "—")}</p>
              <p>
                Last synced:{" "}
                {String((connection.sync as { lastSyncedDate?: string })?.lastSyncedDate ?? "—")}
              </p>
              <div className="flex gap-2 pt-2">
                <Button size="sm" disabled={loading} onClick={() => void runSync("INITIAL")}>
                  Initial backfill
                </Button>
                <Button size="sm" variant="outline" disabled={loading} onClick={() => void runSync("INCREMENTAL")}>
                  Incremental sync
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quotas & freshness</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>
                Imported periods:{" "}
                {String((connection.sync as { backfillStartDate?: string })?.backfillStartDate ?? "—")}{" "}
                → {String((connection.sync as { lastSyncedDate?: string })?.lastSyncedDate ?? "—")}
              </p>
              <p className="mt-2">
                Quota data is returned with each report request when available from the GA4 Data API.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {mode === "analytics" && reconciliation && (
        <Card>
          <CardHeader>
            <CardTitle>Reconciliation: GA4 vs first-party</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">{String(reconciliation.disclaimer)}</p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded border p-3">
                <p className="font-medium">Sessions</p>
                <p>GA4: {String((reconciliation.comparison as { sessions: { ga4: number } }).sessions.ga4)}</p>
                <p>
                  First-party:{" "}
                  {String((reconciliation.comparison as { sessions: { firstParty: number } }).sessions.firstParty)}
                </p>
              </div>
              <div className="rounded border p-3">
                <p className="font-medium">Page views</p>
                <p>GA4: {String((reconciliation.comparison as { pageviews: { ga4: number } }).pageviews.ga4)}</p>
                <p>
                  First-party:{" "}
                  {String((reconciliation.comparison as { pageviews: { firstParty: number } }).pageviews.firstParty)}
                </p>
              </div>
            </div>
            {((reconciliation.warnings as string[]) ?? []).length > 0 && (
              <ul className="list-disc pl-5 text-amber-700">
                {(reconciliation.warnings as string[]).map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            )}
            <div>
              <p className="font-medium">Possible causes of differences</p>
              <ul className="list-disc pl-5 text-muted-foreground">
                {(reconciliation.possibleCauses as string[]).map((cause) => (
                  <li key={cause}>{cause}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
