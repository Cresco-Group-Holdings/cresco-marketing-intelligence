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
import { TRIGGER_TYPES } from "@/lib/marketing-automation/constants";

export type AutomationViewMode =
  | "list"
  | "new"
  | "detail"
  | "builder"
  | "enrollments"
  | "analytics"
  | "templates"
  | "errors";

type Props = { mode: AutomationViewMode; automationId?: string };

export function AutomationView({ mode, automationId }: Props) {
  const { preference } = useWorkspace();
  const brandId = preference.currentBrandId;
  const organisationId = preference.currentOrganisationId;
  const base = brandId ? `/api/brands/${brandId}/automation` : null;

  const [automations, setAutomations] = useState<Array<Record<string, unknown>>>([]);
  const [automation, setAutomation] = useState<Record<string, unknown> | null>(null);
  const [builder, setBuilder] = useState<Record<string, unknown> | null>(null);
  const [enrollments, setEnrollments] = useState<Array<Record<string, unknown>>>([]);
  const [analytics, setAnalytics] = useState<Record<string, unknown> | null>(null);
  const [templates, setTemplates] = useState<Array<Record<string, unknown>>>([]);
  const [errors, setErrors] = useState<Array<Record<string, unknown>>>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerType, setTriggerType] = useState("LEAD_CREATED");
  const [triggerConfig, setTriggerConfig] = useState("{}");
  const [testMode, setTestMode] = useState(false);
  const [leadId, setLeadId] = useState("");
  const [templateKey, setTemplateKey] = useState("");
  const [graphJson, setGraphJson] = useState(
  JSON.stringify({ nodes: [], edges: [] }, null, 2),
  );

  const loadData = useCallback(async () => {
    if (!base || !organisationId) return;
    setLoading(true);
    try {
      if (mode === "list" || mode === "new") {
        const res = await apiFetch<{ automations: Array<Record<string, unknown>> }>(
          `${base}?organisationId=${organisationId}`,
        );
        setAutomations(res.automations);
      } else if (mode === "templates") {
        const res = await apiFetch<{ templates: Array<Record<string, unknown>> }>(
          `${base}?organisationId=${organisationId}&view=templates`,
        );
        setTemplates(res.templates);
      } else if (mode === "errors") {
        const res = await apiFetch<{ errors: Array<Record<string, unknown>> }>(
          `${base}?organisationId=${organisationId}&view=errors`,
        );
        setErrors(res.errors);
      } else if (automationId) {
        const res = await apiFetch<{ automation: Record<string, unknown> }>(
          `${base}?organisationId=${organisationId}&automationId=${automationId}`,
        );
        setAutomation(res.automation);
        setTestMode(Boolean(res.automation.testMode));

        if (mode === "builder") {
          const bRes = await apiFetch<{ builder: Record<string, unknown> }>(
            `${base}?organisationId=${organisationId}&automationId=${automationId}&view=builder`,
          );
          setBuilder(bRes.builder);
          const version = bRes.builder.version as Record<string, unknown> | undefined;
          if (version) {
            const nodes = (version.nodes as Array<Record<string, unknown>>) ?? [];
            const edges = (version.edges as Array<Record<string, unknown>>) ?? [];
            setGraphJson(JSON.stringify({ nodes, edges }, null, 2));
          }
          const triggers = (version?.triggers as Array<Record<string, unknown>>) ?? [];
          if (triggers[0]) {
            setTriggerType(String(triggers[0].triggerType));
            setTriggerConfig(JSON.stringify(triggers[0].config ?? {}, null, 2));
          }
        } else if (mode === "enrollments") {
          const eRes = await apiFetch<{ enrollments: Array<Record<string, unknown>> }>(
            `${base}?organisationId=${organisationId}&automationId=${automationId}&view=enrollments`,
          );
          setEnrollments(eRes.enrollments);
        } else if (mode === "analytics") {
          const aRes = await apiFetch<{ analytics: Record<string, unknown> }>(
            `${base}?organisationId=${organisationId}&automationId=${automationId}&view=analytics`,
          );
          setAnalytics(aRes.analytics);
        }
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [base, organisationId, mode, automationId]);

  useEffect(() => { loadData(); }, [loadData]);

  async function postAction(body: Record<string, unknown>) {
    if (!base || !organisationId) return;
    setLoading(true);
    setMessage(null);
    try {
      await apiFetch(`${base}?organisationId=${organisationId}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setMessage("Action completed.");
      await loadData();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setLoading(false);
    }
  }

  const version = (builder?.version ?? automation?.activeVersion) as Record<string, unknown> | undefined;
  const validationMessages = (builder?.validationMessages as Array<Record<string, unknown>>) ?? [];
  const parsedGraph = (() => {
    try {
      return JSON.parse(graphJson) as { nodes: Array<Record<string, unknown>>; edges: Array<Record<string, unknown>> };
    } catch {
      return { nodes: [], edges: [] };
    }
  })();

  const nav = automationId ? (
    <nav className="flex flex-wrap gap-2 border-b pb-3 mb-6">
      <Link href={`/automation/${automationId}`} className={`rounded-md px-3 py-1.5 text-sm ${mode === "detail" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>Overview</Link>
      <Link href={`/automation/${automationId}/builder`} className={`rounded-md px-3 py-1.5 text-sm ${mode === "builder" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>Builder</Link>
      <Link href={`/automation/${automationId}/enrollments`} className={`rounded-md px-3 py-1.5 text-sm ${mode === "enrollments" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>Enrollments</Link>
      <Link href={`/automation/${automationId}/analytics`} className={`rounded-md px-3 py-1.5 text-sm ${mode === "analytics" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>Analytics</Link>
    </nav>
  ) : (
    <nav className="flex flex-wrap gap-2 border-b pb-3 mb-6">
      <Link href="/automation" className={`rounded-md px-3 py-1.5 text-sm ${mode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>All automations</Link>
      <Link href="/automation/new" className={`rounded-md px-3 py-1.5 text-sm ${mode === "new" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>New automation</Link>
      <Link href="/automation/templates" className={`rounded-md px-3 py-1.5 text-sm ${mode === "templates" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>Templates</Link>
      <Link href="/automation/errors" className={`rounded-md px-3 py-1.5 text-sm ${mode === "errors" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>Errors</Link>
    </nav>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketing Automation"
        description="Design customer journeys with triggers, conditions, and actions — with approval and enrollment controls."
      />
      {nav}
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {mode === "list" && (
        <div className="space-y-4">
          <Link href="/automation/new"><Button>New automation</Button></Link>
          {automations.length === 0 && !loading ? (
            <p className="text-sm text-muted-foreground">No automations yet.</p>
          ) : null}
          {automations.map((a) => (
            <Card key={String(a.id)}>
              <CardContent className="py-4 flex justify-between items-center">
                <Link href={`/automation/${a.id}`} className="font-medium hover:underline">{String(a.name)}</Link>
                <div className="flex gap-2 items-center">
                  {a.testMode ? <Badge variant="muted">Test mode</Badge> : null}
                  <Badge variant="muted">{String(a.repeatEnrollmentPolicy ?? "ONE_TIME")}</Badge>
                  <Badge>{String(a.status)}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {mode === "new" && (
        <Card>
          <CardHeader><CardTitle>Create automation</CardTitle></CardHeader>
          <CardContent className="space-y-3 max-w-lg">
            <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
            <Input
              label="Trigger type"
              value={triggerType}
              onChange={(e) => setTriggerType(e.target.value)}
              placeholder="LEAD_CREATED"
              hint={`Supported: ${TRIGGER_TYPES.slice(0, 4).join(", ")}…`}
            />
            <Button onClick={async () => {
              const res = await apiFetch<{ automation: { id: string } }>(`${base}?organisationId=${organisationId}`, {
                method: "POST",
                body: JSON.stringify({
                  action: "createAutomation",
                  name,
                  description: description || undefined,
                  triggerType,
                }),
              });
              window.location.href = `/automation/${res.automation.id}/builder`;
            }}>Create</Button>
          </CardContent>
        </Card>
      )}

      {mode === "detail" && automation && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>{String(automation.name)}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Badge>{String(automation.status)}</Badge>
                {automation.testMode ? <Badge variant="muted">Test mode</Badge> : null}
                {automation.globalStopped ? <Badge variant="muted">Globally stopped</Badge> : null}
              </div>
              {automation.description ? <p className="text-sm">{String(automation.description)}</p> : null}
              {version ? (
                <p className="text-sm text-muted-foreground">
                  Active version: v{String(version.versionNumber)} ({String(version.status)})
                </p>
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full" onClick={() => postAction({ action: "submitForReview", automationId })}>Submit for review</Button>
              <Button variant="outline" className="w-full" onClick={() => postAction({ action: "approveVersion", automationId })}>Approve version</Button>
              <Button variant="outline" className="w-full" onClick={() => postAction({ action: "activateVersion", automationId })}>Activate</Button>
              <Button variant="outline" className="w-full" onClick={() => postAction({ action: "pauseAutomation", automationId })}>Pause</Button>
              <Link href={`/automation/${automationId}/builder`}><Button variant="outline" className="w-full">Open builder</Button></Link>
            </CardContent>
          </Card>
        </div>
      )}

      {mode === "builder" && automationId && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            {version ? (
              <Badge>Version {String(version.versionNumber)} — {String(version.status)}</Badge>
            ) : (
              <Badge variant="muted">No version</Badge>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={testMode}
                onChange={(e) => setTestMode(e.target.checked)}
              />
              Test mode
            </label>
            <Button
              size="sm"
              variant="outline"
              onClick={() => postAction({ action: "saveGraph", automationId, testMode, trigger: { triggerType, config: JSON.parse(triggerConfig || "{}") }, graph: parsedGraph })}
            >
              Save graph
            </Button>
          </div>

          {validationMessages.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Validation</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {validationMessages.map((v, i) => (
                  <p key={i} className={`text-sm ${v.severity === "error" ? "text-danger" : "text-muted-foreground"}`}>
                    {String(v.message ?? v.code)}
                  </p>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Trigger configuration</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Input label="Trigger type" value={triggerType} onChange={(e) => setTriggerType(e.target.value)} />
                <Input label="Config (JSON)" value={triggerConfig} onChange={(e) => setTriggerConfig(e.target.value)} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Graph (JSON)</CardTitle></CardHeader>
              <CardContent>
                <textarea
                  className="w-full min-h-[200px] rounded-lg border border-border-strong bg-surface-elevated px-3 py-2 text-sm font-mono"
                  value={graphJson}
                  onChange={(e) => setGraphJson(e.target.value)}
                />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Nodes ({parsedGraph.nodes.length})</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {parsedGraph.nodes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No nodes defined.</p>
                ) : (
                  parsedGraph.nodes.map((node, i) => (
                    <div key={String(node.id ?? node.nodeKey ?? i)} className="flex justify-between text-sm border-b py-2">
                      <span>{String(node.label ?? node.nodeKey ?? node.id)}</span>
                      <Badge variant="muted">{String(node.nodeType)}</Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Edges ({parsedGraph.edges.length})</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {parsedGraph.edges.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No edges defined.</p>
                ) : (
                  parsedGraph.edges.map((edge, i) => (
                    <div key={String(edge.id ?? i)} className="text-sm border-b py-2">
                      {String(edge.sourceNodeId ?? edge.source)} → {String(edge.targetNodeId ?? edge.target)}
                      {edge.label ? <span className="text-muted-foreground"> ({String(edge.label)})</span> : null}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Lifecycle</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => postAction({ action: "submitForReview", automationId })}>Submit for review</Button>
              <Button variant="outline" onClick={() => postAction({ action: "approveVersion", automationId })}>Approve version</Button>
              <Button onClick={() => postAction({ action: "activateVersion", automationId })}>Activate version</Button>
            </CardContent>
          </Card>
        </div>
      )}

      {mode === "enrollments" && automationId && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Manual enrollment</CardTitle></CardHeader>
            <CardContent className="space-y-3 max-w-lg">
              <Input label="Lead ID" value={leadId} onChange={(e) => setLeadId(e.target.value)} />
              <Button onClick={() => postAction({
                action: "enrollLead",
                automationId,
                leadId,
                isTestEnrollment: testMode,
              })}>Enroll lead</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Enrollments ({enrollments.length})</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {enrollments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No enrollments yet.</p>
              ) : (
                enrollments.map((e) => (
                  <div key={String(e.id)} className="flex justify-between text-sm border-b py-2">
                    <span>{String(e.leadId)}</span>
                    <div className="flex gap-2">
                      {e.isTestEnrollment ? <Badge variant="muted">Test</Badge> : null}
                      <Badge>{String(e.status)}</Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {mode === "analytics" && (
        <Card>
          <CardHeader><CardTitle>Automation analytics</CardTitle></CardHeader>
          <CardContent>
            {analytics?.metrics ? (
              <div className="grid gap-4 md:grid-cols-4 text-sm">
                <div>Enrolled: {String((analytics.metrics as Record<string, unknown>).enrolled)}</div>
                <div>Active: {String((analytics.metrics as Record<string, unknown>).active)}</div>
                <div>Completed: {String((analytics.metrics as Record<string, unknown>).completed)}</div>
                <div>Exited: {String((analytics.metrics as Record<string, unknown>).exited)}</div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No metrics yet.</p>
            )}
            {analytics?.limitations ? (
              <p className="text-xs text-muted-foreground mt-4">{String(analytics.limitations)}</p>
            ) : null}
          </CardContent>
        </Card>
      )}

      {mode === "templates" && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Create from template</CardTitle></CardHeader>
            <CardContent className="space-y-3 max-w-lg">
              <Input label="Template key" value={templateKey} onChange={(e) => setTemplateKey(e.target.value)} placeholder="welcome-series" />
              <Input label="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
              <Button onClick={async () => {
                const res = await apiFetch<{ automation: { id: string } }>(`${base}?organisationId=${organisationId}`, {
                  method: "POST",
                  body: JSON.stringify({
                    action: "createFromTemplate",
                    templateKey,
                    name: name || undefined,
                  }),
                });
                window.location.href = `/automation/${res.automation.id}/builder`;
              }}>Create from template</Button>
            </CardContent>
          </Card>

          {templates.map((t) => (
            <Card key={String(t.templateKey ?? t.id)}>
              <CardContent className="py-4 flex justify-between items-center">
                <div>
                  <p className="font-medium">{String(t.name ?? t.templateKey)}</p>
                  {t.description ? <p className="text-sm text-muted-foreground">{String(t.description)}</p> : null}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => postAction({ action: "createFromTemplate", templateKey: t.templateKey, name: String(t.name) })}
                >
                  Use template
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {mode === "errors" && (
        <Card>
          <CardHeader><CardTitle>Automation errors</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {errors.length === 0 ? (
              <p className="text-sm text-muted-foreground">No errors recorded.</p>
            ) : (
              errors.map((err) => (
                <div key={String(err.id)} className="border-b py-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <Badge variant="muted">{String(err.errorCode)}</Badge>
                    <span className="text-muted-foreground">{err.occurredAt ? new Date(String(err.occurredAt)).toLocaleString() : ""}</span>
                  </div>
                  <p>{String(err.message ?? err.errorCode)}</p>
                  {err.automationId ? (
                    <Link href={`/automation/${err.automationId}`} className="text-primary hover:underline">
                      View automation
                    </Link>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
