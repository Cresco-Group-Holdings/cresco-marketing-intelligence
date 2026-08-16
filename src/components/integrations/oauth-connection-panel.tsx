"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Plug,
  RefreshCw,
  ShieldAlert,
  Unplug,
} from "lucide-react";
import { isStage12OAuthProvider } from "@/lib/integrations/oauth/provider-definitions";
import { ProviderSyncPanel } from "@/components/integrations/provider-sync-panel";

type OAuthConnectionPanelProps = {
  providerKey: string;
  displayName: string;
  oauthConfigStatus?: string | null;
  missingEnv?: string[];
  connection?: {
    id: string;
    status: string;
    displayName: string | null;
    externalLabel?: string | null;
    lastHealthCheckAt: string | null;
    lastSuccessfulAt: string | null;
    reauthorizationRequired: boolean;
  };
  onUpdated: () => void;
};

function orgHeaders(): Record<string, string> {
  const orgId = document.body.dataset.organisationId;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (orgId) headers["x-organisation-id"] = orgId;
  return headers;
}

export function OAuthConnectionPanel({
  providerKey,
  displayName,
  oauthConfigStatus,
  missingEnv = [],
  connection,
  onUpdated,
}: OAuthConnectionPanelProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scopes, setScopes] = useState<{
    grantedScopes: string[];
    missingScopes: string[];
  } | null>(null);
  const [accounts, setAccounts] = useState<
    Array<{
      id: string;
      externalAccountId: string;
      displayName: string;
      accountType: string;
      status: string;
    }>
  >([]);
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!connection?.id) return;
    void loadScopesAndAccounts(connection.id);
  }, [connection?.id]);

  async function loadScopesAndAccounts(connectionId: string) {
    const headers = orgHeaders();
    const [scopesRes, accountsRes] = await Promise.all([
      fetch(`/api/integrations/${connectionId}/scopes`, { headers }),
      fetch(`/api/integrations/${connectionId}/accounts`, { headers }),
    ]);
    if (scopesRes.ok) {
      const data = await scopesRes.json();
      setScopes({
        grantedScopes: data.data?.grantedScopes ?? [],
        missingScopes: data.data?.missingScopes ?? [],
      });
    }
    if (accountsRes.ok) {
      const data = await accountsRes.json();
      const list = data.data?.accounts ?? [];
      setAccounts(list);
      setSelectedAccounts(
        new Set(list.filter((a: { status: string }) => a.status === "SELECTED").map((a: { externalAccountId: string }) => a.externalAccountId)),
      );
    }
  }

  async function connect() {
    if (!isStage12OAuthProvider(providerKey)) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/integrations/oauth/${providerKey}/connect`, {
        method: "POST",
        headers: orgHeaders(),
        body: JSON.stringify({ returnPath: "/integrations" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message ?? "Connect failed.");
      window.location.href = data.data.authorizeUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connect failed.");
      setSubmitting(false);
    }
  }

  async function reconnect() {
    if (!connection?.id) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/integrations/${connection.id}/reconnect`, {
        method: "POST",
        headers: orgHeaders(),
        body: JSON.stringify({ returnPath: "/integrations" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message ?? "Reconnect failed.");
      window.location.href = data.data.authorizeUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reconnect failed.");
      setSubmitting(false);
    }
  }

  async function verifyConnection() {
    if (!connection?.id) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/integrations/${connection.id}/verify`, {
        method: "POST",
        headers: orgHeaders(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message ?? "Verify failed.");
      onUpdated();
      await loadScopesAndAccounts(connection.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verify failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function revokeConnection() {
    if (!connection?.id) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/integrations/${connection.id}/revoke`, {
        method: "POST",
        headers: orgHeaders(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message ?? "Revoke failed.");
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Revoke failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function saveAccountSelection() {
    if (!connection?.id) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/integrations/${connection.id}/accounts/select`, {
        method: "POST",
        headers: orgHeaders(),
        body: JSON.stringify({ externalAccountIds: [...selectedAccounts] }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message ?? "Account selection failed.");
      setAccounts(data.data?.accounts ?? []);
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Account selection failed.");
    } finally {
      setSubmitting(false);
    }
  }

  const needsReauth =
    connection?.reauthorizationRequired ||
    connection?.status === "EXPIRED" ||
    connection?.status === "REAUTH_REQUIRED" ||
    connection?.status === "ACTION_REQUIRED";

  const connectDisabled =
    submitting || oauthConfigStatus === "MISCONFIGURED" || oauthConfigStatus === "DISABLED";

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-medium">{displayName}</h2>
          <p className="text-xs text-muted-foreground">OAuth 2.0</p>
        </div>
        {connection?.status === "CONNECTED" ? (
          <CheckCircle2 className="h-4 w-4 text-green-600" />
        ) : connection?.status === "REVOKED" ? (
          <Unplug className="h-4 w-4 text-red-600" />
        ) : needsReauth ? (
          <ShieldAlert className="h-4 w-4 text-amber-600" />
        ) : (
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {connection ? (
        <p className="text-sm">
          Status: <span className="font-medium">{connection.status}</span>
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">Not connected</p>
      )}

      {oauthConfigStatus === "MISCONFIGURED" && !connection ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
          Provider OAuth is not configured
          {missingEnv.length > 0 ? `: ${missingEnv.join(", ")}` : ""}.
        </div>
      ) : null}

      {connection?.externalLabel ? (
        <p className="text-sm text-muted-foreground">{connection.externalLabel}</p>
      ) : null}

      {connection?.lastSuccessfulAt ? (
        <p className="text-xs text-muted-foreground">
          Last verified: {new Date(connection.lastSuccessfulAt).toLocaleString()}
        </p>
      ) : null}

      {scopes && scopes.missingScopes.length > 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
          Missing scopes: {scopes.missingScopes.join(", ")}
        </div>
      ) : null}

      {scopes && scopes.grantedScopes.length > 0 ? (
        <div className="text-xs text-muted-foreground">
          Granted: {scopes.grantedScopes.slice(0, 4).join(", ")}
          {scopes.grantedScopes.length > 4 ? "…" : ""}
        </div>
      ) : null}

      {accounts.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium">Select accounts</p>
          <div className="max-h-32 space-y-1 overflow-y-auto">
            {accounts.map((account) => (
              <label key={account.id} className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={selectedAccounts.has(account.externalAccountId)}
                  onChange={(event) => {
                    const next = new Set(selectedAccounts);
                    if (event.target.checked) next.add(account.externalAccountId);
                    else next.delete(account.externalAccountId);
                    setSelectedAccounts(next);
                  }}
                />
                <span>
                  {account.displayName} ({account.accountType})
                </span>
              </label>
            ))}
          </div>
          <button
            type="button"
            disabled={submitting || selectedAccounts.size === 0}
            onClick={() => void saveAccountSelection()}
            className="rounded-md border px-2 py-1 text-xs disabled:opacity-50"
          >
            Save selection
          </button>
        </div>
      ) : null}

      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      {connection && (connection.status === "CONNECTED" || connection.status === "RECONNECTED") ? (
        <ProviderSyncPanel
          connectionId={connection.id}
          providerKey={providerKey}
          connectionStatus={connection.status}
        />
      ) : null}

      <div className="flex flex-wrap gap-2">
        {!connection || connection.status === "REVOKED" ? (
          <button
            type="button"
            disabled={connectDisabled}
            onClick={() => void connect()}
            className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plug className="h-3.5 w-3.5" />}
            {oauthConfigStatus === "MISCONFIGURED" ? "Not configured" : "Connect"}
          </button>
        ) : null}

        {connection && needsReauth ? (
          <button
            type="button"
            disabled={submitting}
            onClick={() => void reconnect()}
            className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reconnect
          </button>
        ) : null}

        {connection && connection.status !== "REVOKED" ? (
          <>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void verifyConnection()}
              className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Verify health
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void revokeConnection()}
              className="rounded-md border px-3 py-1.5 text-sm text-red-700 disabled:opacity-50"
            >
              Revoke
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
