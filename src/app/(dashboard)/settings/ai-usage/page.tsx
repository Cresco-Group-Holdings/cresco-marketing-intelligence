"use client";

import { useEffect, useState } from "react";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api/client";

type UsageResponse = {
  dashboard: {
    requestsToday: number;
    totalTokensToday: number;
    estimatedCostUsdToday: number;
    activeAutomations: number;
    pendingApprovals: number;
    completedActionsToday: number;
    failedActionsToday: number;
  };
  summary: {
    organisationTokensToday: number;
    userTokensToday: number;
    organisationBudgetRemaining: number;
    userBudgetRemaining: number;
  };
  providerStatus: Array<{ provider: string; configured: boolean }>;
  aiConfigured: boolean;
};

export default function AiUsagePage() {
  const { preference } = useWorkspace();
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const organisationId = preference.currentOrganisationId;

  useEffect(() => {
    if (!organisationId) return;
    void apiFetch<UsageResponse>(`/api/ai/usage?organisationId=${organisationId}`, {
      organisationId,
    })
      .then(setUsage)
      .catch((err) => setError(err instanceof Error ? err.message : "Usage data unavailable."));
  }, [organisationId]);

  return (
    <>
      <PageHeader
        title="AI & automation usage"
        description="Organisation-level AI requests, estimated cost, and automation activity. Provider secrets are never exposed."
        breadcrumbs={[
          { label: "Settings", href: "/settings" },
          { label: "AI & automation usage" },
        ]}
      />

      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}

      {usage && !usage.aiConfigured ? (
        <Card className="mb-4 border-warning/40 bg-warning/5">
          <CardHeader>
            <CardTitle>AI provider not configured</CardTitle>
            <CardDescription>
              AI features require server-side provider credentials. Contact your administrator to configure OpenAI,
              Anthropic, or Google AI. No mock responses are used in production.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>AI requests today</CardTitle>
            <CardDescription>Completed AI requests for this organisation.</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold text-foreground">
            {usage?.dashboard.requestsToday ?? "—"}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Estimated cost today</CardTitle>
            <CardDescription>Based on recorded token usage.</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold text-foreground">
            {usage ? `$${Number(usage.dashboard.estimatedCostUsdToday).toFixed(4)}` : "—"}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Token budget remaining</CardTitle>
            <CardDescription>Organisation daily allowance.</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold text-foreground">
            {usage?.summary.organisationBudgetRemaining ?? "—"}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active automations</CardTitle>
            <CardDescription>Workflows currently enabled.</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold text-foreground">
            {usage?.dashboard.activeAutomations ?? "—"}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Approvals pending</CardTitle>
            <CardDescription>Agent and automation actions awaiting review.</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold text-foreground">
            {usage?.dashboard.pendingApprovals ?? "—"}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Automation actions today</CardTitle>
            <CardDescription>Completed vs failed workflow actions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-foreground-muted">
            <p>Completed: {usage?.dashboard.completedActionsToday ?? "—"}</p>
            <p>Failed: {usage?.dashboard.failedActionsToday ?? "—"}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Provider availability</CardTitle>
          <CardDescription>
            Configuration status only — API keys remain server-side and are never returned to the browser.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-foreground-muted">
          {usage?.providerStatus.map((provider) => (
            <p key={provider.provider}>
              {provider.provider}: {provider.configured ? "configured" : "not configured"}
            </p>
          )) ?? <p>Loading provider status…</p>}
        </CardContent>
      </Card>
    </>
  );
}
