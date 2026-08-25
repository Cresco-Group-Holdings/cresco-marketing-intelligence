"use client";

import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ActivationNextAction } from "@/lib/activation/next-action";
import type { ActivationState } from "@/server/services/activation-service";

type ActivationBannerProps = {
  activation: Pick<
    ActivationState,
    | "status"
    | "essentialCompleted"
    | "essentialTotal"
    | "nextAction"
    | "demoModeEnabled"
    | "syncInProgress"
    | "isActivated"
  >;
};

export function ActivationBanner({ activation }: ActivationBannerProps) {
  if (activation.isActivated || activation.status === "completed") {
    return null;
  }

  const nextAction = activation.nextAction;
  if (!nextAction) {
    return null;
  }

  return (
    <Card className="border-primary/20 bg-surface-elevated">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">
            {activation.essentialCompleted < activation.essentialTotal
              ? `Complete these steps to unlock your marketing overview (${activation.essentialCompleted} of ${activation.essentialTotal} essential steps done)`
              : "Your workspace is almost ready"}
          </p>
          <p className="text-sm text-foreground-muted">
            <span className="font-medium text-foreground">{nextAction.title}.</span>{" "}
            {nextAction.description}
          </p>
          {activation.syncInProgress ? (
            <p className="text-sm text-foreground-subtle">
              Initial sync is running — you can continue setup while analytics load.
            </p>
          ) : null}
          {activation.demoModeEnabled ? (
            <p className="text-sm text-amber-700">Demo Data — sample metrics only.</p>
          ) : null}
        </div>
        <ButtonLink href={nextAction.href} size="sm">
          {nextAction.title}
        </ButtonLink>
      </CardContent>
    </Card>
  );
}

export function ActivationNextActionCard({ nextAction }: { nextAction: ActivationNextAction | null }) {
  if (!nextAction) {
    return null;
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground-subtle">
            Next best action
          </p>
          <p className="mt-1 text-lg font-semibold text-foreground">{nextAction.title}</p>
          <p className="mt-1 text-sm text-foreground-muted">{nextAction.description}</p>
          {nextAction.unlocks ? (
            <p className="mt-2 text-sm text-foreground-subtle">Unlocks: {nextAction.unlocks}</p>
          ) : null}
        </div>
        <ButtonLink href={nextAction.href}>Continue</ButtonLink>
      </CardContent>
    </Card>
  );
}
