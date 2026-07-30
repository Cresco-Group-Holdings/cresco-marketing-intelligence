"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { apiFetch } from "@/lib/api/client";

export type PipelinesViewMode =
  | "pipelines"
  | "pipelineDetail"
  | "opportunities"
  | "opportunityNew"
  | "opportunityDetail"
  | "forecast"
  | "health";

type Props = { mode: PipelinesViewMode; pipelineId?: string; opportunityId?: string };

export function PipelinesView({ mode, pipelineId, opportunityId }: Props) {
  const { preference } = useWorkspace();
  const brandId = preference.currentBrandId;
  const organisationId = preference.currentOrganisationId;
  const base = brandId ? `/api/brands/${brandId}/crm/pipelines` : null;

  const [pipelines, setPipelines] = useState<Array<Record<string, unknown>>>([]);
  const [pipeline, setPipeline] = useState<Record<string, unknown> | null>(null);
  const [opportunities, setOpportunities] = useState<Array<Record<string, unknown>>>([]);
  const [opportunity, setOpportunity] = useState<Record<string, unknown> | null>(null);
  const [kanban, setKanban] = useState<Array<Record<string, unknown>>>([]);
  const [forecast, setForecast] = useState<Record<string, unknown> | null>(null);
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [pipelineType, setPipelineType] = useState("CUSTOM");
  const [oppName, setOppName] = useState("");
  const [selectedPipeline, setSelectedPipeline] = useState("");
  const [expectedValue, setExpectedValue] = useState("");
  const [evidenceRef, setEvidenceRef] = useState("");
  const [lossReasonId, setLossReasonId] = useState("");
  const [oppTasks, setOppTasks] = useState<Array<Record<string, unknown>>>([]);
  const [nextActionTitle, setNextActionTitle] = useState("");

  const loadData = useCallback(async () => {
    if (!base || !organisationId) return;
    setLoading(true);
    try {
      if (mode === "pipelines") {
        const res = await apiFetch<{ pipelines: Array<Record<string, unknown>> }>(`${base}?organisationId=${organisationId}&resource=pipelines`);
        setPipelines(res.pipelines);
      } else if (mode === "pipelineDetail" && pipelineId) {
        const [pRes, kRes] = await Promise.all([
          apiFetch<{ pipeline: Record<string, unknown> }>(`${base}?organisationId=${organisationId}&pipelineId=${pipelineId}`),
          apiFetch<{ kanban: Array<Record<string, unknown>> }>(`${base}?organisationId=${organisationId}&pipelineId=${pipelineId}&view=kanban`),
        ]);
        setPipeline(pRes.pipeline);
        setKanban(kRes.kanban);
      } else if (mode === "opportunities") {
        const res = await apiFetch<{ opportunities: Array<Record<string, unknown>> }>(`${base}?organisationId=${organisationId}`);
        setOpportunities(res.opportunities);
        const pRes = await apiFetch<{ pipelines: Array<Record<string, unknown>> }>(`${base}?organisationId=${organisationId}&resource=pipelines`);
        setPipelines(pRes.pipelines);
      } else if (mode === "opportunityDetail" && opportunityId) {
        const [res, tasksRes] = await Promise.all([
          apiFetch<{ opportunity: Record<string, unknown> }>(`${base}?organisationId=${organisationId}&opportunityId=${opportunityId}`),
          apiFetch<{ tasks: Array<Record<string, unknown>> }>(`/api/brands/${brandId}/crm/tasks?organisationId=${organisationId}&opportunityId=${opportunityId}`),
        ]);
        setOpportunity(res.opportunity);
        setOppTasks(tasksRes.tasks);
        setNextActionTitle(String(res.opportunity.nextAction ?? ""));
      } else if (mode === "forecast") {
        const res = await apiFetch<{ forecast: Record<string, unknown> }>(`${base}?organisationId=${organisationId}&view=forecast`);
        setForecast(res.forecast);
      } else if (mode === "health") {
        const res = await apiFetch<{ health: Record<string, unknown> }>(`${base}?organisationId=${organisationId}&view=health`);
        setHealth(res.health);
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, [base, organisationId, mode, pipelineId, opportunityId]);

  useEffect(() => { loadData(); }, [loadData]);

  async function postAction(body: Record<string, unknown>) {
    if (!base || !organisationId) return;
    setLoading(true);
    setMessage(null);
    try {
      await apiFetch(`${base}?organisationId=${organisationId}`, { method: "POST", body: JSON.stringify(body) });
      setMessage("Action completed.");
      await loadData();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setLoading(false);
    }
  }

  const nav = (
    <nav className="flex flex-wrap gap-2 border-b pb-3 mb-6">
      <Link href="/crm/pipelines" className={`rounded-md px-3 py-1.5 text-sm ${mode === "pipelines" || mode === "pipelineDetail" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>Pipelines</Link>
      <Link href="/crm/opportunities" className={`rounded-md px-3 py-1.5 text-sm ${mode === "opportunities" || mode === "opportunityNew" || mode === "opportunityDetail" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>Opportunities</Link>
      <Link href="/crm/forecast" className={`rounded-md px-3 py-1.5 text-sm ${mode === "forecast" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>Forecast</Link>
      <Link href="/crm/pipeline-health" className={`rounded-md px-3 py-1.5 text-sm ${mode === "health" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>Health</Link>
    </nav>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Sales Pipeline" description="Configurable pipelines, opportunities, forecasting, and health signals." />
      {nav}
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {mode === "pipelines" && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Create pipeline</CardTitle></CardHeader>
            <CardContent className="space-y-3 max-w-lg">
              <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Cresco Grants" />
              <Input label="Slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="cresco-grants" />
              <Input label="Type" value={pipelineType} onChange={(e) => setPipelineType(e.target.value)} placeholder="GRANTS_SUBSCRIPTION" />
              <Button onClick={() => postAction({ action: "createPipeline", name, slug, pipelineType, template: pipelineType })}>Create pipeline</Button>
            </CardContent>
          </Card>
          <div className="space-y-2">
            {pipelines.map((p) => (
              <Card key={String(p.id)}>
                <CardContent className="flex justify-between py-4">
                  <Link href={`/crm/pipelines/${p.id}`} className="font-medium hover:underline">{String(p.name)}</Link>
                  <div className="flex gap-2">
                    <Badge variant="muted">{String(p.pipelineType)}</Badge>
                    <Badge variant="muted">{String((p._count as Record<string, number>)?.opportunities ?? 0)} opps</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {mode === "pipelineDetail" && pipeline && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{String(pipeline.name)}</h2>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {kanban.map((col) => {
              const stage = col.stage as Record<string, unknown>;
              const opps = (col.opportunities as Array<Record<string, unknown>>) ?? [];
              return (
                <div key={String(stage.id)} className="min-w-[240px] bg-muted/50 rounded-lg p-3">
                  <h3 className="font-medium text-sm mb-2">{String(stage.name)}</h3>
                  <div className="space-y-2">
                    {opps.map((o) => (
                      <Link key={String(o.id)} href={`/crm/opportunities/${o.id}`}>
                        <Card><CardContent className="py-2 text-sm">{String(o.name)}</CardContent></Card>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {mode === "opportunities" && (
        <div className="space-y-4">
          <Link href="/crm/opportunities/new"><Button>New opportunity</Button></Link>
          <div className="space-y-2">
            {opportunities.map((o) => (
              <Card key={String(o.id)}>
                <CardContent className="flex justify-between py-4">
                  <Link href={`/crm/opportunities/${o.id}`} className="font-medium hover:underline">{String(o.name)}</Link>
                  <div className="flex gap-2">
                    <Badge>{String(o.status)}</Badge>
                    <Badge variant="muted">{Number(o.probability)}%</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {mode === "opportunityNew" && (
        <Card>
          <CardHeader><CardTitle>New opportunity</CardTitle></CardHeader>
          <CardContent className="space-y-3 max-w-lg">
            <Input label="Name" value={oppName} onChange={(e) => setOppName(e.target.value)} />
            <Input label="Pipeline ID" value={selectedPipeline} onChange={(e) => setSelectedPipeline(e.target.value)} />
            <Input label="Expected value" value={expectedValue} onChange={(e) => setExpectedValue(e.target.value)} />
            <Button onClick={() => postAction({ action: "createOpportunity", pipelineId: selectedPipeline, name: oppName, expectedValue: Number(expectedValue) || undefined })}>Create</Button>
          </CardContent>
        </Card>
      )}

      {mode === "opportunityDetail" && opportunity && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>{String(opportunity.name)}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Badge>{String(opportunity.status)}</Badge>
                <Badge variant="muted">{Number(opportunity.probability)}% probability</Badge>
              </div>
              {opportunity.product ? <p className="text-sm">Product: {String(opportunity.product)}</p> : null}
              {opportunity.expectedCloseDate ? <p className="text-sm">Close: {new Date(String(opportunity.expectedCloseDate)).toLocaleDateString()}</p> : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Next action</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {opportunity.nextAction ? <p className="text-sm">{String(opportunity.nextAction)}</p> : <p className="text-sm text-muted-foreground">No next action set.</p>}
              <Input label="Create task" value={nextActionTitle} onChange={(e) => setNextActionTitle(e.target.value)} placeholder="Send proposal follow-up" />
              <Button variant="outline" className="w-full" onClick={async () => {
                if (!brandId || !organisationId || !nextActionTitle) return;
                await apiFetch(`/api/brands/${brandId}/crm/tasks?organisationId=${organisationId}`, {
                  method: "POST",
                  body: JSON.stringify({ action: "createTask", title: nextActionTitle, taskTypeCode: "FOLLOW_UP", opportunityId }),
                });
                setNextActionTitle("");
                await loadData();
              }}>Set next action task</Button>
              {oppTasks.map((t) => (
                <p key={String(t.id)} className="text-sm text-muted-foreground">{String(t.title)} — {String(t.displayStatus ?? t.status)}</p>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Input label="Won evidence ref" value={evidenceRef} onChange={(e) => setEvidenceRef(e.target.value)} />
              <Button variant="outline" className="w-full" onClick={() => postAction({ action: "markWon", opportunityId, evidenceType: "AUTHORISED_CONFIRMATION", evidenceReference: evidenceRef })}>Mark won</Button>
              <Input label="Loss reason ID" value={lossReasonId} onChange={(e) => setLossReasonId(e.target.value)} />
              <Button variant="outline" className="w-full" onClick={() => postAction({ action: "markLost", opportunityId, lossReasonId })}>Mark lost</Button>
            </CardContent>
          </Card>
        </div>
      )}

      {mode === "forecast" && forecast && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{String(forecast.disclaimer)}</p>
          <div className="grid gap-4 md:grid-cols-4">
            <Card><CardHeader><CardTitle className="text-sm">Open value</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">£{Number(forecast.totalOpenValue).toLocaleString()}</CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm">Weighted (estimate)</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">£{Math.round(Number(forecast.weightedValue)).toLocaleString()}</CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm">Won</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">£{Number(forecast.wonValue).toLocaleString()}</CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm">Avg cycle (days)</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{forecast.averageSalesCycleDays !== null ? String(forecast.averageSalesCycleDays) : "—"}</CardContent></Card>
          </div>
        </div>
      )}

      {mode === "health" && health && (
        <div className="space-y-2">
          {((health.signals as Array<Record<string, unknown>>) ?? []).map((s, i) => (
            <Card key={i}>
              <CardContent className="py-3 flex justify-between text-sm">
                <span>{String(s.message)}</span>
                <Badge variant={s.severity === "CRITICAL" ? "default" : "muted"}>{String(s.severity)}</Badge>
              </CardContent>
            </Card>
          ))}
          {((health.signals as unknown[]) ?? []).length === 0 && <p className="text-sm text-muted-foreground">No health signals.</p>}
        </div>
      )}
    </div>
  );
}
