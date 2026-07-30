"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { apiFetch } from "@/lib/api/client";

export type WarehouseViewMode =
  | "sources"
  | "health"
  | "batches"
  | "quality"
  | "conversions"
  | "metrics"
  | "lineage";

const nav: Array<{ label: string; href: string; mode: WarehouseViewMode }> = [
  { label: "Overview", href: "/data", mode: "sources" },
  { label: "Sources", href: "/data/sources", mode: "sources" },
  { label: "GA4", href: "/data/sources/ga4", mode: "sources" },
  { label: "Health", href: "/data/health", mode: "health" },
  { label: "Batches", href: "/data/batches", mode: "batches" },
  { label: "Quality", href: "/data/quality", mode: "quality" },
  { label: "Conversions", href: "/data/conversions", mode: "conversions" },
  { label: "Metrics", href: "/data/metrics", mode: "metrics" },
  { label: "Lineage", href: "/data/lineage", mode: "lineage" },
  { label: "Tracking", href: "/data/tracking", mode: "sources" },
];

function defaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function MarketingWarehouseView({ mode }: { mode: WarehouseViewMode }) {
  const { preference } = useWorkspace();
  const brandId = preference.currentBrandId;
  const organisationId = preference.currentOrganisationId;
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [sources, setSources] = useState<Array<Record<string, unknown>>>([]);
  const [accounts, setAccounts] = useState<Array<Record<string, unknown>>>([]);
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [batches, setBatches] = useState<Array<Record<string, unknown>>>([]);
  const [qualityIssues, setQualityIssues] = useState<Array<Record<string, unknown>>>([]);
  const [conversions, setConversions] = useState<Array<Record<string, unknown>>>([]);
  const [metrics, setMetrics] = useState<Array<Record<string, unknown>>>([]);
  const [importCsv, setImportCsv] = useState("metricKey,value,observedAt\nsessions,120,2026-07-29T00:00:00.000Z");

  const queryBase = useMemo(() => {
    const params = new URLSearchParams({ organisationId: organisationId ?? "" });
    if (brandId) params.set("brandId", brandId);
    return params;
  }, [organisationId, brandId]);

  const load = useCallback(async () => {
    if (!brandId || !organisationId) return;
    setLoading(true);
    try {
      if (mode === "sources" || mode === "lineage") {
        const data = await apiFetch<{ sources: Array<Record<string, unknown>>; accounts: Array<Record<string, unknown>> }>(
          `/api/data-warehouse/sources?${queryBase}`,
          { organisationId },
        );
        setSources(data.sources);
        setAccounts(data.accounts);
      }
      if (mode === "health") {
        setHealth(
          await apiFetch<Record<string, unknown>>(`/api/data-warehouse/health?${queryBase}`, {
            organisationId,
          }),
        );
      }
      if (mode === "batches") {
        const data = await apiFetch<{ items: Array<Record<string, unknown>> }>(
          `/api/data-warehouse/batches?${queryBase}`,
          { organisationId },
        );
        setBatches(data.items);
      }
      if (mode === "quality") {
        const data = await apiFetch<{ items: Array<Record<string, unknown>> }>(
          `/api/data-warehouse/quality?${queryBase}`,
          { organisationId },
        );
        setQualityIssues(data.items);
      }
      if (mode === "conversions") {
        const data = await apiFetch<{ items: Array<Record<string, unknown>> }>(
          `/api/data-warehouse/conversions?${queryBase}`,
          { organisationId },
        );
        setConversions(data.items);
      }
      if (mode === "metrics") {
        const range = defaultDateRange();
        const params = new URLSearchParams(queryBase);
        params.set("from", range.from);
        params.set("to", range.to);
        const data = await apiFetch<{ items: Array<Record<string, unknown>> }>(
          `/api/data-warehouse/metrics?${params}`,
          { organisationId },
        );
        setMetrics(data.items);
      }
    } finally {
      setLoading(false);
    }
  }, [brandId, organisationId, mode, queryBase]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createTestBatch() {
    if (!brandId || !organisationId) return;
    try {
      await apiFetch(`/api/data-warehouse/batches?organisationId=${organisationId}`, {
        method: "POST",
        organisationId,
        body: JSON.stringify({
          brandId,
          idempotencyKey: `test-batch:${Date.now()}`,
          syncType: "MANUAL",
          records: [
            {
              providerRecordId: `test-${Date.now()}`,
              recordType: "metric",
              payload: { sessions: 42, pageviews: 100 },
            },
          ],
        }),
      });
      setMessage("Test batch created and normalised.");
      await load();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Failed to create batch.");
    }
  }

  async function runQualityChecks() {
    if (!brandId || !organisationId) return;
    try {
      await apiFetch(`/api/data-warehouse/quality?organisationId=${organisationId}`, {
        method: "POST",
        organisationId,
        body: JSON.stringify({
          brandId,
          issueId: qualityIssues[0]?.id,
          action: "FALSE_POSITIVE",
          notes: "Reviewed from Data Hub UI",
        }),
      });
      setMessage("Quality action submitted.");
      await load();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Quality action failed.");
    }
  }

  async function previewImport() {
    if (!brandId || !organisationId) return;
    try {
      await apiFetch(`/api/data-warehouse/imports?organisationId=${organisationId}`, {
        method: "POST",
        organisationId,
        body: JSON.stringify({
          brandId,
          fileName: "manual-import.csv",
          csvContent: importCsv,
          idempotencyKey: `import:${Date.now()}`,
        }),
      });
      setMessage("Import validated. Confirm from API or extend UI to confirm.");
      await load();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Import failed.");
    }
  }

  const titleMap: Record<WarehouseViewMode, string> = {
    sources: "Data sources",
    health: "Source health",
    batches: "Ingestion batches",
    quality: "Data quality",
    conversions: "Conversion definitions",
    metrics: "Metric observations",
    lineage: "Data lineage",
  };

  return (
    <>
      <PageHeader
        title="Data Hub"
        description="Unified marketing data warehouse — sources, ingestion, quality, and cross-channel metrics."
        breadcrumbs={[{ label: "Data Hub", href: "/data" }, { label: titleMap[mode], href: `/data/${mode === "sources" ? "" : mode}`.replace(/\/$/, "") || "/data" }]}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {nav.map((item) => (
          <Link key={item.href} href={item.href}>
            <Button variant={item.mode === mode ? "primary" : "outline"} size="sm">
              {item.label}
            </Button>
          </Link>
        ))}
      </div>

      {message ? <p className="mb-3 text-sm text-slate-600">{message}</p> : null}
      {loading ? <p className="mb-3 text-sm text-slate-500">Loading…</p> : null}

      {(mode === "sources" || mode === "lineage") && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Source registry</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {sources.length === 0 ? (
                <p className="text-sm text-slate-600">No sources registered.</p>
              ) : (
                sources.map((source) => (
                  <div key={String(source.id)} className="rounded border p-2 text-sm">
                    <div className="font-medium">{String(source.displayName)}</div>
                    <div className="text-xs text-slate-500">{String(source.provider)}</div>
                    <Badge variant={source.isConnected ? "default" : "muted"}>
                      {source.isConnected ? "Connected" : "Not connected"}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{mode === "lineage" ? "Lineage (placeholder)" : "Brand accounts"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {mode === "lineage" ? (
                <p className="text-sm text-slate-600">
                  Lineage records are written during normalisation. A dedicated lineage explorer ships in Task 3.2.
                </p>
              ) : accounts.length === 0 ? (
                <p className="text-sm text-slate-600">No source accounts for this brand yet.</p>
              ) : (
                accounts.map((account) => (
                  <div key={String(account.id)} className="rounded border p-2 text-sm">
                    <div className="font-medium">
                      {String((account.marketingDataSource as { displayName?: string })?.displayName ?? account.id)}
                    </div>
                    <div className="text-xs text-slate-500">{String(account.status)}</div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {mode === "health" && (
        <Card>
          <CardHeader>
            <CardTitle>Freshness and sync health</CardTitle>
          </CardHeader>
          <CardContent>
            {health ? (
              <pre className="overflow-auto rounded bg-slate-50 p-3 text-xs">{JSON.stringify(health, null, 2)}</pre>
            ) : (
              <p className="text-sm text-slate-600">No health records yet.</p>
            )}
          </CardContent>
        </Card>
      )}

      {mode === "batches" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Raw ingestion batches</CardTitle>
            <Button size="sm" onClick={() => void createTestBatch()}>
              Create test batch
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {batches.length === 0 ? (
              <p className="text-sm text-slate-600">No batches yet.</p>
            ) : (
              batches.map((batch) => (
                <div key={String(batch.id)} className="rounded border p-2 text-sm">
                  <div className="font-medium">{String(batch.id)}</div>
                  <div className="text-xs text-slate-500">
                    {String(batch.status)} · {String(batch.recordsReceived)} received
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {mode === "quality" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Quality issues</CardTitle>
            <Button size="sm" variant="outline" onClick={() => void runQualityChecks()} disabled={!qualityIssues.length}>
              Resolve first issue
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {qualityIssues.length === 0 ? (
              <p className="text-sm text-slate-600">No open quality issues.</p>
            ) : (
              qualityIssues.map((issue) => (
                <div key={String(issue.id)} className="rounded border p-2 text-sm">
                  <div className="font-medium">{String(issue.message)}</div>
                  <div className="text-xs text-slate-500">
                    {String(issue.severity)} · {String(issue.status)}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {mode === "conversions" && (
        <Card>
          <CardHeader>
            <CardTitle>Conversion definitions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {conversions.length === 0 ? (
              <p className="text-sm text-slate-600">No conversion definitions yet.</p>
            ) : (
              conversions.map((conversion) => (
                <div key={String(conversion.id)} className="rounded border p-2 text-sm">
                  <div className="font-medium">{String(conversion.displayName)}</div>
                  <div className="text-xs text-slate-500">{String(conversion.conversionKey)}</div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {mode === "metrics" && (
        <Card>
          <CardHeader>
            <CardTitle>Metric observations (last 30 days)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {metrics.length === 0 ? (
              <p className="text-sm text-slate-600">No metrics in range. Create a test batch to seed data.</p>
            ) : (
              metrics.map((metric) => (
                <div key={String(metric.id)} className="rounded border p-2 text-sm">
                  <div className="font-medium">
                    {String(metric.metricKey)} = {String(metric.metricValue)}
                  </div>
                  <div className="text-xs text-slate-500">{String(metric.observedAt)}</div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {mode === "sources" && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Manual CSV import (preview)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input label="CSV content" value={importCsv} onChange={(event) => setImportCsv(event.target.value)} />
            <Button size="sm" onClick={() => void previewImport()}>
              Validate import
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  );
}
