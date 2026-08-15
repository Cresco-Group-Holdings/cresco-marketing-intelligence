"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Plug, Search, ShieldCheck } from "lucide-react";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api/client";
import { ResendConnectionPanel } from "@/components/integrations/resend-connection-panel";
import { OAuthConnectionPanel } from "@/components/integrations/oauth-connection-panel";
import { isStage12OAuthProvider } from "@/lib/integrations/oauth/provider-definitions";
import type {
  IntegrationConnectionView,
  ProviderCatalogueItem,
} from "@/components/integrations/integration-types";

function providerStatusVariant(status: string): "default" | "muted" | "warning" {
  if (status === "AVAILABLE" || status === "BETA") return "default";
  if (status === "DEPRECATED") return "warning";
  return "muted";
}

function connectionStatusVariant(status: string): "default" | "muted" | "warning" {
  if (status === "CONNECTED") return "default";
  if (status === "DEGRADED" || status === "ACTION_REQUIRED" || status === "REAUTH_REQUIRED") {
    return "warning";
  }
  return "muted";
}

export default function IntegrationsPage() {
  const { preference } = useWorkspace();
  const organisationId = preference.currentOrganisationId;
  const [providers, setProviders] = useState<ProviderCatalogueItem[]>([]);
  const [connections, setConnections] = useState<IntegrationConnectionView[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [connectingKey, setConnectingKey] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!organisationId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [providersData, connectionsData] = await Promise.all([
        apiFetch<{ providers: ProviderCatalogueItem[] }>(
          `/api/providers?organisationId=${organisationId}`,
          { organisationId },
        ),
        apiFetch<{ connections: IntegrationConnectionView[] }>(
          `/api/integrations?organisationId=${organisationId}`,
          { organisationId },
        ),
      ]);
      setProviders(providersData.providers);
      setConnections(connectionsData.connections);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load integrations.");
    } finally {
      setLoading(false);
    }
  }, [organisationId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("integration") === "success") {
      const missing = params.get("missingScopes");
      setBanner(
        missing
          ? `Connected, but additional scopes are required: ${missing}`
          : "Provider connected successfully.",
      );
    }
  }, []);

  const filteredProviders = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return providers;
    return providers.filter(
      (item) =>
        item.displayName.toLowerCase().includes(query) ||
        item.key.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query),
    );
  }, [providers, search]);

  const groupedProviders = useMemo(() => {
    const groups = new Map<string, ProviderCatalogueItem[]>();
    for (const item of filteredProviders) {
      const list = groups.get(item.category) ?? [];
      list.push(item);
      groups.set(item.category, list);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filteredProviders]);

  async function connectMockProvider(providerKey: string) {
    if (!organisationId) return;
    setConnectingKey(providerKey);
    setError(null);
    try {
      const result = await apiFetch<{ connection: IntegrationConnectionView }>(
        `/api/integrations?organisationId=${organisationId}`,
        {
          method: "POST",
          organisationId,
          body: JSON.stringify({
            providerKey,
            name: `${providerKey} connection`,
            apiKey: "mock-api-key",
          }),
        },
      );
      await loadData();
      window.location.href = `/integrations/${result.connection.id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create connection.");
    } finally {
      setConnectingKey(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Integrations"
        description="Connect external providers through the unified provider layer. Credentials are encrypted and never exposed in API responses."
        breadcrumbs={[{ label: "Overview", href: "/dashboard" }, { label: "Integrations" }]}
      />

      {!organisationId ? (
        <Card>
          <CardHeader>
            <CardTitle>Select an organisation</CardTitle>
            <CardDescription>
              Integration connections are organisation-scoped. Choose an organisation in the workspace
              header to manage providers.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {banner ? (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          {banner}
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="mb-8 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Active connections</h2>
            <p className="text-sm text-muted-foreground">
              {connections.length === 0
                ? "No connections yet. Connect a provider from the catalogue below."
                : `${connections.length} connection${connections.length === 1 ? "" : "s"} configured.`}
            </p>
          </div>
        </div>

        {connections.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {connections.map((connection) => (
              <Card key={connection.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">
                        {connection.displayName ?? connection.providerKey}
                      </CardTitle>
                      <CardDescription>{connection.providerKey}</CardDescription>
                    </div>
                    <Badge variant={connectionStatusVariant(connection.status)}>
                      {connection.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {connection.externalLabel ? (
                    <p className="text-sm text-muted-foreground">{connection.externalLabel}</p>
                  ) : null}
                  <div className="flex gap-2">
                    <ButtonLink href={`/integrations/${connection.id}`} size="sm" variant="outline">
                      Manage
                    </ButtonLink>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No active connections. Use the provider catalogue to connect a reference adapter in
              development, or configure Resend for email delivery.
            </CardContent>
          </Card>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Provider catalogue</h2>
            <p className="text-sm text-muted-foreground">
              Browse supported providers, capabilities, and connection availability.
            </p>
          </div>
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search providers..."
              className="w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm"
            />
          </div>
        </div>

        {loading ? <p className="text-sm text-muted-foreground">Loading provider catalogue...</p> : null}

        {groupedProviders.map(([category, items]) => (
          <div key={category} className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {category}
            </h3>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {items.map((definition) => {
                const connection = connections.find((item) => item.providerKey === definition.key);
                const isAvailable =
                  definition.status === "AVAILABLE" || definition.status === "BETA";
                const isMock = definition.key.startsWith("mock-");

                if (definition.key === "resend" && isAvailable) {
                  return (
                    <ResendConnectionPanel
                      key={definition.key}
                      connection={connection}
                      onConnected={() => {
                        void loadData();
                      }}
                    />
                  );
                }

                if (isStage12OAuthProvider(definition.key) && isAvailable) {
                  return (
                    <OAuthConnectionPanel
                      key={definition.key}
                      providerKey={definition.key}
                      displayName={definition.displayName}
                      connection={connection}
                      onUpdated={() => {
                        void loadData();
                      }}
                    />
                  );
                }

                return (
                  <Card key={definition.key} className="flex flex-col">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-base">{definition.displayName}</CardTitle>
                          <CardDescription>{definition.category}</CardDescription>
                        </div>
                        {isAvailable ? (
                          <ShieldCheck className="h-4 w-4 text-green-600" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="mt-auto space-y-3">
                      <div className="flex flex-wrap gap-1">
                        {definition.capabilities.slice(0, 4).map((capability) => (
                          <span key={capability} className="rounded bg-muted px-2 py-0.5 text-xs">
                            {capability.replace(/_/g, " ")}
                          </span>
                        ))}
                        {definition.capabilities.length > 4 ? (
                          <span className="rounded bg-muted px-2 py-0.5 text-xs">
                            +{definition.capabilities.length - 4} more
                          </span>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-2 text-sm">
                        <Badge variant={providerStatusVariant(definition.status)}>
                          {definition.status === "DISABLED" ? "Coming soon" : definition.status}
                        </Badge>
                        {definition.defaultApiVersion ? (
                          <span className="text-xs text-muted-foreground">
                            API {definition.defaultApiVersion}
                          </span>
                        ) : null}
                      </div>

                      {connection ? (
                        <p className="text-sm">
                          Status:{" "}
                          <span className="font-medium">{connection.status}</span>
                          {connection.reauthorizationRequired ? " (action required)" : ""}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {isAvailable ? "Not connected" : "Coming soon"}
                        </p>
                      )}

                      <div className="flex gap-2">
                        {connection ? (
                          <ButtonLink
                            href={`/integrations/${connection.id}`}
                            size="sm"
                            variant="outline"
                          >
                            Configure
                          </ButtonLink>
                        ) : (
                          <Button
                            size="sm"
                            disabled={!isAvailable || (!isMock && !definition.supportsPolling)}
                            onClick={() => {
                              if (isMock) void connectMockProvider(definition.key);
                            }}
                          >
                            <Plug className="mr-1 h-3.5 w-3.5" />
                            {connectingKey === definition.key ? "Connecting..." : "Connect"}
                          </Button>
                        )}
                      </div>

                      {isMock ? (
                        <p className="text-xs text-amber-700">
                          Test adapter — not a real integration. Unavailable in production.
                        </p>
                      ) : null}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </section>
    </>
  );
}
