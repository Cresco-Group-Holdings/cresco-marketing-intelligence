"use client";

import { ActivationChecklistPanel } from "@/components/activation/activation-checklist";
import { ActivationNextActionCard } from "@/components/activation/activation-banner";
import { OnboardingWelcome } from "@/components/onboarding/onboarding-welcome";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildOnboardingPreviewActivation,
  type OnboardingVisualPreviewScene,
} from "@/lib/activation/visual-preview-fixture";

export function OnboardingVisualPreview({ scene }: { scene: OnboardingVisualPreviewScene }) {
  if (scene === "welcome") {
    return (
      <div data-visual-preview="true" className="p-8">
        <OnboardingWelcome onContinue={() => {}} invitedMember={false} />
      </div>
    );
  }

  if (scene === "demo-entry") {
    return (
      <div data-visual-preview="true" className="space-y-4 p-8">
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Demo Workspace</p>
          <p className="mt-1">
            Clearly labelled demo data. No real publications, provider actions, or billing usage.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Demo Command Centre</CardTitle>
            <CardDescription>Explore sample insights and recommendations.</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant="warning">Demo Data</Badge>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activation = buildOnboardingPreviewActivation(scene);

  return (
    <div data-visual-preview="true" className="space-y-8 p-8">
      <div className="space-y-2">
        <Badge variant={activation.isActivated ? "default" : "warning"}>
          {activation.status.replaceAll("_", " ")}
        </Badge>
        <h1 className="text-3xl font-semibold text-foreground">
          {scene === "brand"
            ? "Create your brand"
            : scene === "brand-knowledge"
              ? "Brand Knowledge"
              : scene === "integrations"
                ? "Connect your marketing stack"
                : scene === "sync"
                  ? "Initial sync running"
                  : scene === "first-content"
                    ? "Create your first content"
                    : scene === "success"
                      ? "Your Cresco workspace is ready"
                      : scene === "requires-admin"
                        ? "Getting started"
                        : "Command Centre activation"}
        </h1>
        <p className="text-sm text-foreground-muted">
          {scene === "requires-admin"
            ? "You joined an existing organisation. Some setup steps require an admin."
            : "Complete essential setup to reach your first meaningful result."}
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <ActivationChecklistPanel checklist={activation.checklist} />
        <ActivationNextActionCard nextAction={activation.nextAction} />
      </div>
    </div>
  );
}
