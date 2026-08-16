"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api/client";

type ConnectionOption = {
  id: string;
  providerKey: string;
  displayName: string | null;
  externalAccountId: string | null;
  status: string;
  lastHealthCheckAt?: string | null;
  lastSuccessfulAt?: string | null;
};

type AccountOption = {
  externalAccountId: string;
  displayName: string;
  accountType: string;
  status?: string;
};

type PreflightResult = {
  ready: boolean;
  blockers: string[];
  warnings: string[];
  mediaType: string | null;
  mediaCount: number;
  supportedContentTypes: string[];
  unsupportedContentTypes: string[];
};

type Props = {
  brandId: string | null;
  organisationId: string | null;
  contentId: string;
  contentVariantId?: string;
  contentStatus?: string;
  disabled?: boolean;
  onPublished?: () => void;
};

const ACTIVE_CONNECTION_STATUSES = new Set(["CONNECTED", "DEGRADED", "RECONNECTED"]);

export function CanonicalPublishPanel({
  brandId,
  organisationId,
  contentId,
  contentVariantId,
  contentStatus,
  disabled,
  onPublished,
}: Props) {
  const [connections, setConnections] = useState<ConnectionOption[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [connectionId, setConnectionId] = useState("");
  const [externalAccountId, setExternalAccountId] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const workspaceTimezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    [],
  );

  useEffect(() => {
    if (!organisationId) return;
    void apiFetch<{ connections: ConnectionOption[] }>(
      `/api/integrations?organisationId=${organisationId}`,
      { organisationId },
    )
      .then((data) => {
        const metaConnections = data.connections.filter(
          (c) => c.providerKey === "meta" && ACTIVE_CONNECTION_STATUSES.has(c.status),
        );
        setConnections(metaConnections);
      })
      .catch(() => setConnections([]));
  }, [organisationId]);

  useEffect(() => {
    if (!connectionId || !organisationId) {
      setAccounts([]);
      setExternalAccountId("");
      return;
    }
    void apiFetch<{ accounts: AccountOption[] }>(
      `/api/integrations/${connectionId}/accounts?organisationId=${organisationId}`,
      { organisationId },
    )
      .then((data) => {
        const igAccounts = data.accounts.filter((a) =>
          a.accountType.toLowerCase().includes("instagram"),
        );
        setAccounts(igAccounts);
        const selected = igAccounts.find((a) => a.status === "SELECTED");
        if (selected) {
          setExternalAccountId(selected.externalAccountId);
        } else if (igAccounts.length === 1) {
          setExternalAccountId(igAccounts[0]!.externalAccountId);
        } else {
          setExternalAccountId("");
        }
      })
      .catch(() => {
        setAccounts([]);
        setExternalAccountId("");
      });
  }, [connectionId, organisationId]);

  useEffect(() => {
    if (!brandId || !organisationId || !connectionId || !externalAccountId) {
      setPreflight(null);
      return;
    }
    void apiFetch<PreflightResult>(
      `/api/brands/${brandId}/content/${contentId}/publish/preflight?organisationId=${organisationId}`,
      {
        method: "POST",
        organisationId,
        body: JSON.stringify({
          connectionId,
          externalAccountId,
          contentVariantId,
        }),
      },
    )
      .then(setPreflight)
      .catch(() => setPreflight(null));
  }, [brandId, organisationId, contentId, connectionId, externalAccountId, contentVariantId]);

  async function persistAccountSelection(accountId: string) {
    if (!connectionId || !organisationId) return;
    await apiFetch(`/api/integrations/${connectionId}/accounts/select?organisationId=${organisationId}`, {
      method: "POST",
      organisationId,
      body: JSON.stringify({ externalAccountIds: [accountId] }),
    }).catch(() => undefined);
  }

  async function submit(mode: "now" | "schedule") {
    if (!brandId || !organisationId || !connectionId || !externalAccountId) {
      setError("Select a connected Meta account.");
      return;
    }
    if (accounts.length > 1 && !externalAccountId) {
      setError("Choose which Instagram business account to publish to.");
      return;
    }
    if (mode === "schedule" && !scheduledFor) {
      setError("Choose a schedule time.");
      return;
    }
    if (preflight && !preflight.ready) {
      setError(preflight.blockers[0] ?? "Content is not ready to publish.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await persistAccountSelection(externalAccountId);
      await apiFetch(`/api/brands/${brandId}/content/${contentId}/publish?organisationId=${organisationId}`, {
        method: "POST",
        organisationId,
        body: JSON.stringify({
          contentItemId: contentId,
          contentVariantId,
          connectionId,
          externalAccountId,
          destinationType: "account",
          destinationId: externalAccountId,
          operationType: mode === "schedule" ? "SOCIAL_SCHEDULE_POST" : "SOCIAL_PUBLISH_POST",
          scheduledFor: mode === "schedule" ? new Date(scheduledFor).toISOString() : undefined,
          timezone: workspaceTimezone,
          idempotencyKey,
        }),
      });
      onPublished?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publishing failed.");
    } finally {
      setLoading(false);
    }
  }

  if (connections.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Connect Instagram via Integrations → Meta to publish. Publishing requires an active
        ProviderConnection with a selected Instagram Business account.
      </p>
    );
  }

  const approved = contentStatus === "APPROVED";

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Instagram publishing</p>
        <Badge variant={approved ? "default" : "warning"}>
          {approved ? "Approved" : "Approve content to publish"}
        </Badge>
      </div>

      <label className="block text-sm">
        <span className="text-muted-foreground">Meta connection</span>
        <select
          className="mt-1 w-full rounded-md border px-2 py-1.5"
          value={connectionId}
          onChange={(e) => setConnectionId(e.target.value)}
        >
          <option value="">Select connection…</option>
          {connections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.displayName ?? c.providerKey} ({c.status})
            </option>
          ))}
        </select>
      </label>

      {accounts.length > 0 ? (
        <label className="block text-sm">
          <span className="text-muted-foreground">Instagram account</span>
          <select
            className="mt-1 w-full rounded-md border px-2 py-1.5"
            value={externalAccountId}
            onChange={(e) => setExternalAccountId(e.target.value)}
          >
            {accounts.length > 1 ? <option value="">Select account…</option> : null}
            {accounts.map((a) => (
              <option key={a.externalAccountId} value={a.externalAccountId}>
                {a.displayName} ({a.accountType})
              </option>
            ))}
          </select>
        </label>
      ) : connectionId ? (
        <p className="text-sm text-amber-700">
          No Instagram Business accounts found. Ensure your Meta Page is linked to an Instagram
          professional account with publishing permissions.
        </p>
      ) : null}

      {preflight ? (
        <div className="rounded-md bg-muted/40 p-2 text-xs">
          <p>
            Media: {preflight.mediaCount} file(s) · type {preflight.mediaType ?? "unknown"}
          </p>
          {preflight.warnings.map((warning) => (
            <p key={warning} className="text-amber-700">
              {warning}
            </p>
          ))}
          {!preflight.ready
            ? preflight.blockers.map((blocker) => (
                <p key={blocker} className="text-red-600">
                  {blocker}
                </p>
              ))
            : (
              <p className="text-green-700">Ready to publish (single image, carousel, or reel).</p>
            )}
        </div>
      ) : null}

      <label className="block text-sm">
        <span className="text-muted-foreground">
          Schedule for ({workspaceTimezone})
        </span>
        <input
          type="datetime-local"
          className="mt-1 w-full rounded-md border px-2 py-1.5"
          value={scheduledFor}
          onChange={(e) => setScheduledFor(e.target.value)}
        />
      </label>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={disabled || loading || !approved || (preflight ? !preflight.ready : false)}
          onClick={() => void submit("now")}
        >
          Post now
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={
            disabled || loading || !approved || !scheduledFor || (preflight ? !preflight.ready : false)
          }
          onClick={() => void submit("schedule")}
        >
          Schedule
        </Button>
      </div>
    </div>
  );
}
