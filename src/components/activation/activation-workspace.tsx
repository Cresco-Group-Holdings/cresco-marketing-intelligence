"use client";

import { useCallback, useEffect, useState } from "react";
import { BrandMarketingChannel } from "@prisma/client";
import { ActivationChecklistPanel } from "@/components/activation/activation-checklist";
import { ActivationNextActionCard } from "@/components/activation/activation-banner";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/empty-state";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api/client";
import type { ActivationGoal } from "@/lib/activation/providers";
import type { ActivationState } from "@/server/services/activation-service";

const GOAL_OPTIONS: Array<{ value: ActivationGoal; label: string }> = [
  { value: "grow_organic_reach", label: "Grow organic reach" },
  { value: "create_better_content", label: "Create better content" },
  { value: "understand_performance", label: "Understand marketing performance" },
  { value: "improve_paid_advertising", label: "Improve paid advertising" },
  { value: "track_conversions", label: "Track conversions and revenue" },
  { value: "manage_in_one_place", label: "Manage marketing in one place" },
];

export function ActivationWorkspace() {
  const [activation, setActivation] = useState<ActivationState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingDemo, setSavingDemo] = useState(false);

  const loadActivation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch<{ activation: ActivationState }>("/api/activation");
      setActivation(response.activation);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load activation state.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadActivation();
  }, [loadActivation]);

  async function enableDemoMode() {
    setSavingDemo(true);
    try {
      const response = await apiFetch<{ activation: ActivationState }>("/api/activation/demo", {
        method: "POST",
        body: JSON.stringify({ enabled: true }),
      });
      setActivation(response.activation);
      window.location.href = "/demo";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to enable demo mode.");
    } finally {
      setSavingDemo(false);
    }
  }

  async function saveGoal(goal: ActivationGoal) {
    const response = await apiFetch<{ activation: ActivationState }>("/api/activation/preferences", {
      method: "POST",
      body: JSON.stringify({ goal }),
    });
    setActivation(response.activation);
  }

  if (loading && !activation) {
    return <DashboardSkeleton />;
  }

  if (!activation) {
    return (
      <ErrorState
        title="Activation status unavailable"
        description={error ?? "Try again in a moment."}
        onRetry={() => void loadActivation()}
      />
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Badge variant={activation.isActivated ? "default" : "warning"}>
          {activation.status.replaceAll("_", " ")}
        </Badge>
        <h1 className="text-3xl font-semibold text-foreground">Welcome to Cresco</h1>
        <p className="max-w-2xl text-sm text-foreground-muted">
          Let&apos;s connect enough context for Cresco to start helping you grow. Complete essential
          setup at your pace — optional steps can wait until you need them.
        </p>
        {activation.invitedMember ? (
          <p className="text-sm text-foreground-muted">
            You joined an existing organisation. Focus on your assigned brand and recommended next
            steps below.
          </p>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <ActivationChecklistPanel checklist={activation.checklist} />

          {activation.brandKnowledge ? (
            <Card>
              <CardHeader>
                <CardTitle>Brand Knowledge readiness</CardTitle>
                <CardDescription>
                  Essential context is required for strong first drafts. Recommended context improves
                  intelligence over time.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <ReadinessTierCard tier={activation.brandKnowledge.essential} />
                <ReadinessTierCard tier={activation.brandKnowledge.recommended} />
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Connect your marketing stack</CardTitle>
              <CardDescription>
                Start with the smallest useful set. Each connection unlocks specific capabilities.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {activation.providerRecommendations.recommended.map((provider) => (
                <ProviderRecommendationCard key={provider.providerKey} provider={provider} />
              ))}
              {activation.providerRecommendations.optional.length > 0 ? (
                <div className="space-y-3 border-t border-border pt-4">
                  <p className="text-sm font-medium text-foreground-subtle">Optional</p>
                  {activation.providerRecommendations.optional.slice(0, 3).map((provider) => (
                    <ProviderRecommendationCard key={provider.providerKey} provider={provider} />
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <ActivationNextActionCard nextAction={activation.nextAction} />

          <Card>
            <CardHeader>
              <CardTitle>Personalise your path</CardTitle>
              <CardDescription>
                This prioritises recommendations — it does not hide modules permanently.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {GOAL_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                    activation.preferences.goal === option.value
                      ? "border-primary bg-primary/5 font-medium"
                      : "border-border hover:border-border-strong"
                  }`}
                  onClick={() => void saveGoal(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </CardContent>
          </Card>

          {!activation.demoModeEnabled ? (
            <Card>
              <CardHeader>
                <CardTitle>Explore with demo data</CardTitle>
                <CardDescription>
                  Preview Command Centre, organic growth, and recommendations without connecting
                  real accounts.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-foreground-muted">
                  Demo data is clearly labelled and isolated from your production workspace.
                </p>
                <Button disabled={savingDemo} onClick={() => void enableDemoMode()}>
                  Enter demo workspace
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Demo workspace active</CardTitle>
                <CardDescription>Sample data only — no real publications or billing usage.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <ButtonLink href="/demo">Open demo Command Centre</ButtonLink>
                <ButtonLink href="/getting-started?connect=1" variant="outline">
                  Connect real data
                </ButtonLink>
              </CardContent>
            </Card>
          )}

          {activation.isActivated ? (
            <Card>
              <CardHeader>
                <CardTitle>Your Cresco workspace is ready</CardTitle>
                <CardDescription>
                  Cresco has enough context to start helping you.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ButtonLink href="/dashboard">Open Command Centre</ButtonLink>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ReadinessTierCard({
  tier,
}: {
  tier: NonNullable<ActivationState["brandKnowledge"]>["essential"];
}) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-sm font-medium text-foreground">{tier.label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">
        {tier.filled}/{tier.total}
      </p>
      <p className="mt-2 text-sm text-foreground-muted">{tier.guidance}</p>
    </div>
  );
}

function ProviderRecommendationCard({
  provider,
}: {
  provider: ActivationState["providerRecommendations"]["recommended"][number];
}) {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{provider.label}</p>
          <p className="mt-1 text-sm text-foreground-muted">
            Unlocks: {provider.unlocks.join(" · ")}
          </p>
        </div>
        <ButtonLink href={provider.connectHref} variant="outline" size="sm">
          Connect
        </ButtonLink>
      </div>
    </div>
  );
}
