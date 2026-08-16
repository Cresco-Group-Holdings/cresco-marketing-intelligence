"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";

type ConnectionOption = {
  id: string;
  providerKey: string;
  displayName: string | null;
  externalAccountId: string | null;
  status: string;
};

type AccountOption = {
  externalAccountId: string;
  displayName: string;
  accountType: string;
};

type Props = {
  brandId: string | null;
  organisationId: string | null;
  contentId: string;
  contentVariantId?: string;
  disabled?: boolean;
  onPublished?: () => void;
};

export function CanonicalPublishPanel({
  brandId,
  organisationId,
  contentId,
  contentVariantId,
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
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  useEffect(() => {
    if (!organisationId) return;
    void apiFetch<{ connections: ConnectionOption[] }>(
      `/api/integrations?organisationId=${organisationId}`,
      { organisationId },
    )
      .then((data) => {
        const metaConnections = data.connections.filter(
          (c) => c.providerKey === "meta" && c.status === "CONNECTED",
        );
        setConnections(metaConnections);
        if (metaConnections[0]) setConnectionId(metaConnections[0].id);
      })
      .catch(() => setConnections([]));
  }, [organisationId]);

  useEffect(() => {
    if (!connectionId || !organisationId) return;
    void apiFetch<{ accounts: AccountOption[] }>(
      `/api/integrations/${connectionId}/accounts?organisationId=${organisationId}`,
      { organisationId },
    )
      .then((data) => {
        const igAccounts = data.accounts.filter((a) => a.accountType.includes("instagram"));
        setAccounts(igAccounts);
        if (igAccounts[0]) setExternalAccountId(igAccounts[0].externalAccountId);
      })
      .catch(() => setAccounts([]));
  }, [connectionId, organisationId]);

  async function submit(mode: "now" | "schedule") {
    if (!brandId || !organisationId || !connectionId || !externalAccountId) {
      setError("Select a connected Meta account.");
      return;
    }
    if (mode === "schedule" && !scheduledFor) {
      setError("Choose a schedule time.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
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
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
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
        Connect a Meta account in Integrations to publish through the canonical path.
      </p>
    );
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      <p className="text-sm font-medium">Publish via ProviderConnection</p>
      <label className="block text-sm">
        <span className="text-muted-foreground">Connection</span>
        <select
          className="mt-1 w-full rounded-md border px-2 py-1.5"
          value={connectionId}
          onChange={(e) => setConnectionId(e.target.value)}
        >
          {connections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.displayName ?? c.providerKey}
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
            {accounts.map((a) => (
              <option key={a.externalAccountId} value={a.externalAccountId}>
                {a.displayName}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="block text-sm">
        <span className="text-muted-foreground">Schedule for (optional)</span>
        <input
          type="datetime-local"
          className="mt-1 w-full rounded-md border px-2 py-1.5"
          value={scheduledFor}
          onChange={(e) => setScheduledFor(e.target.value)}
        />
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex gap-2">
        <Button size="sm" disabled={disabled || loading} onClick={() => void submit("now")}>
          Post now
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || loading || !scheduledFor}
          onClick={() => void submit("schedule")}
        >
          Schedule
        </Button>
      </div>
    </div>
  );
}
