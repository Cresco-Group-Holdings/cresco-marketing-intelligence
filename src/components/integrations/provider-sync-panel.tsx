"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, History, Play, RefreshCw } from "lucide-react";

type SyncPanelProps = {
  connectionId: string;
  providerKey: string;
  connectionStatus: string;
};

type SyncConfig = {
  schedule: string;
  resourceTypes: string[];
  backfillDays: number;
  enabled: boolean;
};

type SyncRun = {
  id: string;
  status: string;
  recordsProcessed: number;
  recordsFailed: number;
  partialFailure: boolean;
  createdAt: string;
};

function orgHeaders(): Record<string, string> {
  const orgId = document.body.dataset.organisationId;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (orgId) headers["x-organisation-id"] = orgId;
  return headers;
}

export function ProviderSyncPanel({ connectionId, connectionStatus }: SyncPanelProps) {
  const [config, setConfig] = useState<SyncConfig | null>(null);
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [freshness, setFreshness] = useState<{ fresh: boolean; staleHours: number | null } | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    void loadSyncState();
  }, [connectionId]);

  async function loadSyncState() {
    setLoading(true);
    try {
      const headers = orgHeaders();
      const [configRes, runsRes, freshnessRes] = await Promise.all([
        fetch(`/api/integrations/${connectionId}/sync/config`, { headers }),
        fetch(`/api/integrations/${connectionId}/sync/runs`, { headers }),
        fetch(`/api/integrations/${connectionId}/sync/freshness`, { headers }),
      ]);
      if (configRes.ok) {
        const data = await configRes.json();
        setConfig(data.data?.config ?? null);
      }
      if (runsRes.ok) {
        const data = await runsRes.json();
        setRuns(data.data?.runs ?? []);
      }
      if (freshnessRes.ok) {
        const data = await freshnessRes.json();
        setFreshness({ fresh: data.data?.fresh, staleHours: data.data?.staleHours });
      }
    } finally {
      setLoading(false);
    }
  }

  async function runSync(syncMode: "MANUAL" | "FULL" | "INCREMENTAL" | "BACKFILL") {
    setSyncing(true);
    setError(null);
    setWarnings([]);
    try {
      const response = await fetch(`/api/integrations/${connectionId}/sync/run`, {
        method: "POST",
        headers: orgHeaders(),
        body: JSON.stringify({ syncMode }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message ?? "Sync failed.");
      if (data.data?.warnings?.length) setWarnings(data.data.warnings);
      await loadSyncState();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return <p className="text-xs text-muted-foreground">Loading sync status...</p>;
  }

  const canSync = connectionStatus === "CONNECTED" || connectionStatus === "RECONNECTED";

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium">Data sync</p>
        {freshness && !freshness.fresh ? (
          <span className="inline-flex items-center gap-1 text-xs text-amber-700">
            <AlertTriangle className="h-3 w-3" />
            Stale
          </span>
        ) : null}
      </div>

      {config ? (
        <p className="text-xs text-muted-foreground">
          Schedule: {config.schedule} · Resources: {config.resourceTypes.slice(0, 3).join(", ")}
          {config.resourceTypes.length > 3 ? "…" : ""}
        </p>
      ) : null}

      {warnings.length > 0 ? (
        <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
          {warnings.slice(0, 3).map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}

      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!canSync || syncing}
          onClick={() => void runSync("INCREMENTAL")}
          className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs disabled:opacity-50"
        >
          {syncing ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
          Sync now
        </button>
        <button
          type="button"
          disabled={!canSync || syncing}
          onClick={() => void runSync("BACKFILL")}
          className="rounded border px-2 py-1 text-xs disabled:opacity-50"
        >
          Backfill
        </button>
      </div>

      {runs.length > 0 ? (
        <div className="space-y-1">
          <p className="inline-flex items-center gap-1 text-xs font-medium">
            <History className="h-3 w-3" />
            Recent syncs
          </p>
          {runs.slice(0, 3).map((run) => (
            <p key={run.id} className="text-xs text-muted-foreground">
              {run.status} · {run.recordsProcessed} records
              {run.partialFailure ? " (partial)" : ""}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
