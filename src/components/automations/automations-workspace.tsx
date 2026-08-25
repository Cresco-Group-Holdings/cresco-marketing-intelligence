"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { apiFetch } from "@/lib/api/client";

export type AutomationsTab = "active" | "templates" | "history" | "errors";

type Props = { tab: AutomationsTab };

export function AutomationsWorkspace({ tab }: Props) {
  const { preference } = useWorkspace();
  const brandId = preference.currentBrandId;
  const organisationId = preference.currentOrganisationId;
  const base = brandId ? `/api/brands/${brandId}/automation-engine` : null;

  const [overview, setOverview] = useState<Record<string, unknown> | null>(null);
  const [workflows, setWorkflows] = useState<Array<Record<string, unknown>>>([]);
  const [templates, setTemplates] = useState<Array<Record<string, unknown>>>([]);
  const [executions, setExecutions] = useState<Array<Record<string, unknown>>>([]);
  const [errors, setErrors] = useState<Array<Record<string, unknown>>>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!base || !organisationId) return;
    setLoading(true);
    try {
      if (tab === "active") {
        const res = await apiFetch<{
          overview: Record<string, unknown>;
          workflows: Array<Record<string, unknown>>;
        }>(`${base}?organisationId=${organisationId}&view=overview`);
        setOverview(res.overview);
        setWorkflows(res.workflows.filter((w) => w.status === "ACTIVE"));
      } else if (tab === "templates") {
        const res = await apiFetch<{ templates: Array<Record<string, unknown>> }>(
          `${base}?organisationId=${organisationId}&view=templates`,
        );
        setTemplates(res.templates);
      } else if (tab === "history") {
        const res = await apiFetch<{ executions: Array<Record<string, unknown>> }>(
          `${base}?organisationId=${organisationId}&view=history`,
        );
        setExecutions(res.executions);
      } else if (tab === "errors") {
        const res = await apiFetch<{ errors: Array<Record<string, unknown>> }>(
          `${base}?organisationId=${organisationId}&view=errors`,
        );
        setErrors(res.errors);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load automations.");
    } finally {
      setLoading(false);
    }
  }, [base, organisationId, tab]);

  useEffect(() => {
    void load();
  }, [load]);

  async function activateTemplate(templateKey: string) {
    if (!base || !organisationId) return;
    setLoading(true);
    try {
      await apiFetch(`${base}?organisationId=${organisationId}`, {
        method: "POST",
        body: JSON.stringify({ action: "activateTemplate", templateKey }),
      });
      setMessage("Automation activated.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Activation failed.");
    } finally {
      setLoading(false);
    }
  }

  const tabs: Array<[AutomationsTab, string]> = [
    ["active", "Active"],
    ["templates", "Templates"],
    ["history", "History"],
    ["errors", "Errors"],
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Automations"
        description="Automate repetitive marketing monitoring, reporting, and failure detection."
      />

      <nav className="flex flex-wrap gap-2 border-b pb-3">
        {tabs.map(([id, label]) => (
          <Link
            key={id}
            href={`/automations${id === "active" ? "" : `/${id}`}`}
            className={`rounded-md px-3 py-1.5 text-sm ${
              tab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}

      {tab === "active" && overview ? (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Active automations</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold">{String(overview.active ?? 0)}</CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Runs this week</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold">{String(overview.runsThisWeek ?? 0)}</CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Failures</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold">{String(overview.failures ?? 0)}</CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Needs attention</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold">
                {Number(overview.failures ?? 0) > 0 ? String(overview.failures) : "None"}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Active automations</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {workflows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Automate repetitive marketing monitoring. Start with a weekly performance digest or publishing failure alert.{" "}
                  <Link href="/automations/templates" className="underline">Browse templates</Link>
                </p>
              ) : (
                workflows.map((workflow) => (
                  <div key={String(workflow.id)} className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="font-medium">{String(workflow.name)}</p>
                      <p className="text-sm text-muted-foreground">{String(workflow.description ?? "")}</p>
                    </div>
                    <Badge>{String(workflow.status)}</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      ) : null}

      {tab === "templates" ? (
        <div className="grid gap-4 md:grid-cols-2">
          {templates.map((template) => (
            <Card key={String(template.key)}>
              <CardHeader>
                <CardTitle className="text-base">{String(template.name)}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{String(template.description)}</p>
                <p className="text-xs text-muted-foreground">Cadence: {String(template.defaultCadence)}</p>
                <Button size="sm" onClick={() => activateTemplate(String(template.key))}>
                  Activate
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {tab === "history" ? (
        <Card>
          <CardHeader><CardTitle>Recent executions</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {executions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No automation executions yet.</p>
            ) : (
              executions.map((execution) => (
                <div key={String(execution.id)} className="flex justify-between rounded-md border p-3 text-sm">
                  <span>{String((execution.workflow as { name?: string })?.name ?? "Workflow")}</span>
                  <Badge variant="muted">{String(execution.status)}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}

      {tab === "errors" ? (
        <Card>
          <CardHeader><CardTitle>Automation errors</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {errors.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No automation failures. All recent automation executions completed successfully.
              </p>
            ) : (
              errors.map((error) => (
                <div key={String(error.id)} className="rounded-md border p-3 text-sm">
                  <p className="font-medium">{String((error.workflow as { name?: string })?.name ?? "Workflow")}</p>
                  <p className="text-muted-foreground">{String(error.errorMessage ?? "Execution failed.")}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
