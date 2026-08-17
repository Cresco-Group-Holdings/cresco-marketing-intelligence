"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { apiFetch } from "@/lib/api/client";

export type GscViewMode = "connect" | "analytics" | "sources";

const connectNav: Array<{ label: string; href: string; mode: GscViewMode }> = [
  { label: "Connect", href: "/connectors/google-search-console", mode: "connect" },
  { label: "Analytics", href: "/analytics/search", mode: "analytics" },
  { label: "Data source", href: "/data/sources/search-console", mode: "sources" },
];

type GscSite = { siteUrl: string; permissionLevel: string };

export function GscView({ mode }: { mode: GscViewMode }) {
  const { preference } = useWorkspace();
  const searchParams = useSearchParams();
  const organisationId = preference.currentOrganisationId;
  const brandId = preference.currentBrandId;

  const [status, setStatus] = useState<Record<string, unknown> | null>(null);
  const [sites, setSites] = useState<GscSite[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!brandId || !organisationId) return;
    const data = await apiFetch<{ connection: Record<string, unknown>; sync: Record<string, unknown> }>(
      `/api/brands/${brandId}/gsc?organisationId=${organisationId}`,
      { organisationId },
    );
    setStatus({ ...data.connection, sync: data.sync });
  }, [brandId, organisationId]);

  useEffect(() => {
    void load().catch(() => setMessage("Failed to load Search Console status."));
  }, [load]);

  useEffect(() => {
    async function completeOAuth() {
      const state = searchParams.get("state");
      const code = searchParams.get("code");
      if (!state || !code || !brandId || !organisationId) return;

      setLoading(true);
      try {
        await apiFetch(
          `/api/brands/${brandId}/connectors/GOOGLE_SEARCH_CONSOLE/complete?organisationId=${organisationId}`,
          {
            method: "POST",
            organisationId,
            body: JSON.stringify({ state, code }),
          },
        );
        setMessage("Google account connected. Select a Search Console property below.");
        const siteData = await apiFetch<{ items: GscSite[] }>(
          `/api/brands/${brandId}/gsc/sites?organisationId=${organisationId}`,
          { organisationId },
        );
        setSites(siteData.items);
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
        `/api/brands/${brandId}/connectors/GOOGLE_SEARCH_CONSOLE/connect?organisationId=${organisationId}`,
        { method: "POST", organisationId },
      );
      window.location.href = data.connection.authorisationUrl;
    } catch {
      setMessage("Failed to start Google OAuth.");
      setLoading(false);
    }
  }

  async function loadSites() {
    if (!brandId || !organisationId) return;
    const data = await apiFetch<{ items: GscSite[] }>(
      `/api/brands/${brandId}/gsc/sites?organisationId=${organisationId}`,
      { organisationId },
    );
    setSites(data.items);
  }

  async function selectSite(site: GscSite) {
    if (!brandId || !organisationId) return;
    await apiFetch(`/api/brands/${brandId}/gsc/select-site?organisationId=${organisationId}`, {
      method: "POST",
      organisationId,
      body: JSON.stringify({ siteUrl: site.siteUrl, siteLabel: site.siteUrl }),
    });
    setMessage(`Property "${site.siteUrl}" assigned to this brand.`);
    await load();
  }

  async function runSync(syncType: "INITIAL" | "INCREMENTAL") {
    if (!brandId || !organisationId) return;
    setLoading(true);
    try {
      await apiFetch(`/api/brands/${brandId}/gsc?organisationId=${organisationId}`, {
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
    siteSelected?: boolean;
    account?: Record<string, unknown>;
    sync?: Record<string, unknown>;
  } | null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Google Search Console"
        description="Connect verified properties and import organic search performance into the Marketing Data Warehouse."
      />

      <nav className="flex flex-wrap gap-2">
        {connectNav.map((item) => (
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
                {!connection.siteSelected ? (
                  <div className="space-y-3">
                    <p>Select a Search Console property — automatic selection is not performed.</p>
                    <Button variant="outline" size="sm" onClick={() => void loadSites()}>
                      Load properties
                    </Button>
                    {sites.length > 0 && (
                      <ul className="space-y-2">
                        {sites.map((site) => (
                          <li
                            key={site.siteUrl}
                            className="flex items-center justify-between gap-2 rounded border p-2"
                          >
                            <div>
                              <p className="font-medium">{site.siteUrl}</p>
                              <p className="text-xs text-muted-foreground">{site.permissionLevel}</p>
                            </div>
                            <Button size="sm" onClick={() => void selectSite(site)}>
                              Select
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : (
                  <p>Property: {String(connection.account?.siteLabel ?? connection.account?.siteUrl)}</p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {(mode === "analytics" || mode === "sources") && connection?.siteSelected && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sync status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>Site: {String(connection.account?.siteUrl)}</p>
              <p>
                Last synced:{" "}
                {String((connection.sync as { lastSyncedDate?: string })?.lastSyncedDate ?? "—")}
              </p>
              <p>
                Data delay:{" "}
                {String((connection.sync as { dataDelayDays?: number })?.dataDelayDays ?? 2)} days
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
              <CardTitle className="text-base">Freshness & limitations</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>
                Imported periods:{" "}
                {String((connection.sync as { backfillStartDate?: string })?.backfillStartDate ?? "—")}{" "}
                → {String((connection.sync as { lastSyncedDate?: string })?.lastSyncedDate ?? "—")}
              </p>
              <p className="mt-2">
                Search Console data is typically 2–3 days behind. Current-day data is incomplete and
                low-volume queries may be anonymised.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export type SearchAnalyticsMode = "overview" | "queries" | "pages" | "opportunities" | "indexing";

const analyticsNav: Array<{ label: string; href: string; mode: SearchAnalyticsMode }> = [
  { label: "Overview", href: "/analytics/search", mode: "overview" },
  { label: "Queries", href: "/analytics/search/queries", mode: "queries" },
  { label: "Pages", href: "/analytics/search/pages", mode: "pages" },
  { label: "Opportunities", href: "/analytics/search/opportunities", mode: "opportunities" },
  { label: "Indexing", href: "/analytics/search/indexing", mode: "indexing" },
];

export function SearchAnalyticsView({ mode }: { mode: SearchAnalyticsMode }) {
  const { preference } = useWorkspace();
  const brandId = preference.currentBrandId;
  const organisationId = preference.currentOrganisationId;
  const [days, setDays] = useState("28");
  const [data, setData] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [inspectUrl, setInspectUrl] = useState("");
  const [inspectMessage, setInspectMessage] = useState<string | null>(null);

  const query = useMemo(() => {
    const to = new Date();
    const from = new Date(to.getTime() - Number(days) * 86_400_000);
    const params = new URLSearchParams({
      organisationId: organisationId ?? "",
      section: mode,
      from: from.toISOString(),
      to: to.toISOString(),
    });
    return params.toString();
  }, [organisationId, days, mode]);

  const load = useCallback(async () => {
    if (!brandId || !organisationId) return;
    try {
      setData(
        await apiFetch(`/api/brands/${brandId}/gsc/analytics?${query}`, {
          organisationId,
        }),
      );
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load search analytics.");
    }
  }, [brandId, organisationId, query]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runInspection() {
    if (!brandId || !organisationId || !inspectUrl.trim()) return;
    try {
      await apiFetch(`/api/brands/${brandId}/gsc/inspect?organisationId=${organisationId}`, {
        method: "POST",
        organisationId,
        body: JSON.stringify({ inspectionUrl: inspectUrl.trim() }),
      });
      setInspectMessage("URL inspection completed.");
      await load();
    } catch (caught) {
      setInspectMessage(caught instanceof Error ? caught.message : "Inspection failed.");
    }
  }

  const overview =
    mode === "overview" && data && typeof data === "object" && "overview" in data
      ? (data as { overview: Record<string, unknown> }).overview
      : null;

  const queries =
    mode === "queries" && data && typeof data === "object" && "queries" in data
      ? (data as { queries: Array<{ query: string; clicks: number; isAnonymized: boolean }> }).queries
      : [];

  const pages =
    mode === "pages" && data && typeof data === "object" && "pages" in data
      ? (data as { pages: Array<{ page: string; clicks: number }> }).pages
      : [];

  const opportunities =
    mode === "opportunities" && data && typeof data === "object" && "opportunities" in data
      ? (data as {
          opportunities: Array<{
            id: string;
            title: string;
            description: string;
            severity: string;
            rule: string;
          }>;
        }).opportunities
      : [];

  const indexing =
    mode === "indexing" && data && typeof data === "object" && "indexing" in data
      ? (data as {
          indexing: {
            inspections: Array<Record<string, unknown>>;
            sitemaps: Array<Record<string, unknown>>;
          };
        }).indexing
      : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Search analytics"
        description="Organic search performance from Google Search Console. Data freshness reflects Google's reporting delay."
        breadcrumbs={[{ label: "Analytics", href: "/analytics/search" }, { label: mode }]}
      />

      <nav className="flex flex-wrap gap-2">
        {analyticsNav.map((item) => (
          <Link key={item.href} href={item.href}>
            <Button variant={item.mode === mode ? "primary" : "outline"} size="sm">
              {item.label}
            </Button>
          </Link>
        ))}
        <Link href="/connectors/google-search-console">
          <Button variant="outline" size="sm">
            Connect
          </Button>
        </Link>
      </nav>

      {mode !== "indexing" && (
        <div className="max-w-xs">
          <label className="mb-1 block text-sm font-medium">Date range (days)</label>
          <select
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={days}
            onChange={(event) => setDays(event.target.value)}
          >
            {["7", "14", "28", "90"].map((value) => (
              <option key={value} value={value}>
                Last {value} days
              </option>
            ))}
          </select>
        </div>
      )}

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {mode === "overview" && overview && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Clicks</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {Number(overview.clicks ?? 0).toLocaleString()}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Impressions</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {Number(overview.impressions ?? 0).toLocaleString()}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">CTR</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {(Number(overview.ctr ?? 0) * 100).toFixed(2)}%
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Avg. position</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {Number(overview.avgPosition ?? 0).toFixed(1)}
            </CardContent>
          </Card>
          <Card className="md:col-span-2 lg:col-span-4">
            <CardHeader>
              <CardTitle className="text-base">Data freshness</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>
                Last synced through:{" "}
                {String(
                  (overview.freshness as { lastSyncedDate?: string })?.lastSyncedDate ?? "Not synced yet",
                )}
              </p>
              <p className="mt-1">
                {String(
                  (overview.freshness as { disclaimer?: string })?.disclaimer ??
                    "Search Console data may be delayed.",
                )}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {mode === "queries" && (
        <Card>
          <CardHeader>
            <CardTitle>Top queries</CardTitle>
          </CardHeader>
          <CardContent>
            {queries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No query data for this period.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2">Query</th>
                    <th className="py-2">Clicks</th>
                  </tr>
                </thead>
                <tbody>
                  {queries.map((row) => (
                    <tr key={row.query} className="border-b">
                      <td className="py-2">
                        {row.query}
                        {row.isAnonymized ? (
                          <Badge className="ml-2" variant="muted">
                            anonymised
                          </Badge>
                        ) : null}
                      </td>
                      <td className="py-2">{row.clicks.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {mode === "pages" && (
        <Card>
          <CardHeader>
            <CardTitle>Top landing pages</CardTitle>
          </CardHeader>
          <CardContent>
            {pages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No page data for this period.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2">Page</th>
                    <th className="py-2">Clicks</th>
                  </tr>
                </thead>
                <tbody>
                  {pages.map((row) => (
                    <tr key={row.page} className="border-b">
                      <td className="py-2 break-all">{row.page}</td>
                      <td className="py-2">{row.clicks.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {mode === "opportunities" && (
        <Card>
          <CardHeader>
            <CardTitle>Deterministic opportunities</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {opportunities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No opportunities detected for this period.</p>
            ) : (
              opportunities.map((item) => (
                <div key={item.id} className="rounded border p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{item.title}</p>
                    <Badge variant={item.severity === "high" ? "warning" : "muted"}>{item.severity}</Badge>
                  </div>
                  <p className="text-muted-foreground">{item.description}</p>
                  <p className="text-xs text-muted-foreground">Rule: {item.rule}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {mode === "indexing" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Manual URL inspection</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Inspect individual URLs on demand. Limited to 50 inspections per property per day.
              </p>
              <div className="flex flex-wrap gap-2">
                <Input
                  label="URL to inspect"
                  value={inspectUrl}
                  onChange={(event) => setInspectUrl(event.target.value)}
                  className="min-w-[280px] flex-1"
                />
                <Button onClick={() => void runInspection()}>Inspect URL</Button>
              </div>
              {inspectMessage ? <p className="text-sm text-muted-foreground">{inspectMessage}</p> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent inspections</CardTitle>
            </CardHeader>
            <CardContent>
              {!indexing?.inspections?.length ? (
                <p className="text-sm text-muted-foreground">No URL inspections yet.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {indexing.inspections.map((item) => (
                    <li key={String(item.id)} className="rounded border p-2">
                      <p className="font-medium break-all">{String(item.inspectionUrl)}</p>
                      <p className="text-muted-foreground">
                        Indexed: {String(item.indexedState ?? "—")} · Crawl: {String(item.crawlState ?? "—")}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sitemap status</CardTitle>
            </CardHeader>
            <CardContent>
              {!indexing?.sitemaps?.length ? (
                <p className="text-sm text-muted-foreground">No sitemaps synced yet.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {indexing.sitemaps.map((item) => (
                    <li key={String(item.sitemapPath)} className="rounded border p-2">
                      <p className="font-medium break-all">{String(item.sitemapPath)}</p>
                      <p className="text-muted-foreground">
                        Warnings: {String(item.warnings ?? 0)} · Errors: {String(item.errors ?? 0)} ·
                        Discovered URLs: {String(item.discoveredUrls ?? "—")}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
