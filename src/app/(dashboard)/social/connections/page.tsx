"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api/client";

type SocialAccount = {
  id: string;
  provider: string;
  providerAccountId: string;
  accountType: string;
  username: string | null;
  displayName: string | null;
  profileUrl: string | null;
  avatarUrl: string | null;
  status: string;
  capabilities: string[];
};

type SocialConnection = {
  id: string;
  provider: string;
  status: string;
  grantedScopes: string[];
  tokenExpiresAt: string | null;
  lastValidatedAt: string | null;
  lastRefreshAt: string | null;
  reconnectRequiredAt: string | null;
  missingScopes: string[];
  account: SocialAccount | null;
};

type CatalogueItem = {
  provider: string;
  name: string;
  description: string;
  requiredScopes: string[];
  optionalScopes: string[];
  maturity: "available" | "beta" | "not_configured" | "unavailable";
  maturityReason: string | null;
  connection: SocialConnection | null;
  canConnect: boolean;
  connectDisabledReason: string | null;
};

type PendingAccount = {
  providerAccountId: string;
  accountType: string;
  username?: string;
  displayName?: string;
  profileUrl?: string;
};

function statusVariant(status: string): "default" | "muted" | "warning" {
  if (status === "CONNECTED") return "default";
  if (status === "ERROR" || status === "REAUTH_REQUIRED" || status === "PERMISSION_MISSING") {
    return "warning";
  }
  return "muted";
}

function maturityLabel(maturity: CatalogueItem["maturity"]): string {
  switch (maturity) {
    case "available":
      return "Available";
    case "beta":
      return "Beta";
    case "not_configured":
      return "Not configured";
    case "unavailable":
      return "Unavailable";
  }
}

function displayStatus(item: CatalogueItem): string {
  if (item.connection?.status) {
    return item.connection.status;
  }
  return maturityLabel(item.maturity).toUpperCase().replace(" ", "_");
}

