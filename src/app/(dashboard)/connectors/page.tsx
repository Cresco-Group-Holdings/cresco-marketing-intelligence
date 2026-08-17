"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api/client";

type ConnectorAccount = {
  id: string;
  connectorType: string;
  status: string;
  displayName: string | null;
  externalAccountLabel: string | null;
  grantedScopes: string[];
  connectedAt: string | null;
  lastSuccessfulSyncAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
};

type CatalogueItem = {
  key: string;
  name: string;
  description: string;
  category: string;
  requiredScopes: string[];
  optionalScopes: string[];
  supportsOAuth: boolean;
  platformAvailability: string;
  documentationUrl?: string;
  account: ConnectorAccount | null;
  canConnect: boolean;
  connectDisabledReason: string | null;
};

type ConnectorDetail = CatalogueItem & {
  recentErrors?: Array<{
    id: string;
    category: string;
    message: string;
    retryable: boolean;
    occurredAt: string;
  }>;
  recentSyncs?: Array<{
    id: string;
    syncType: string;
    status: string;
    recordsProcessed: number;
    recordsFailed: number;
    startedAt: string | null;
    completedAt: string | null;
  }>;
};

function statusVariant(status: string): "default" | "muted" | "warning" {
  if (status === "CONNECTED") return "default";
  if (status === "ERROR" || status === "REAUTH_REQUIRED") return "warning";
  return "muted";
}

function displayStatus(item: CatalogueItem): string {
  if (item.account?.status) {
    return item.account.status;
  }
  return item.platformAvailability === "COMING_SOON" ? "NOT_CONFIGURED" : "AVAILABLE";
}

export default function ConnectorsPage() {
  const { preference } = useWorkspace();
  const [catalogue, setCatalogue] = useState<CatalogueItem[]>([]);
  const [selected, setSelected] = useState<ConnectorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const organisationId = preference.currentOrganisationId;
  const brandId = preference.currentBrandId;

  const loadCatalogue = useCallback(async () => {
    if (!organisationId || !brandId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ catalogue: CatalogueItem[] }>(
        `/api/brands/${brandId}/connectors?organisationId=${organisationId}`,
        { organisationId },
      );
      setCatalogue(data.catalogue);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load connectors.");
    } finally {
      setLoading(false);
    }
  }, [organisationId, brandId]);

  useEffect(() => {
    void loadCatalogue();
  }, [loadCatalogue]);

  const groupedCatalogue = useMemo(() => {
    const groups = new Map<string, CatalogueItem[]>();
    for (const item of catalogue) {
      const list = groups.get(item.category) ?? [];
      list.push(item);
      groups.set(item.category, list);
    }
    return [...groups.entries()];
  }, [catalogue]);

  async function loadDetail(connectorType: string) {
    if (!organisationId || !brandId) return;
    const data = await apiFetch<{ connector: ConnectorDetail }>(
      `/api/brands/${brandId}/connectors/${connectorType}?organisationId=${organisationId}`,
      { organisationId },
    );
    setSelected(data.connector);
  }

  async function runAction(
    connectorType: string,
    action: "disconnect" | "reconnect",
  ) {
    if (!organisationId || !brandId) return;
    setActionLoading(true);
    setError(null);
    try {
      await apiFetch(
        `/api/brands/${brandId}/connectors/${connectorType}/${action}?organisationId=${organisationId}`,
        { method: "POST", organisationId },
      );
      await loadCatalogue();
      await loadDetail(connectorType);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} connector.`);
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Connectors"
        description="Browse marketing platform integrations, review connection status, and manage credentials."
        breadcrumbs={[{ label: "Overview", href: "/dashboard" }, { label: "Connectors" }]}
      />

      {!brandId ? (
        <Card>
          <CardHeader>
            <CardTitle>Select a brand</CardTitle>
            <CardDescription>
              Connector accounts are brand-scoped. Choose a brand in the workspace header to
              manage integrations.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          {loading ? <p className="text-sm text-foreground-muted">Loading connector catalogue...</p> : null}
          {groupedCatalogue.map(([category, items]) => (
            <section key={category} className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground-subtle">
                {category}
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {items.map((item) => (
                  <Card key={item.key} className="flex flex-col">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-base">{item.name}</CardTitle>
                          <CardDescription>{item.description}</CardDescription>
                        </div>
                        <Badge variant={statusVariant(displayStatus(item))}>
                          {displayStatus(item)}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="mt-auto space-y-3">
                      <p className="text-xs text-foreground-subtle">
                        Required scopes: {item.requiredScopes.join(", ") || "None"}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void loadDetail(item.key)}
                        >
                          Details
                        </Button>
                        <Button
                          size="sm"
                          disabled={!item.canConnect || actionLoading}
                          onClick={() => {
                            if (item.key === "GOOGLE_ANALYTICS_4") {
                              window.location.href = "/connectors/google-analytics";
                            } else if (item.key === "GOOGLE_SEARCH_CONSOLE") {
                              window.location.href = "/connectors/google-search-console";
                            } else if (item.key === "GOOGLE_ADS") {
                              window.location.href = "/connectors/google-ads";
                            } else if (item.key === "META") {
                              window.location.href = "/connectors/meta-ads";
                            } else if (item.key === "LINKEDIN") {
                              window.location.href = "/connectors/linkedin-ads";
                            } else if (item.key === "TIKTOK") {
                              window.location.href = "/connectors/tiktok-ads";
                            }
                          }}
                        >
                          Connect
                        </Button>
                      </div>
                      {!item.canConnect && item.connectDisabledReason ? (
                        <p className="text-xs text-amber-700">{item.connectDisabledReason}</p>
                      ) : null}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Connector details</CardTitle>
            <CardDescription>
              Permissions, sync history, and connection health for the selected integration.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {!selected ? (
              <p className="text-foreground-muted">Select a connector to inspect its configuration.</p>
            ) : (
              <>
                <div>
                  <p className="font-medium">{selected.name}</p>
                  <p className="text-foreground-muted">{selected.description}</p>
                </div>
                <div>
                  <p className="font-medium">Status</p>
                  <Badge variant={statusVariant(displayStatus(selected))}>
                    {displayStatus(selected)}
                  </Badge>
                </div>
                <div>
                  <p className="font-medium">Required permissions</p>
                  <ul className="list-disc pl-5 text-foreground-muted">
                    {selected.requiredScopes.map((scope) => (
                      <li key={scope}>{scope}</li>
                    ))}
                  </ul>
                </div>
                {selected.account ? (
                  <>
                    <div>
                      <p className="font-medium">Last successful sync</p>
                      <p className="text-foreground-muted">
                        {selected.account.lastSuccessfulSyncAt ?? "Never"}
                      </p>
                    </div>
                    {selected.account.lastErrorMessage ? (
                      <div>
                        <p className="font-medium">Last error</p>
                        <p className="text-amber-700">{selected.account.lastErrorMessage}</p>
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionLoading}
                        onClick={() => void runAction(selected.key, "reconnect")}
                      >
                        Reconnect
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionLoading}
                        onClick={() => void runAction(selected.key, "disconnect")}
                      >
                        Disconnect
                      </Button>
                    </div>
                  </>
                ) : null}
                {selected.recentSyncs && selected.recentSyncs.length > 0 ? (
                  <div>
                    <p className="font-medium">Recent syncs</p>
                    <ul className="space-y-2 text-foreground-muted">
                      {selected.recentSyncs.map((sync) => (
                        <li key={sync.id}>
                          {sync.syncType} · {sync.status} · {sync.recordsProcessed} records
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
