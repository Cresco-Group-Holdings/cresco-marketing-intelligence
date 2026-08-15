"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
  Webhook,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api/client";
import type {
  ConnectionHealthView,
  IntegrationConnectionView,
  ProviderAccountView,
  SyncJobView,
} from "@/components/integrations/integration-types";

type TabKey =
  | "overview"
  | "accounts"
  | "capabilities"
  | "sync"
  | "webhooks"
  | "health"
  | "activity"
  | "settings";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "accounts", label: "Accounts" },
  { key: "capabilities", label: "Capabilities" },
  { key: "sync", label: "Synchronisation" },
  { key: "webhooks", label: "Webhooks" },
  { key: "health", label: "Health" },
  { key: "activity", label: "Activity" },
  { key: "settings", label: "Settings" },
];

function statusVariant(status: string): "default" | "muted" | "warning" {
  if (status === "CONNECTED" || status === "HEALTHY" || status === "SUCCEEDED") return "default";
  if (
    status === "DEGRADED" ||
    status === "ACTION_REQUIRED" ||
    status === "REAUTH_REQUIRED" ||
    status === "RETRYING" ||
    status === "FAILED"
  ) {
    return "warning";
  }
  return "muted";
}

export default function IntegrationConnectionDetailPage() {
  const params = useParams<{ connectionId: string }>();
  const connectionId = params.connectionId;
  const { preference } = useWorkspace();
  const organisationId = preference.currentOrganisationId;

  const [tab, setTab] = useState<TabKey>("overview");
  const [connection, setConnection] = useState<IntegrationConnectionView | null>(null);
  const [accounts, setAccounts] = useState<ProviderAccountView[]>([]);
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [syncJobs, setSyncJobs] = useState<SyncJobView[]>([]);
  const [health, setHealth] = useState<ConnectionHealthView | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConnection = useCallback(async () => {
    if (!organisationId || !connectionId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ connection: IntegrationConnectionView }>(
        `/api/integrations/${connectionId}?organisationId=${organisationId}`,
        { organisationId },
      );
      setConnection(data.connection);

      const caps = await apiFetch<{ capabilities: string[] }>(
        `/api/providers/${data.connection.providerKey}?view=capabilities&organisationId=${organisationId}`,
        { organisationId },
      );
      setCapabilities(caps.capabilities);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load connection.");
    } finally {
      setLoading(false);
    }
  }, [organisationId, connectionId]);

  const loadAccounts = useCallback(async () => {
    if (!organisationId || !connectionId) return;
    const data = await apiFetch<{ accounts: ProviderAccountView[] }>(
      `/api/integrations/${connectionId}/accounts?organisationId=${organisationId}`,
      { organisationId },
    );
    setAccounts(data.accounts);
  }, [organisationId, connectionId]);

  const loadSyncJobs = useCallback(async () => {
    if (!organisationId || !connectionId) return;
    const data = await apiFetch<{ jobs: SyncJobView[] }>(
      `/api/integrations/${connectionId}/sync?organisationId=${organisationId}`,
      { organisationId },
    );
    setSyncJobs(data.jobs);
  }, [organisationId, connectionId]);

  const loadHealth = useCallback(async () => {
    if (!organisationId || !connectionId) return;
    const data = await apiFetch<{ health: ConnectionHealthView }>(
      `/api/integrations/${connectionId}/health?organisationId=${organisationId}`,
      { organisationId },
    );
    setHealth(data.health);
  }, [organisationId, connectionId]);

  useEffect(() => {
    void loadConnection();
  }, [loadConnection]);

  useEffect(() => {
    if (tab === "accounts") void loadAccounts();
    if (tab === "sync") void loadSyncJobs();
    if (tab === "health") void loadHealth();
  }, [tab, loadAccounts, loadSyncJobs, loadHealth]);

  async function runVerify() {
    if (!organisationId || !connectionId) return;
    setActionLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ health: ConnectionHealthView }>(
        `/api/integrations/${connectionId}/verify?organisationId=${organisationId}`,
        { method: "POST", organisationId },
      );
      setHealth(data.health);
      await loadConnection();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setActionLoading(false);
    }
  }

  async function runSync(capability: string) {
    if (!organisationId || !connectionId) return;
    setActionLoading(true);
    setError(null);
    try {
      await apiFetch(`/api/integrations/${connectionId}/sync?organisationId=${organisationId}`, {
        method: "POST",
        organisationId,
        body: JSON.stringify({ capability, resourceType: capability }),
      });
      await loadSyncJobs();
      setTab("sync");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed.");
    } finally {
      setActionLoading(false);
    }
  }

  async function runRevoke() {
    if (!organisationId || !connectionId) return;
    setActionLoading(true);
    setError(null);
    try {
      await apiFetch(`/api/integrations/${connectionId}?organisationId=${organisationId}`, {
        method: "POST",
        organisationId,
        body: JSON.stringify({ action: "revoke" }),
      });
      window.location.href = "/integrations";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Revoke failed.");
    } finally {
      setActionLoading(false);
    }
  }

  async function selectAccount(accountId: string) {
    if (!organisationId || !connectionId) return;
    setActionLoading(true);
    try {
      await apiFetch(`/api/integrations/${connectionId}/accounts?organisationId=${organisationId}`, {
        method: "POST",
        organisationId,
        body: JSON.stringify({ accountId }),
      });
      await loadAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to select account.");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading connection...</div>;
  }

  if (!connection) {
    return (
      <div className="space-y-4 p-6">
        <p className="text-sm text-red-700">{error ?? "Connection not found."}</p>
        <ButtonLink href="/integrations" variant="outline" size="sm">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to integrations
        </ButtonLink>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={connection.displayName ?? connection.providerKey}
        description={`Provider: ${connection.providerKey} · API ${connection.providerVersion ?? "default"}`}
        breadcrumbs={[
          { label: "Overview", href: "/dashboard" },
          { label: "Integrations", href: "/integrations" },
          { label: connection.displayName ?? connection.providerKey },
        ]}
      />

      <div className="mb-4">
        <ButtonLink href="/integrations" variant="ghost" size="sm">
          <ArrowLeft className="mr-1 h-4 w-4" />
          All integrations
        </ButtonLink>
      </div>

      {error ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Badge variant={statusVariant(connection.status)}>{connection.status}</Badge>
        {connection.reauthorizationRequired ? (
          <Badge variant="warning">Action required</Badge>
        ) : null}
        <Button size="sm" variant="outline" disabled={actionLoading} onClick={() => void runVerify()}>
          <CheckCircle2 className="mr-1 h-4 w-4" />
          Verify connection
        </Button>
        {capabilities[0] ? (
          <Button
            size="sm"
            variant="outline"
            disabled={actionLoading}
            onClick={() => void runSync(capabilities[0]!)}
          >
            <RefreshCw className="mr-1 h-4 w-4" />
            Sync now
          </Button>
        ) : null}
      </div>

      <div className="mb-6 flex flex-wrap gap-2 border-b pb-2">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`rounded-md px-3 py-1.5 text-sm ${
              tab === item.key ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/50"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Connection overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Status:</span> {connection.status}
              </p>
              <p>
                <span className="text-muted-foreground">Environment:</span> {connection.environment}
              </p>
              <p>
                <span className="text-muted-foreground">Last successful sync:</span>{" "}
                {connection.lastSuccessfulAt ?? "Never"}
              </p>
              <p>
                <span className="text-muted-foreground">Last health check:</span>{" "}
                {connection.lastHealthCheckAt ?? "Never"}
              </p>
              {connection.externalLabel ? (
                <p>
                  <span className="text-muted-foreground">External account:</span>{" "}
                  {connection.externalLabel}
                </p>
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Capabilities</CardTitle>
              <CardDescription>Operations available through the provider gateway.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1">
                {capabilities.map((capability) => (
                  <span key={capability} className="rounded bg-muted px-2 py-0.5 text-xs">
                    {capability.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {tab === "accounts" ? (
        <Card>
          <CardHeader>
            <CardTitle>Provider accounts</CardTitle>
            <CardDescription>Select which external account this connection should use.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {accounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No accounts discovered yet. Verify the connection to fetch accounts.
              </p>
            ) : (
              accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between rounded-md border p-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{account.displayName}</p>
                    <p className="text-muted-foreground">
                      {account.externalId}
                      {account.currency ? ` · ${account.currency}` : ""}
                    </p>
                  </div>
                  {account.selected ? (
                    <Badge variant="default">Selected</Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={actionLoading}
                      onClick={() => void selectAccount(account.id)}
                    >
                      Select
                    </Button>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}

      {tab === "capabilities" ? (
        <Card>
          <CardHeader>
            <CardTitle>Supported capabilities</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {capabilities.map((capability) => (
                <li key={capability} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  {capability}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {tab === "sync" ? (
        <Card>
          <CardHeader>
            <CardTitle>Synchronisation history</CardTitle>
            <CardDescription>Durable sync jobs with retry state and record counts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {syncJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No synchronisation jobs yet.</p>
            ) : (
              syncJobs.map((job) => (
                <div key={job.id} className="rounded-md border p-3 text-sm">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant={statusVariant(job.status)}>{job.status}</Badge>
                    <span className="text-muted-foreground">{job.triggerType}</span>
                    <span>{job.capability}</span>
                  </div>
                  <p>
                    Read {job.recordsRead} · Written {job.recordsWritten} · Skipped{" "}
                    {job.recordsSkipped} · Failed {job.recordsFailed}
                  </p>
                  <p className="text-muted-foreground">
                    Started {job.startedAt ?? "—"} · Completed {job.completedAt ?? "—"}
                  </p>
                  {job.errorCode ? (
                    <p className="text-amber-700">
                      {job.errorCode}: {job.errorMessage ?? "Sync error"}
                    </p>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}

      {tab === "webhooks" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Webhook className="h-4 w-4" />
              Webhook subscriptions
            </CardTitle>
            <CardDescription>
              Webhook endpoints are verified, deduplicated, and processed asynchronously.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Webhook management for this connection will be available in Stage 12. The platform
              webhook route is active at{" "}
              <code className="rounded bg-muted px-1">
                /api/provider-webhooks/{connection.providerKey}/:endpointKey
              </code>
              .
            </p>
          </CardContent>
        </Card>
      ) : null}

      {tab === "health" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" />
              Connection health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {!health ? (
              <p className="text-muted-foreground">
                Run a health check to inspect capability availability.
              </p>
            ) : (
              <>
                <p>
                  Status: <Badge variant={statusVariant(health.status)}>{health.status}</Badge>
                </p>
                <p className="text-muted-foreground">Checked at {health.checkedAt}</p>
                {health.warnings.length > 0 ? (
                  <ul className="space-y-1 text-amber-700">
                    {health.warnings.map((warning) => (
                      <li key={warning.code}>
                        {warning.code}: {warning.message}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            )}
            <Button size="sm" variant="outline" disabled={actionLoading} onClick={() => void loadHealth()}>
              Refresh health
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {tab === "activity" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Audit events for credential access and sync operations are recorded server-side.
              Detailed activity logs require the integration.view_logs permission.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {tab === "settings" ? (
        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
            <CardDescription>Manage connection lifecycle. Credentials are never shown here.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              OAuth reconnect flows remain a controlled placeholder until Stage 12.
            </p>
            <Button
              size="sm"
              variant="outline"
              disabled={actionLoading}
              onClick={() => void runRevoke()}
            >
              Revoke connection
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
