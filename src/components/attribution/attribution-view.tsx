"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { apiFetch } from "@/lib/api/client";
import { ATTRIBUTION_DISCLAIMER } from "@/lib/attribution/constants";

export type AttributionMode = "overview" | "journeys" | "models" | "conversions" | "compare";

const nav: Array<{ label: string; href: string; mode: AttributionMode }> = [
  { label: "Overview", href: "/analytics/attribution", mode: "overview" },
  { label: "Journeys", href: "/analytics/attribution/journeys", mode: "journeys" },
  { label: "Models", href: "/analytics/attribution/models", mode: "models" },
  { label: "Conversions", href: "/analytics/attribution/conversions", mode: "conversions" },
  { label: "Compare", href: "/analytics/attribution/compare", mode: "compare" },
];

export function AttributionAnalyticsView({ mode }: { mode: AttributionMode }) {
  const { preference } = useWorkspace();
  const brandId = preference.currentBrandId;
  const organisationId = preference.currentOrganisationId;
  const [days, setDays] = useState("28");
  const [data, setData] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);

  const query = useMemo(() => {
    const to = new Date();
    const from = new Date(to.getTime() - Number(days) * 86_400_000);
    const params = new URLSearchParams({
      organisationId: organisationId ?? "",
      section: mode === "compare" ? "compare" : mode,
      from: from.toISOString(),
      to: to.toISOString(),
    });
    if (mode === "compare" && selectedModels.length > 0) {
      params.set("modelIds", selectedModels.join(","));
    }
    return params.toString();
  }, [organisationId, days, mode, selectedModels]);

  const load = useCallback(async () => {
    if (!brandId || !organisationId) return;
    try {
      setData(await apiFetch(`/api/brands/${brandId}/attribution/analytics?${query}`, { organisationId }));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load attribution analytics.");
    }
  }, [brandId, organisationId, query]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (mode !== "compare" || !brandId || !organisationId) return;
    void apiFetch<{ models: Array<{ id: string; name: string }> }>(
      `/api/brands/${brandId}/attribution/analytics?organisationId=${organisationId}&section=models`,
      { organisationId },
    ).then((result) => {
      setSelectedModels(result.models.slice(0, 3).map((m) => m.id));
    }).catch(() => undefined);
  }, [mode, brandId, organisationId]);

  async function runAttribution() {
    if (!brandId || !organisationId) return;
    setRunning(true);
    try {
      await apiFetch(`/api/brands/${brandId}/attribution/runs?organisationId=${organisationId}&days=${days}`, {
        method: "POST",
        organisationId,
        body: JSON.stringify({ triggerReason: "MANUAL" }),
      });
      await load();
    } catch {
      setError("Attribution run failed.");
    } finally {
      setRunning(false);
    }
  }

  const overview =
    mode === "overview" && data && typeof data === "object" && "overview" in data
      ? (data as { overview: Record<string, unknown> }).overview
      : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketing attribution"
        description="Transparent, versioned attribution models connecting touchpoints to conversions. Attribution is analytical — not proof of causation."
        breadcrumbs={[{ label: "Analytics", href: "/analytics/attribution" }, { label: mode }]}
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
      <div className="flex flex-wrap items-center gap-3">
        <select
          className="rounded-md border px-3 py-2 text-sm"
          value={days}
          onChange={(e) => setDays(e.target.value)}
        >
          {["7", "14", "28", "90"].map((v) => (
            <option key={v} value={v}>
              Last {v} days
            </option>
          ))}
        </select>
        <Button size="sm" disabled={running} onClick={() => void runAttribution()}>
          {running ? "Running…" : "Run attribution"}
        </Button>
      </div>
      <p className="rounded border border-border bg-surface-subtle p-3 text-sm text-foreground-muted">
        {ATTRIBUTION_DISCLAIMER}
      </p>
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {mode === "overview" && overview && (
        <>
          {overview.directTrafficPolicy ? (
            <p className="text-sm text-muted-foreground">
              Direct traffic policy: <Badge variant="muted">{String(overview.directTrafficPolicy)}</Badge>
            </p>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              ["Attributed conversions", overview.attributedConversions, "number"],
              ["Attributed revenue", overview.attributedRevenue, "currency"],
              ["Unattributed", overview.unattributedConversions, "number"],
              ["Channels", (overview.channelBreakdown as unknown[])?.length ?? 0, "number"],
            ].map(([label, value, type]) => (
              <Card key={String(label)}>
                <CardHeader>
                  <CardTitle className="text-base">{String(label)}</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold">
                  {type === "currency"
                    ? Number(value ?? 0).toLocaleString(undefined, { style: "currency", currency: "USD" })
                    : Number(value ?? 0).toLocaleString()}
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Credit by channel</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2">Channel</th>
                    <th>Credit %</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {((overview.channelBreakdown as Array<Record<string, unknown>>) ?? []).map((row) => (
                    <tr key={String(row.channel)} className="border-b">
                      <td className="py-2">{String(row.channel)}</td>
                      <td>{Number(row.creditPercent ?? 0).toFixed(2)}%</td>
                      <td>{Number(row.creditValue ?? 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}

      {mode === "journeys" && data && typeof data === "object" && "journeys" in data ? (
        <Card>
          <CardHeader>
            <CardTitle>Journey explorer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {((data as { journeys: Array<Record<string, unknown>> }).journeys ?? []).map((journey) => (
              <div key={String(journey.id)} className="rounded border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{String(journey.conversionType)}</span>
                  <Badge>{String(journey.status)}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {String(journey.touchpointCount)} touchpoints
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Policy: {String(journey.directTrafficPolicy)}
                </p>
                <ol className="mt-3 space-y-1 text-sm">
                  {((journey.touchpoints as Array<Record<string, unknown>>) ?? []).map((tp) => (
                    <li key={String(tp.id)}>
                      {String(tp.position)}. {String(tp.channel ?? tp.source)} — {String(tp.campaign ?? "—")}{" "}
                      <span className="text-muted-foreground">({String(tp.occurredAt)})</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {mode === "models" && data && typeof data === "object" && "models" in data ? (
        <Card>
          <CardHeader>
            <CardTitle>Attribution models</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2">Model</th>
                  <th>Type</th>
                  <th>Lookback</th>
                  <th>Direct policy</th>
                </tr>
              </thead>
              <tbody>
                {((data as { models: Array<Record<string, unknown>> }).models ?? []).map((model) => (
                  <tr key={String(model.id)} className="border-b">
                    <td className="py-2">
                      {String(model.name)}
                      {model.isDefault ? <Badge className="ml-2">Default</Badge> : null}
                    </td>
                    <td>{String(model.modelLabel)}</td>
                    <td>{String(model.lookbackWindowDays)} days</td>
                    <td>{String(model.directTrafficPolicyLabel)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}

      {mode === "conversions" && data && typeof data === "object" && "conversions" in data ? (
        <Card>
          <CardHeader>
            <CardTitle>Attributed conversions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {((data as { conversions: Array<Record<string, unknown>> }).conversions ?? []).map((conv) => (
              <div key={String(conv.id)} className="rounded border p-4 text-sm">
                <div className="flex flex-wrap gap-2">
                  <span className="font-medium">{String(conv.conversionType)}</span>
                  <Badge variant="muted">{String(conv.model)} v{String(conv.modelVersion)}</Badge>
                </div>
                <p>Revenue: {Number(conv.revenueValue ?? 0).toLocaleString()} {String(conv.revenueCurrency ?? "")}</p>
                <p className="text-muted-foreground">Policy: {String(conv.directTrafficPolicy ?? "—")}</p>
                <ul className="mt-2">
                  {((conv.credits as Array<Record<string, unknown>>) ?? []).map((c, i) => (
                    <li key={i}>
                      {String(c.channel)} — {Number(c.creditPercent).toFixed(2)}% (
                      {Number(c.creditValue ?? 0).toLocaleString()})
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {mode === "compare" && data && typeof data === "object" && "comparison" in data ? (
        <Card>
          <CardHeader>
            <CardTitle>Model comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              {String((data as { comparison: { disclaimer: string } }).comparison.disclaimer)}
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              {((data as { comparison: { models: Array<Record<string, unknown>> } }).comparison.models ?? []).map(
                (model) => (
                  <div key={String(model.modelId)} className="rounded border p-4">
                    <h3 className="font-medium">{String(model.modelName)}</h3>
                    <p className="text-sm text-muted-foreground">{String(model.modelLabel)}</p>
                    <p className="text-xs text-muted-foreground">{String(model.directTrafficPolicy)}</p>
                    <ul className="mt-2 text-sm">
                      {((model.channelBreakdown as Array<Record<string, unknown>>) ?? []).map((row) => (
                        <li key={String(row.channel)}>
                          {String(row.channel)}: {Number(row.creditValue ?? 0).toLocaleString()}
                        </li>
                      ))}
                    </ul>
                  </div>
                ),
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
