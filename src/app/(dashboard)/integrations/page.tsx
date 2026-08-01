"use client";

import { useEffect, useState } from "react";
import { Plug, ShieldCheck, AlertCircle } from "lucide-react";

type ProviderDefinitionView = {
  key: string;
  displayName: string;
  category: string;
  capabilities: string[];
  enabled: boolean;
};

type ProviderConnectionView = {
  id: string;
  providerKey: string;
  displayName: string | null;
  status: string;
  environment: string;
  lastHealthCheckAt: string | null;
  reauthorizationRequired: boolean;
};

export default function IntegrationsPage() {
  const [definitions, setDefinitions] = useState<ProviderDefinitionView[]>([]);
  const [connections, setConnections] = useState<ProviderConnectionView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const orgId = document.body.dataset.organisationId;
        const headers: Record<string, string> = {};
        if (orgId) {
          headers["x-organisation-id"] = orgId;
        }
        const [defsRes, connsRes] = await Promise.all([
          fetch("/api/providers/definitions", { headers }),
          fetch("/api/providers/connections", { headers }),
        ]);
        if (defsRes.ok) {
          const data = await defsRes.json();
          setDefinitions(data.data?.definitions ?? []);
        }
        if (connsRes.ok) {
          const data = await connsRes.json();
          setConnections(data.data?.connections ?? []);
        }
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading integrations...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Connect external providers securely. Live provider calls are disabled until explicitly enabled.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {definitions.map((definition) => {
          const connection = connections.find((item) => item.providerKey === definition.key);
          return (
            <div key={definition.key} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-medium">{definition.displayName}</h2>
                  <p className="text-xs text-muted-foreground">{definition.category}</p>
                </div>
                {definition.enabled ? (
                  <ShieldCheck className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                )}
              </div>

              <div className="flex flex-wrap gap-1">
                {definition.capabilities.slice(0, 3).map((capability) => (
                  <span key={capability} className="rounded bg-muted px-2 py-0.5 text-xs">
                    {capability.replace(/_/g, " ")}
                  </span>
                ))}
              </div>

              <div className="text-sm">
                {connection ? (
                  <p>
                    Status: <span className="font-medium">{connection.status}</span>
                    {connection.reauthorizationRequired ? " (reauth required)" : ""}
                  </p>
                ) : (
                  <p className="text-muted-foreground">
                    {definition.enabled ? "Not connected" : "Coming soon"}
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!definition.enabled}
                  className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  <Plug className="h-3.5 w-3.5" />
                  {connection ? "Configure" : "Connect"}
                </button>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
