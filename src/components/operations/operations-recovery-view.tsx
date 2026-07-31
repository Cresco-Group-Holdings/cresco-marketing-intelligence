"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { apiFetch } from "@/lib/api/client";
import { ALERT_TYPE_LABELS } from "@/lib/notifications/constants";

type Mode = "all" | "failures" | "publishing" | "connectors" | "rendering";

const nav: Array<[string, string]> = [
  ["Overview", "/operations"],
  ["Failures", "/operations/failures"],
  ["Publishing", "/operations/publishing"],
  ["Connectors", "/operations/connectors"],
  ["Rendering", "/operations/rendering"],
];

type AlertItem = {
  id: string;
  alertType: string;
  status: string;
  title: string;
  safeErrorMessage: string;
  provider: string | null;
  resourceType: string;
  resourceId: string;
  recommendedAction: string | null;
  lastAttemptAt: string | null;
  nextRetryAt: string | null;
  attemptCount: number;
  maxAttempts: number;
  brand: { id: string; name: string } | null;
};

export function OperationsRecoveryView({ mode }: { mode: Mode }) {
  const { preference } = useWorkspace();
  const organisationId = preference.currentOrganisationId;
  const [summary, setSummary] = useState<{
    open: number;
    deadLetter: number;
    publishing: number;
    connectors: number;
    rendering: number;
  } | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const alertTypeFilter =
    mode === "publishing"
      ? "PUBLISHING_FAILURE"
      : mode === "connectors"
        ? "CONNECTOR_SYNC_FAILURE"
        : mode === "rendering"
          ? "RENDER_FAILURE"
          : undefined;

  const load = useCallback(async () => {
    if (!organisationId) return;
    const params = new URLSearchParams({ organisationId });
    if (alertTypeFilter) params.set("alertType", alertTypeFilter);
    const data = await apiFetch<{ summary: typeof summary; items: AlertItem[] }>(
      `/api/operations/alerts?${params.toString()}`,
      { organisationId },
    );
    setSummary(data.summary);
    setAlerts(data.items);
  }, [organisationId, alertTypeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runAction(alertId: string, action: string) {
    if (!organisationId) return;
    try {
      await apiFetch(
        `/api/operations/alerts/${alertId}/actions?action=${action}&organisationId=${organisationId}`,
        {
          method: "POST",
          organisationId,
          body: JSON.stringify({ idempotencyKey: `${action}:${alertId}:${Date.now()}` }),
        },
      );
      setMessage(`${action} completed.`);
      await load();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Action failed.");
    }
  }

  return (
    <>
      <PageHeader
        title="Operations"
        description="Recover from publishing, connector, and rendering failures."
        breadcrumbs={[{ label: "Operations", href: "/operations" }, { label: mode }]}
      />
      <nav className="mb-4 flex flex-wrap gap-2">
        {nav.map(([label, href]) => (
          <Link key={href} className="text-sm underline" href={href}>
            {label}
          </Link>
        ))}
      </nav>

      {summary ? (
        <div className="mb-4 grid gap-3 md:grid-cols-5">
          <Card><CardHeader><CardTitle>Open</CardTitle></CardHeader><CardContent>{summary.open}</CardContent></Card>
          <Card><CardHeader><CardTitle>Dead letter</CardTitle></CardHeader><CardContent>{summary.deadLetter}</CardContent></Card>
          <Card><CardHeader><CardTitle>Publishing</CardTitle></CardHeader><CardContent>{summary.publishing}</CardContent></Card>
          <Card><CardHeader><CardTitle>Connectors</CardTitle></CardHeader><CardContent>{summary.connectors}</CardContent></Card>
          <Card><CardHeader><CardTitle>Rendering</CardTitle></CardHeader><CardContent>{summary.rendering}</CardContent></Card>
        </div>
      ) : null}

      {message ? <p className="mb-3 text-sm text-slate-600">{message}</p> : null}

      <Card>
        <CardHeader><CardTitle>Operational alerts</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {alerts.length === 0 ? (
            <p className="text-sm text-slate-600">No active operational alerts.</p>
          ) : null}
          {alerts.map((alert) => (
            <div key={alert.id} className="rounded-lg border p-3 text-sm">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="font-medium">{alert.title}</span>
                <Badge variant="muted">
                  {ALERT_TYPE_LABELS[alert.alertType as keyof typeof ALERT_TYPE_LABELS] ?? alert.alertType}
                </Badge>
                <Badge variant="muted">{alert.status}</Badge>
                {alert.provider ? <Badge variant="muted">{alert.provider}</Badge> : null}
              </div>
              <p className="text-slate-600">{alert.safeErrorMessage}</p>
              <p className="mt-1 text-xs text-slate-500">
                {alert.resourceType} · {alert.resourceId}
                {alert.brand ? ` · ${alert.brand.name}` : ""}
                {alert.lastAttemptAt ? ` · Last attempt ${new Date(alert.lastAttemptAt).toLocaleString()}` : ""}
                {alert.nextRetryAt ? ` · Next retry ${new Date(alert.nextRetryAt).toLocaleString()}` : ""}
              </p>
              {alert.recommendedAction ? (
                <p className="mt-1 text-slate-600">Recommended: {alert.recommendedAction}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => void runAction(alert.id, "retry")}>
                  Retry
                </Button>
                <Button size="sm" variant="outline" onClick={() => void runAction(alert.id, "reconnect")}>
                  Reconnect
                </Button>
                <Button size="sm" variant="outline" onClick={() => void runAction(alert.id, "resolve")}>
                  Mark resolved
                </Button>
                <Button size="sm" variant="outline" onClick={() => void runAction(alert.id, "cancel")}>
                  Cancel
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
