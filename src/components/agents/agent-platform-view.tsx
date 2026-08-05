"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { AGENT_KEYS } from "@/lib/agent-platform/constants";

type AgentDefinition = {
  key: string;
  name: string;
  description: string;
};

type AgentRun = {
  id: string;
  agentKey: string;
  status: string;
  summary?: string | null;
  createdAt: string;
};

export function AgentPlatformView() {
  const { preference } = useWorkspace();
  const organisationId = preference.currentOrganisationId;

  const [agents, setAgents] = useState<AgentDefinition[]>([]);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    if (!organisationId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ organisationId });
      const [definitionsRes, runsRes] = await Promise.all([
        fetch(`/api/agents/definitions?${params.toString()}`),
        fetch(`/api/agents/runs?${params.toString()}`),
      ]);
      if (!definitionsRes.ok || !runsRes.ok) {
        throw new Error("Failed to load agent platform.");
      }
      const definitionsPayload = await definitionsRes.json();
      const runsPayload = await runsRes.json();
      setAgents(definitionsPayload.data.agents ?? []);
      setRuns(runsPayload.data.runs ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load agents.");
    } finally {
      setLoading(false);
    }
  }, [organisationId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runSampleAgent() {
    if (!organisationId) return;
    setRunning(true);
    setError(null);
    try {
      const response = await fetch(`/api/agents/runs?organisationId=${organisationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentKey: AGENT_KEYS.MARKETING_ANALYST,
          userInput: "Summarise available performance data and explain limitations.",
          brandId: preference.currentBrandId ?? undefined,
          projectId: preference.currentProjectId ?? undefined,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? "Agent run failed.");
      }
      await load();
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Agent run failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI agents"
        description="Governed agent platform for analysis, recommendations, and proposed actions."
      />

      {loading ? <p className="text-sm text-muted-foreground">Loading agent platform…</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex gap-2">
        <Button onClick={() => void runSampleAgent()} disabled={running || !organisationId}>
          {running ? "Running analyst agent…" : "Run marketing analyst"}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Registered agents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {agents.map((agent) => (
              <div key={agent.key}>
                <p className="font-medium">{agent.name}</p>
                <p className="text-muted-foreground">{agent.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent runs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {runs.length === 0 ? (
              <p className="text-muted-foreground">No agent runs yet.</p>
            ) : (
              runs.map((run) => (
                <div key={run.id} className="border-b pb-2">
                  <p className="font-medium">{run.agentKey}</p>
                  <p className="text-muted-foreground">{run.status}</p>
                  <p>{run.summary ?? "—"}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