export default function SocialConnectionsPage() {
  const { preference } = useWorkspace();
  const searchParams = useSearchParams();
  const [catalogue, setCatalogue] = useState<CatalogueItem[]>([]);
  const [selected, setSelected] = useState<CatalogueItem | null>(null);
  const [pendingAccounts, setPendingAccounts] = useState<PendingAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const organisationId = preference.currentOrganisationId;
  const brandId = preference.currentBrandId;
  const connectionIdParam = searchParams.get("connectionId");
  const step = searchParams.get("step");

  const loadCatalogue = useCallback(async () => {
    if (!organisationId || !brandId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ catalogue: CatalogueItem[] }>(
        `/api/brands/${brandId}/social/connections?organisationId=${organisationId}`,
        { organisationId },
      );
      setCatalogue(data.catalogue);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load social connections.");
    } finally {
      setLoading(false);
    }
  }, [organisationId, brandId]);

  useEffect(() => {
    void loadCatalogue();
  }, [loadCatalogue]);

  useEffect(() => {
    if (searchParams.get("error")) {
      setError("Social account connection failed. Please try again.");
    }
  }, [searchParams]);

  useEffect(() => {
    if (step === "select-account" && connectionIdParam && organisationId && brandId) {
      void (async () => {
        try {
          const data = await apiFetch<{ accounts: PendingAccount[] }>(
            `/api/brands/${brandId}/social/connections/${connectionIdParam}/pending-accounts?organisationId=${organisationId}`,
            { organisationId },
          );
          setPendingAccounts(data.accounts);
          const item = catalogue.find((entry) => entry.connection?.id === connectionIdParam);
          if (item) {
            setSelected(item);
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to load pending accounts.");
        }
      })();
    }
  }, [step, connectionIdParam, organisationId, brandId, catalogue]);

  const groupedCatalogue = useMemo(() => catalogue, [catalogue]);

  async function startConnect(provider: string) {
    if (!organisationId || !brandId) return;
    setActionLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ connection: { authorisationUrl: string } }>(
        `/api/brands/${brandId}/social/connections/${provider}/connect?organisationId=${organisationId}`,
        { method: "POST", organisationId },
      );
      window.location.href = data.connection.authorisationUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start connection.");
      setActionLoading(false);
    }
  }

  async function assignAccount(providerAccountId: string, connectionId: string) {
    if (!organisationId || !brandId) return;
    setActionLoading(true);
    setError(null);
    try {
      await apiFetch(
        `/api/brands/${brandId}/social/connections/${connectionId}/assign-account?organisationId=${organisationId}`,
        {
          method: "POST",
          organisationId,
          body: JSON.stringify({ providerAccountId }),
        },
      );
      setSuccess("Social account assigned successfully.");
      setPendingAccounts([]);
      await loadCatalogue();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign account.");
    } finally {
      setActionLoading(false);
    }
  }

  async function runAction(connectionId: string, action: "disconnect" | "reconnect") {
    if (!organisationId || !brandId) return;
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await apiFetch(
        `/api/brands/${brandId}/social/connections/${connectionId}/${action}?organisationId=${organisationId}`,
        { method: "POST", organisationId },
      );
      setSuccess(action === "disconnect" ? "Connection disconnected." : "Connection refreshed.");
      await loadCatalogue();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} connection.`);
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Social Connections"
        description="Connect social media accounts to the selected brand. Credentials are stored securely server-side."
        breadcrumbs={[
          { label: "Overview", href: "/dashboard" },
          { label: "Organic Social", href: "/organic-social" },
          { label: "Connections" },
        ]}
      />

      {!brandId ? (
        <Card>
          <CardHeader>
            <CardTitle>Select a brand</CardTitle>
            <CardDescription>
              Social connections are brand-scoped. Choose a brand in the workspace header.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      ) : null}

      {pendingAccounts.length > 0 && connectionIdParam ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Select an account</CardTitle>
            <CardDescription>
              Multiple accounts were returned. Choose the account to assign to this brand.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingAccounts.map((account) => (
              <div
                key={account.providerAccountId}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div>
                  <p className="font-medium">{account.displayName ?? account.username}</p>
                  <p className="text-sm text-foreground-muted">{account.accountType}</p>
                </div>
                <Button
                  size="sm"
                  disabled={actionLoading}
                  onClick={() =>
                    void assignAccount(account.providerAccountId, connectionIdParam)
                  }
                >
                  Assign
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          {loading ? <p className="text-sm text-foreground-muted">Loading providers...</p> : null}
          <div className="grid gap-4 md:grid-cols-2">
            {groupedCatalogue.map((item) => (
              <Card key={item.provider} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">{item.name}</CardTitle>
                      <CardDescription>{item.description}</CardDescription>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant={statusVariant(displayStatus(item))}>
                        {displayStatus(item)}
                      </Badge>
                      <Badge variant="muted">{maturityLabel(item.maturity)}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="mt-auto space-y-3">
                  {item.connection?.account ? (
                    <p className="text-sm text-foreground-muted">
                      Connected: @{item.connection.account.username ?? item.connection.account.displayName}
                    </p>
                  ) : null}
                  <p className="text-xs text-foreground-subtle">
                    Required permissions: {item.requiredScopes.join(", ") || "None"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelected(item)}
                    >
                      Details
                    </Button>
                    <Button
                      size="sm"
                      disabled={!item.canConnect || actionLoading}
                      onClick={() => void startConnect(item.provider)}
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
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Connection details</CardTitle>
            <CardDescription>
              Permissions, token health, and assigned account for the selected provider.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {!selected ? (
              <p className="text-foreground-muted">Select a provider to inspect its connection.</p>
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
                  <p className="font-medium">Granted permissions</p>
                  <ul className="list-disc pl-5 text-foreground-muted">
                    {(selected.connection?.grantedScopes ?? []).map((scope) => (
                      <li key={scope}>{scope}</li>
                    ))}
                    {(selected.connection?.grantedScopes ?? []).length === 0 ? (
                      <li>None</li>
                    ) : null}
                  </ul>
                </div>
                {(selected.connection?.missingScopes ?? []).length > 0 ? (
                  <div>
                    <p className="font-medium">Missing permissions</p>
                    <ul className="list-disc pl-5 text-amber-700">
                      {selected.connection!.missingScopes.map((scope) => (
                        <li key={scope}>{scope}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {selected.connection ? (
                  <>
                    <div>
                      <p className="font-medium">Token expiry</p>
                      <p className="text-foreground-muted">
                        {selected.connection.tokenExpiresAt ?? "Unknown"}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium">Last validation</p>
                      <p className="text-foreground-muted">
                        {selected.connection.lastValidatedAt ?? "Never"}
                      </p>
                    </div>
                    {selected.connection.account ? (
                      <div>
                        <p className="font-medium">Assigned account</p>
                        <p className="text-foreground-muted">
                          {selected.connection.account.displayName} (
                          {selected.connection.account.accountType})
                        </p>
                        <p className="text-foreground-muted">
                          Capabilities: {selected.connection.account.capabilities.join(", ")}
                        </p>
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionLoading || !selected.connection.id}
                        onClick={() =>
                          void runAction(selected.connection!.id, "reconnect")
                        }
                      >
                        Reconnect
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionLoading || !selected.connection.id}
                        onClick={() =>
                          void runAction(selected.connection!.id, "disconnect")
                        }
                      >
                        Disconnect
                      </Button>
                      {selected.connection.status === "CONNECTED" &&
                      pendingAccounts.length === 0 ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={actionLoading}
                          onClick={() => {
                            setPendingAccounts([]);
                            void startConnect(selected.provider);
                          }}
                        >
                          Change account
                        </Button>
                      ) : null}
                    </div>
                  </>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
