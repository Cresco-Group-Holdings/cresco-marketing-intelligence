"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { apiFetch } from "@/lib/api/client";

type Mode = "overview" | "posts" | "accounts" | "content" | "reports" | "export";

const nav = [
  ["Overview", "/analytics/social"],
  ["Posts", "/analytics/social/posts"],
  ["Accounts", "/analytics/social/accounts"],
  ["Content", "/analytics/social/content"],
  ["Reports", "/analytics/social/reports"],
  ["Export", "/analytics/social/export"],
] as const;

const dimensions = [
  ["CONTENT_ITEM", "Content item"],
  ["CAMPAIGN", "Campaign"],
  ["CONTENT_PILLAR", "Content pillar"],
  ["CONTENT_TYPE", "Format"],
  ["OWNER", "Owner"],
  ["PLATFORM", "Platform"],
] as const;

type AttributionGroup = {
  key: string;
  label: string;
  providers: string[];
  postsMeasured: number;
  totals: Record<string, number>;
  derived: Record<string, number | null>;
};

export function SocialAnalyticsView({ mode }: { mode: Mode }) {
  const { preference } = useWorkspace();
  const brandId = preference.currentBrandId;
  const organisationId = preference.currentOrganisationId;
  const [provider, setProvider] = useState("");
  const [days, setDays] = useState("30");
  const [projectId, setProjectId] = useState("");
  const [socialAccountId, setSocialAccountId] = useState("");
  const [campaign, setCampaign] = useState("");
  const [contentType, setContentType] = useState("");
  const [contentPillar, setContentPillar] = useState("");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [timezone, setTimezone] = useState("");
  const [granularity, setGranularity] = useState("DAY");
  const [dimension, setDimension] = useState<string>("CONTENT_ITEM");
  const [data, setData] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const query = useMemo(() => {
    const to = new Date();
    const from = new Date(to.getTime() - Number(days) * 86_400_000);
    const params = new URLSearchParams({
      organisationId: organisationId ?? "",
      from: from.toISOString(),
      to: to.toISOString(),
      granularity,
    });
    if (provider) params.set("provider", provider);
    if (projectId) params.set("projectId", projectId);
    if (socialAccountId) params.set("socialAccountId", socialAccountId);
    if (campaign) params.set("campaign", campaign);
    if (contentType) params.set("contentType", contentType);
    if (contentPillar) params.set("contentPillar", contentPillar);
    if (ownerUserId) params.set("ownerUserId", ownerUserId);
    if (timezone) params.set("timezone", timezone);
    if (mode === "content" || mode === "export") params.set("dimension", dimension);
    return params.toString();
  }, [
    organisationId,
    provider,
    days,
    projectId,
    socialAccountId,
    campaign,
    contentType,
    contentPillar,
    ownerUserId,
    timezone,
    granularity,
    dimension,
    mode,
  ]);

  const load = useCallback(async () => {
    if (!brandId || !organisationId || mode === "export") return;
    try {
      const endpoint =
        mode === "overview"
          ? "overview"
          : mode === "accounts"
            ? "accounts"
            : mode === "content"
              ? "attribution"
              : "posts";
      setData(
        await apiFetch(`/api/brands/${brandId}/analytics/social/${endpoint}?${query}`, {
          organisationId,
        }),
      );
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load social analytics.");
    }
  }, [brandId, organisationId, mode, query]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows =
    data && typeof data === "object" && "metrics" in data
      ? ((data as { metrics: Array<Record<string, unknown>> }).metrics ?? [])
      : [];
  const attribution =
    mode === "content" && data && typeof data === "object" && "groups" in data
      ? (data as { groups: AttributionGroup[]; timezone?: string })
      : null;
  const overview =
    mode === "overview" && data && typeof data === "object"
      ? (data as {
          timezone?: string;
          totals?: Record<string, number>;
          byProvider?: Record<string, Record<string, number>>;
          derived?: Record<string, number | null>;
          series?: Array<Record<string, unknown>>;
          postsMeasured?: number;
          accountsMeasured?: number;
        })
      : null;
  const reportingTimezone =
    overview?.timezone ??
    attribution?.timezone ??
    (data && typeof data === "object" && "timezone" in data
      ? String((data as { timezone?: string }).timezone)
      : null);

  async function enqueueSync() {
    if (!brandId || !organisationId || !socialAccountId) return;
    try {
      await apiFetch(
        `/api/brands/${brandId}/analytics/social/sync?organisationId=${organisationId}`,
        {
          method: "POST",
          organisationId,
          body: JSON.stringify({
            socialAccountId,
            syncType: "INCREMENTAL",
            idempotencyKey: `manual:${socialAccountId}:${new Date().toISOString().slice(0, 16)}`,
          }),
        },
      );
      setSyncMessage("Analytics refresh queued.");
    } catch (caught) {
      setSyncMessage(caught instanceof Error ? caught.message : "Unable to queue refresh.");
    }
  }

  return (
    <>
      <PageHeader
        title="Social analytics"
        description="Real provider observations only. Unavailable metrics are omitted rather than estimated."
        breadcrumbs={[{ label: "Analytics", href: "/analytics/social" }, { label: mode }]}
      />
      <nav className="mb-4 flex flex-wrap gap-2">
        {nav.map(([label, href]) => (
          <Link key={href} className="text-sm underline" href={href}>
            {label}
          </Link>
        ))}
      </nav>
      <div className="mb-5 grid gap-3 md:grid-cols-4">
        <select
          className="rounded-md border px-3 py-2 text-sm"
          value={provider}
          onChange={(event) => setProvider(event.target.value)}
        >
          <option value="">All channels</option>
          {["INSTAGRAM", "FACEBOOK", "LINKEDIN", "TIKTOK", "YOUTUBE", "X"].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <Input
          label="Project ID"
          value={projectId}
          onChange={(event) => setProjectId(event.target.value)}
        />
        <Input
          label="Social account ID"
          value={socialAccountId}
          onChange={(event) => setSocialAccountId(event.target.value)}
        />
        <Input
          label="Campaign"
          value={campaign}
          onChange={(event) => setCampaign(event.target.value)}
        />
        <Input
          label="Content pillar"
          value={contentPillar}
          onChange={(event) => setContentPillar(event.target.value)}
        />
        <Input
          label="Owner user ID"
          value={ownerUserId}
          onChange={(event) => setOwnerUserId(event.target.value)}
        />
        <Input
          label="Reporting timezone"
          placeholder="Brand default"
          value={timezone}
          onChange={(event) => setTimezone(event.target.value)}
        />
        <select
          className="rounded-md border px-3 py-2 text-sm"
          value={contentType}
          onChange={(event) => setContentType(event.target.value)}
        >
          <option value="">All formats</option>
          {[
            "TEXT_POST",
            "IMAGE_POST",
            "CAROUSEL",
            "SHORT_VIDEO",
            "LONG_VIDEO",
            "ARTICLE_LINK",
            "THREAD",
          ].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <select
          className="rounded-md border px-3 py-2 text-sm"
          value={granularity}
          onChange={(event) => setGranularity(event.target.value)}
        >
          <option value="DAY">Daily</option>
          <option value="WEEK">Weekly</option>
          <option value="MONTH">Monthly</option>
        </select>
        {mode === "content" || mode === "export" ? (
          <select
            className="rounded-md border px-3 py-2 text-sm"
            value={dimension}
            onChange={(event) => setDimension(event.target.value)}
          >
            {dimensions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        ) : null}
        <select
          className="rounded-md border px-3 py-2 text-sm"
          value={days}
          onChange={(event) => setDays(event.target.value)}
        >
          <option value="7">7 days</option>
          <option value="30">30 days</option>
          <option value="90">90 days</option>
        </select>
        <Button size="sm" variant="outline" onClick={() => void load()}>
          Refresh
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!socialAccountId}
          onClick={() => void enqueueSync()}
        >
          Sync selected account
        </Button>
      </div>
      {reportingTimezone ? (
        <p className="mb-3 text-sm text-slate-600">
          Reporting timezone: {reportingTimezone}. Provider timestamps are stored in UTC.
        </p>
      ) : null}
      {syncMessage ? <p className="mb-3 text-sm text-slate-600">{syncMessage}</p> : null}

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {!brandId ? <p>Select a brand to view analytics.</p> : null}

      {overview ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Measured posts</CardTitle>
            </CardHeader>
            <CardContent>{overview.postsMeasured ?? 0}</CardContent>
          </Card>
          {Object.entries(overview.totals ?? {}).map(([key, value]) => (
            <Card key={key}>
              <CardHeader>
                <CardTitle>{key}</CardTitle>
              </CardHeader>
              <CardContent>{value.toLocaleString()}</CardContent>
            </Card>
          ))}
          {Object.entries(overview.derived ?? {})
            .filter(([, value]) => value !== null)
            .map(([key, value]) => (
              <Card key={key}>
                <CardHeader>
                  <CardTitle>{key}</CardTitle>
                </CardHeader>
                <CardContent>{Number(value).toFixed(2)}</CardContent>
              </Card>
            ))}
          {Object.entries(overview.byProvider ?? {}).map(([channel, metrics]) => (
            <Card key={channel}>
              <CardHeader>
                <CardTitle>{channel} comparison</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {Object.entries(metrics).map(([key, value]) => (
                  <p key={key}>
                    {key}: {value.toLocaleString()}
                  </p>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {attribution ? (
        <Card>
          <CardHeader>
            <CardTitle>Content attribution by {dimension.toLowerCase().replace("_", " ")}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {attribution.groups.length === 0 ? (
              <p className="text-sm text-slate-600">
                No provider observations are available for this range.
              </p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th>Group</th>
                    <th>Channels</th>
                    <th>Posts</th>
                    <th>Impressions</th>
                    <th>Reach</th>
                    <th>Views</th>
                    <th>Clicks</th>
                    <th>Engagement %</th>
                    <th>CTR %</th>
                  </tr>
                </thead>
                <tbody>
                  {attribution.groups.map((group) => (
                    <tr key={group.key} className="border-t">
                      <td>{group.label}</td>
                      <td>{group.providers.join(", ")}</td>
                      <td>{group.postsMeasured}</td>
                      <td>{group.totals.impressions?.toLocaleString() ?? "—"}</td>
                      <td>{group.totals.reach?.toLocaleString() ?? "—"}</td>
                      <td>{group.totals.views?.toLocaleString() ?? "—"}</td>
                      <td>{group.totals.clicks?.toLocaleString() ?? "—"}</td>
                      <td>{group.derived.engagementRate?.toFixed(2) ?? "—"}</td>
                      <td>{group.derived.clickThroughRate?.toFixed(2) ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      ) : null}

      {mode === "posts" || mode === "accounts" ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {mode === "accounts"
                ? "Account performance and follower growth"
                : "Post performance and video metrics"}
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {rows.length === 0 ? (
              <p className="text-sm text-slate-600">
                No provider observations are available for this range.
              </p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th>Provider</th>
                    <th>Metric</th>
                    <th>Value</th>
                    <th>Measured</th>
                    <th>Content</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={`${String(row.id)}-${index}`} className="border-t">
                      <td>{String(row.provider)}</td>
                      <td>{String(row.metricType)}</td>
                      <td>{Number(row.metricValue).toLocaleString()}</td>
                      <td>{new Date(String(row.measuredAt)).toLocaleString()}</td>
                      <td>
                        {String((row.attribution as { title?: string } | undefined)?.title ?? "")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      ) : null}

      {mode === "export" && brandId && organisationId ? (
        <Card>
          <CardHeader>
            <CardTitle>Tenant-scoped export</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {(["POST", "ACCOUNT", "ATTRIBUTION"] as const).flatMap((scope) =>
              (["CSV", "JSON"] as const).map((format) => (
                <a
                  key={`${scope}-${format}`}
                  className="rounded-md border px-3 py-2 text-sm"
                  href={`/api/brands/${brandId}/analytics/social/export?${query}&scope=${scope}&format=${format}`}
                >
                  {scope} {format}
                </a>
              )),
            )}
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
