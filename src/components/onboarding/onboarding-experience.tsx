"use client";

import { useEffect, useState } from "react";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { OnboardingWelcome } from "@/components/onboarding/onboarding-welcome";
import { useActivationState } from "@/hooks/use-activation-state";

export function OnboardingExperience() {
  const { activation, loading } = useActivationState();
  const [showWelcome, setShowWelcome] = useState(true);

  useEffect(() => {
    if (activation?.onboardingCompleted) {
      setShowWelcome(false);
    }
  }, [activation?.onboardingCompleted]);

  if (loading) {
    return <p className="text-sm text-foreground-muted">Loading onboarding...</p>;
  }

  if (showWelcome) {
    return (
      <OnboardingWelcome
        invitedMember={activation?.invitedMember ?? false}
        onContinue={() => setShowWelcome(false)}
      />
    );
  }

  return <OnboardingWizard />;
}
