"use client";

import { useEffect, useState } from "react";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api/client";

type DiagnosticsConfig = {
  enabled: boolean;
  providers: Array<{ provider: string; configured: boolean }>;
  models: Array<{ provider: string; modelId: string; displayName: string; available: boolean }>;
};

type DiagnosticsResult = {
  result: {
    output: unknown;
    latencyMs: number;
    estimatedCostUsd: number;
    provider: string;
    model: string;
    usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  };
  usage: {
    organisationTokensToday: number;
    userTokensToday: number;
    organisationBudgetRemaining: number;
    userBudgetRemaining: number;
  };
};

export default function AiDiagnosticsPage() {
  const { preference } = useWorkspace();
  const [config, setConfig] = useState<DiagnosticsConfig | null>(null);
  const [result, setResult] = useState<DiagnosticsResult | null>(null);
  const [userInput, setUserInput] = useState("Reply with a short safe acknowledgement.");
  const [mode, setMode] = useState<"text" | "structured">("text");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const organisationId = preference.currentOrganisationId;

  useEffect(() => {
    if (!organisationId) return;
    void apiFetch<DiagnosticsConfig>(`/api/ai/diagnostics?organisationId=${organisationId}`, {
      organisationId,
    })
      .then(setConfig)
      .catch((err) => setError(err instanceof Error ? err.message : "Diagnostics unavailable."));
  }, [organisationId]);

  async function runTest() {
    if (!organisationId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<DiagnosticsResult>(
        `/api/ai/diagnostics?organisationId=${organisationId}`,
        {
          method: "POST",
          organisationId,
          body: JSON.stringify({ mode, userInput }),
        },
      );
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Diagnostics test failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader
        title="AI diagnostics"
        description="Administrator and development-only checks for provider configuration, structured output, and usage controls."
        breadcrumbs={[
          { label: "Settings", href: "/settings" },
          { label: "AI diagnostics" },
        ]}
      />

      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Provider configuration</CardTitle>
            <CardDescription>Server-side provider status. Keys are never exposed to the browser.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-foreground-muted">
            {config?.providers.map((provider) => (
              <p key={provider.provider}>
                {provider.provider}: {provider.configured ? "configured" : "not configured"}
              </p>
            ))}
            {config?.models
              .filter((model) => model.available)
              .map((model) => (
                <p key={`${model.provider}-${model.modelId}`}>
                  {model.displayName} ({model.provider})
                </p>
              ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Run test prompt</CardTitle>
            <CardDescription>Harmless diagnostics request with audit and usage recording.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="block text-sm font-medium text-foreground-muted">
              Mode
              <select
                className="mt-2 block w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
                value={mode}
                onChange={(event) => setMode(event.target.value as "text" | "structured")}
              >
                <option value="text">Text</option>
                <option value="structured">Structured JSON</option>
              </select>
            </label>
            <Input label="Test input" value={userInput} onChange={(event) => setUserInput(event.target.value)} />
            <Button onClick={() => void runTest()} disabled={loading || !organisationId}>
              Run diagnostics test
            </Button>
          </CardContent>
        </Card>
      </div>

      {result ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Last result</CardTitle>
            <CardDescription>
              {result.result.provider} / {result.result.model} · {result.result.latencyMs}ms · $
              {result.result.estimatedCostUsd.toFixed(6)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <pre className="overflow-x-auto rounded-lg bg-background-secondary p-4 text-xs text-foreground">
              {JSON.stringify(result.result.output, null, 2)}
            </pre>
            <p className="text-sm text-foreground-muted">
              Tokens today — organisation: {result.usage.organisationTokensToday} (remaining{" "}
              {result.usage.organisationBudgetRemaining}), user: {result.usage.userTokensToday} (remaining{" "}
              {result.usage.userBudgetRemaining})
            </p>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
