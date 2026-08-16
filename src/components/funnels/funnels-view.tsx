"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { apiFetch } from "@/lib/api/client";
import { FUNNEL_DISCLAIMER } from "@/lib/funnel/constants";

export type FunnelMode = "list" | "new" | "detail" | "cohorts" | "segments";

export function FunnelsAnalyticsView({ mode }: { mode: FunnelMode }) {
  const { preference } = useWorkspace();
  const params = useParams();
  const funnelId = typeof params?.funnelId === "string" ? params.funnelId : undefined;
  const brandId = preference.currentBrandId;
  const organisationId = preference.currentOrganisationId;
  const [days, setDays] = useState("28");
  const [data, setData] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [creating, setCreating] = useState(false);

  const [newFunnel, setNewFunnel] = useState({
    name: "",
    countingMethod: "USER",
    steps: [{ name: "Visitor", stepType: "PAGE", matchingRules: { eventName: "page_view" } }],
  });

  const query = useMemo(() => {
    const to = new Date();
    const from = new Date(to.getTime() - Number(days) * 86_400_000);
    const params = new URLSearchParams({
      organisationId: organisationId ?? "",
      from: from.toISOString(),
      to: to.toISOString(),
    });
    if (mode === "detail" || mode === "cohorts" || mode === "segments") {
      params.set("section", mode === "detail" ? "detail" : mode);
      if (funnelId) params.set("funnelId", funnelId);
    } else if (mode === "list") {
      params.set("section", "overview");
    }
    return params.toString();
  }, [organisationId, days, mode, funnelId]);

  const load = useCallback(async () => {
    if (!brandId || !organisationId) return;
    try {
      if (mode === "new") {
        const templates = await apiFetch<{ templates: unknown[] }>(
          `/api/brands/${brandId}/funnels/analytics?organisationId=${organisationId}&section=templates`,
          { organisationId },
        );
        setData(templates);
      } else if (mode === "list") {
        const [overview, funnels] = await Promise.all([
          apiFetch(`/api/brands/${brandId}/funnels/analytics?${query}`, { organisationId }),
          apiFetch(`/api/brands/${brandId}/funnels?organisationId=${organisationId}`, { organisationId }),
        ]);
        setData({ overview, funnels });
      } else {
        setData(await apiFetch(`/api/brands/${brandId}/funnels/analytics?${query}`, { organisationId }));
      }
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load funnel analytics.");
    }
  }, [brandId, organisationId, query, mode]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runAnalysis() {
    if (!brandId || !organisationId || !funnelId) return;
    setRunning(true);
    try {
      await apiFetch(
        `/api/brands/${brandId}/funnels/${funnelId}/runs?organisationId=${organisationId}&days=${days}`,
        { method: "POST", organisationId, body: JSON.stringify({}) },
      );
      await load();
    } catch {
      setError("Funnel analysis failed.");
    } finally {
      setRunning(false);
    }
  }

  async function createFunnel() {
    if (!brandId || !organisationId || !newFunnel.name) return;
    setCreating(true);
    try {
      await apiFetch(`/api/brands/${brandId}/funnels?organisationId=${organisationId}`, {
        method: "POST",
        organisationId,
        body: JSON.stringify(newFunnel),
      });
      window.location.href = "/analytics/funnels";
    } catch {
      setError("Failed to create funnel.");
    } finally {
      setCreating(false);
    }
  }

  async function createFromTemplate(templateType: string) {
    if (!brandId || !organisationId) return;
    setCreating(true);
    try {
      await apiFetch(`/api/brands/${brandId}/funnels/templates?organisationId=${organisationId}`, {
        method: "POST",
        organisationId,
        body: JSON.stringify({ templateType }),
      });
      window.location.href = "/analytics/funnels";
    } catch {
      setError("Template is only available for the Cresco internal organisation.");
    } finally {
      setCreating(false);
    }
  }

  const detail =
    data && typeof data === "object" && "detail" in data
      ? (data as { detail: Record<string, unknown> }).detail
      : null;

  const analysis = detail?.analysis as Record<string, unknown> | null;
  const stepResults = (analysis?.stepResults as Array<Record<string, unknown>>) ?? [];
  const maxCompletions = Math.max(...stepResults.map((s) => Number(s.completions ?? 0)), 1);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Conversion funnels"
        description="Define, measure and diagnose where visitors and leads leave their conversion journey."
        breadcrumbs={[{ label: "Analytics", href: "/analytics/funnels" }, { label: mode }]}
      />
      <nav className="flex flex-wrap gap-2">
        <Link href="/analytics/funnels">
          <Button variant={mode === "list" ? "primary" : "outline"} size="sm">All funnels</Button>
        </Link>
        <Link href="/analytics/funnels/new">
          <Button variant={mode === "new" ? "primary" : "outline"} size="sm">New funnel</Button>
        </Link>
        {funnelId ? (
          <>
            <Link href={`/analytics/funnels/${funnelId}`}>
              <Button variant={mode === "detail" ? "primary" : "outline"} size="sm">Overview</Button>
            </Link>
            <Link href={`/analytics/funnels/${funnelId}/cohorts`}>
              <Button variant={mode === "cohorts" ? "primary" : "outline"} size="sm">Cohorts</Button>
            </Link>
            <Link href={`/analytics/funnels/${funnelId}/segments`}>
              <Button variant={mode === "segments" ? "primary" : "outline"} size="sm">Segments</Button>
            </Link>
          </>
        ) : null}
      </nav>

      {mode !== "new" && mode !== "list" ? (
        <div className="flex flex-wrap items-center gap-3">
          <select className="rounded-md border px-3 py-2 text-sm" value={days} onChange={(e) => setDays(e.target.value)}>
            {["7", "14", "28", "90"].map((v) => (
              <option key={v} value={v}>Last {v} days</option>
            ))}
          </select>
          <Button size="sm" disabled={running} onClick={() => void runAnalysis()}>
            {running ? "Analysing…" : "Run analysis"}
          </Button>
        </div>
      ) : null}

      <p className="rounded border border-border bg-surface-subtle p-3 text-sm text-foreground-muted">{FUNNEL_DISCLAIMER}</p>
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {mode === "list" && data && typeof data === "object" && "funnels" in data ? (
        <Card>
          <CardHeader><CardTitle>Funnels</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2">Name</th>
                  <th>Counting</th>
                  <th>Steps</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {((data as { funnels: { funnels: Array<Record<string, unknown>> } }).funnels.funnels ?? []).map((f) => (
                  <tr key={String(f.id)} className="border-b">
                    <td className="py-2">
                      {String(f.name)}
                      {f.isTemplate ? <Badge className="ml-2">Template</Badge> : null}
                    </td>
                    <td>{String(f.countingMethod)}</td>
                    <td>{((f.versions as Array<{ steps: unknown[] }>)?.[0]?.steps ?? []).length}</td>
                    <td>
                      <Link href={`/analytics/funnels/${String(f.id)}`}>
                        <Button size="sm" variant="outline">View</Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}

      {mode === "new" ? (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Custom funnel</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <input
                className="w-full rounded border px-3 py-2 text-sm"
                placeholder="Funnel name"
                value={newFunnel.name}
                onChange={(e) => setNewFunnel({ ...newFunnel, name: e.target.value })}
              />
              <select
                className="w-full rounded border px-3 py-2 text-sm"
                value={newFunnel.countingMethod}
                onChange={(e) => setNewFunnel({ ...newFunnel, countingMethod: e.target.value })}
              >
                <option value="USER">Unique users</option>
                <option value="SESSION">Sessions</option>
                <option value="EVENT">Events</option>
              </select>
              <Button disabled={creating} onClick={() => void createFunnel()}>Create funnel</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Cresco templates</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground">Templates are only available for the Cresco internal organisation.</p>
              {((data as { templates?: Array<Record<string, unknown>> })?.templates ?? []).map((t) => (
                <div key={String(t.templateType)} className="rounded border p-3">
                  <p className="font-medium">{String(t.name)}</p>
                  <p className="text-muted-foreground">{String(t.description)}</p>
                  <Button
                    size="sm"
                    className="mt-2"
                    disabled={creating}
                    onClick={() => void createFromTemplate(String(t.templateType))}
                  >
                    Use template
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {mode === "detail" && detail ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader><CardTitle className="text-base">Entrants</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold">{Number(analysis?.entrants ?? 0)}</CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Conversions</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold">{Number(analysis?.totalConversions ?? 0)}</CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Counting method</CardTitle></CardHeader>
              <CardContent>{String((detail.funnel as Record<string, unknown>)?.countingMethodLabel ?? "—")}</CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Visual funnel</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {stepResults.map((step) => (
                <div key={String(step.stepOrder)} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{String(step.stepName)}</span>
                    <span>{Number(step.completions)} ({Number(step.cumulativeConversion).toFixed(1)}%)</span>
                  </div>
                  <div className="h-3 rounded bg-surface-hover">
                    <div
                      className="h-3 rounded bg-blue-500"
                      style={{ width: `${(Number(step.completions) / maxCompletions) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Step table</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2">Step</th>
                    <th>Entrants</th>
                    <th>Completions</th>
                    <th>Step conv.</th>
                    <th>Cumulative</th>
                    <th>Drop-off</th>
                  </tr>
                </thead>
                <tbody>
                  {stepResults.map((step) => (
                    <tr key={String(step.stepOrder)} className="border-b">
                      <td className="py-2">{String(step.stepName)}</td>
                      <td>{Number(step.entrants)}</td>
                      <td>{Number(step.completions)}</td>
                      <td>{Number(step.stepConversion).toFixed(1)}%</td>
                      <td>{Number(step.cumulativeConversion).toFixed(1)}%</td>
                      <td>{Number(step.dropOffRate).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {((analysis?.insights as Array<Record<string, unknown>>) ?? []).length > 0 ? (
            <Card>
              <CardHeader><CardTitle>Diagnostic insights</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {((analysis?.insights as Array<Record<string, unknown>>) ?? []).map((insight, i) => (
                  <p key={i} className="text-sm">
                    <Badge variant={insight.severity === "warning" ? "warning" : "muted"}>
                      {String(insight.type)}
                    </Badge>{" "}
                    {String(insight.message)}
                  </p>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {((analysis?.dataQualityWarnings as string[]) ?? []).length > 0 ? (
            <Card>
              <CardHeader><CardTitle>Data quality warnings</CardTitle></CardHeader>
              <CardContent>
                <ul className="list-disc pl-5 text-sm text-amber-800">
                  {((analysis?.dataQualityWarnings as string[]) ?? []).map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}

      {mode === "cohorts" && data && typeof data === "object" && "cohorts" in data ? (
        <Card>
          <CardHeader><CardTitle>Cohort comparison</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2">Cohort</th>
                  <th>Entrants</th>
                  <th>Conversions</th>
                  <th>Rate</th>
                </tr>
              </thead>
              <tbody>
                {((data as { cohorts: Array<Record<string, unknown>> }).cohorts ?? []).map((c) => (
                  <tr key={String(c.cohortDate)} className="border-b">
                    <td className="py-2">{String(c.cohortDate)}</td>
                    <td>{Number(c.entrants)}</td>
                    <td>{Number(c.totalConversions)}</td>
                    <td>{Number(c.conversionRate).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}

      {mode === "segments" && data && typeof data === "object" && "segments" in data ? (
        <Card>
          <CardHeader><CardTitle>Segment comparison</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2">Dimension</th>
                  <th>Segment</th>
                  <th>Entrants</th>
                  <th>Conversions</th>
                  <th>Rate</th>
                </tr>
              </thead>
              <tbody>
                {((data as { segments: Array<Record<string, unknown>> }).segments ?? []).map((s, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-2">{String(s.dimensionLabel)}</td>
                    <td>{String(s.segmentValue)}</td>
                    <td>{Number(s.entrants)}</td>
                    <td>{Number(s.completions)}</td>
                    <td>{Number(s.conversionRate).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
