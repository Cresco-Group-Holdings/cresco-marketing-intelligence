"use client";

import { useState } from "react";
import { AlertTriangle, KeyRound, Mail, Shield } from "lucide-react";

type ResendConnectionPanelProps = {
  connection?: {
    id: string;
    status: string;
    displayName: string | null;
    lastSuccessfulAt: string | null;
    lastHealthCheckAt: string | null;
  };
  onConnected: () => void;
};

export function ResendConnectionPanel({ connection, onConnected }: ResendConnectionPanelProps) {
  const [displayName, setDisplayName] = useState(connection?.displayName ?? "Resend Production");
  const [apiKey, setApiKey] = useState("");
  const [defaultDomain, setDefaultDomain] = useState("");
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [testMode, setTestMode] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  async function connect() {
    setSubmitting(true);
    setError(null);
    try {
      const orgId = document.body.dataset.organisationId;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (orgId) headers["x-organisation-id"] = orgId;

      const response = await fetch("/api/providers/resend/connect", {
        method: "POST",
        headers,
        body: JSON.stringify({
          displayName,
          apiKey,
          defaultSendingDomain: defaultDomain || undefined,
          environment: "PRODUCTION",
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message ?? "Connection failed.");
      }

      setFingerprint(data.data?.connection?.fingerprint ?? null);
      setApiKey("");
      onConnected();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function testConnection() {
    if (!connection?.id) return;
    setSubmitting(true);
    setError(null);
    try {
      const orgId = document.body.dataset.organisationId;
      const headers: Record<string, string> = {};
      if (orgId) headers["x-organisation-id"] = orgId;

      const response = await fetch(`/api/providers/connections/${connection.id}/test`, {
        method: "POST",
        headers,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message ?? "Test failed.");
      setTestResult(
        `Connected — ${data.data?.test?.verifiedDomainCount ?? 0} verified domain(s), health: ${data.data?.test?.health}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Mail className="h-5 w-5" />
        <h2 className="font-semibold">Resend</h2>
      </div>

      <div className="rounded-md bg-muted/50 p-3 text-xs space-y-1">
        <p className="flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> Never paste production keys into support messages.</p>
        <p className="flex items-center gap-1"><KeyRound className="h-3.5 w-3.5" /> Use a restricted sending key where possible.</p>
        <p className="flex items-center gap-1"><Shield className="h-3.5 w-3.5" /> Production sending requires a verified domain and explicit approval.</p>
        <p>Live sends require PROVIDER_LIVE_CALLS_ENABLED and connection live_sending flag.</p>
      </div>

      {connection ? (
        <div className="space-y-2 text-sm">
          <p>Status: <span className="font-medium">{connection.status}</span></p>
          {fingerprint && <p>Key fingerprint: <code>{fingerprint}</code></p>}
          {connection.lastSuccessfulAt && (
            <p>Last success: {new Date(connection.lastSuccessfulAt).toLocaleString()}</p>
          )}
          {testResult && <p className="text-green-700">{testResult}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => void testConnection()} disabled={submitting} className="rounded-md border px-3 py-1.5 text-sm">
              Test connection
            </button>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={testMode} onChange={(e) => setTestMode(e.target.checked)} />
              Test mode (no live API calls)
            </label>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <label className="block text-sm">
            Connection name
            <input className="mt-1 w-full rounded border px-2 py-1" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </label>
          <label className="block text-sm">
            API key
            <input type="password" className="mt-1 w-full rounded border px-2 py-1" value={apiKey} onChange={(e) => setApiKey(e.target.value)} autoComplete="off" />
          </label>
          <label className="block text-sm">
            Default sending domain (optional)
            <input className="mt-1 w-full rounded border px-2 py-1" value={defaultDomain} onChange={(e) => setDefaultDomain(e.target.value)} placeholder="mail.example.com" />
          </label>
          <button type="button" onClick={() => void connect()} disabled={submitting || !apiKey} className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50">
            Connect Resend
          </button>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
