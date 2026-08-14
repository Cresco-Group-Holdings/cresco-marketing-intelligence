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

type ViewMode = "list" | "detail";

type Props = {
  mode: ViewMode;
  workflowId?: string;
};

export function AutomationEngineView({ mode, workflowId }: Props) {
  const { preference } = useWorkspace();
  const brandId = preference.currentBrandId;
  const organisationId = preference.currentOrganisationId;
  const base = brandId ? `/api/brands/${brandId}/automation-engine` : null;

  const [workflows, setWorkflows] = useState<Array<Record<string, unknown>>>([]);
  const [workflow, setWorkflow] = useState<Record<string, unknown> | null>(null);
  const [executions, setExecutions] = useState<Array<Record<string, unknown>>>([]);
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!base || !organisationId) return;
    setLoading(true);
    try {
      if (mode === "list") {
        const res = await apiFetch<{ workflows: Array<Record<string, unknown>> }>(
          `${base}?organisationId=${organisationId}`,
        );
        setWorkflows(res.workflows);
      } else if (mode === "detail" && workflowId) {
        const [wfRes, exRes] = await Promise.all([
          apiFetch<{ workflow: Record<string, unknown> }>(
            `${base}?organisationId=${organisationId}&workflowId=${workflowId}`,
          ),
          apiFetch<{ executions: Array<Record<string, unknown>> }>(
            `${base}?organisationId=${organisationId}&workflowId=${workflowId}&view=executions`,
          ),
        ]);
        setWorkflow(wfRes.workflow);
        setExecutions(exRes.executions);
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to load automation engine data.");
    } finally {
      setLoading(false);
    }
  }, [base, organisationId, mode, workflowId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function postAction(body: Record<string, unknown>) {
    if (!base || !organisationId) return;
    setLoading(true);
    setMessage(null);
    try {
      await apiFetch(`${base}?organisationId=${organisationId}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setMessage("Saved.");
      await loadData();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setLoading(false);
    }
  }

  const activeVersion = workflow?.activeVersion as Record<string, unknown> | undefined;
  const triggers = (activeVersion?.triggers as Array<Record<string, unknown>>) ?? [];
  const actions = (activeVersion?.actions as Array<Record<string, unknown>>) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Automation Engine"
        description="Provider-independent workflows that react to internal platform events with deterministic conditions and safe actions."
      />
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {mode === "list" && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Create workflow</CardTitle></CardHeader>
            <CardContent className="flex gap-2 max-w-lg">
              <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Campaign launch tasks" />
              <Button onClick={() => postAction({ action: "createWorkflow", name })}>Create</Button>
            </CardContent>
          </Card>
          <div className="space-y-2">
            {workflows.map((w) => (
              <Card key={String(w.id)}>
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <Link href={`/automation-engine/${w.id}`} className="font-medium hover:underline">
                      {String(w.name)}
                    </Link>
                    <div className="mt-1">
                      <Badge variant="muted">{String(w.status)}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {workflows.length === 0 && <p className="text-sm text-muted-foreground">No workflows yet.</p>}
          </div>
        </div>
      )}

      {mode === "detail" && workflow && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{String(workflow.name)}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Badge>{String(workflow.status)}</Badge>
              <div>
                <h3 className="text-sm font-medium mb-2">Triggers</h3>
                {triggers.map((t) => (
                  <p key={String(t.id)} className="text-sm text-muted-foreground">
                    {String(t.triggerKind)} — {String(t.eventType ?? t.scheduleCron)}
                  </p>
                ))}
                {triggers.length === 0 && <p className="text-sm text-muted-foreground">No triggers configured.</p>}
              </div>
              <div>
                <h3 className="text-sm font-medium mb-2">Actions</h3>
                {actions.map((a) => (
                  <p key={String(a.id)} className="text-sm text-muted-foreground">
                    {String(a.actionType)} (order {String(a.sortOrder)})
                  </p>
                ))}
                {actions.length === 0 && <p className="text-sm text-muted-foreground">No actions configured.</p>}
              </div>
            </CardContent>
          </Card>
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Lifecycle</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <Button className="w-full" variant="outline" onClick={() => postAction({
                  action: "saveVersion",
                  workflowId,
                  triggers: [{ triggerKind: "EVENT", eventType: "CAMPAIGN_ACTIVATED", isEnabled: true }],
                  conditions: [{ field: "campaign.status", operator: "equals", value: "ACTIVE" }],
                  actions: [{ actionType: "CREATE_TASK", config: { title: "Launch checklist" }, sortOrder: 0 }],
                })}>
                  Save example version
                </Button>
                <Button className="w-full" variant="outline" onClick={() => postAction({ action: "activateWorkflow", workflowId })}>
                  Activate
                </Button>
                <Button className="w-full" variant="outline" onClick={() => postAction({ action: "pauseWorkflow", workflowId })}>
                  Pause
                </Button>
                <Button className="w-full" variant="outline" onClick={() => postAction({
                  action: "dryRun",
                  workflowId,
                  payload: { campaign: { status: "ACTIVE" }, resourceId: "campaign-1" },
                })}>
                  Dry run
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Recent executions</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {executions.map((e) => (
                  <p key={String(e.id)} className="text-xs text-muted-foreground">
                    {String(e.status)} — {new Date(String(e.createdAt)).toLocaleString()}
                  </p>
                ))}
                {executions.length === 0 && <p className="text-sm text-muted-foreground">No executions yet.</p>}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
