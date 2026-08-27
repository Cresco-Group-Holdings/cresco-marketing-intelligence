"use client";

import { useEffect, useState } from "react";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { OnboardingWelcome } from "@/components/onboarding/onboarding-welcome";
import { apiFetch } from "@/lib/api/client";
import type { ActivationState } from "@/server/services/activation-service";

export function OnboardingExperience() {
  const [showWelcome, setShowWelcome] = useState(true);
  const [invitedMember, setInvitedMember] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void apiFetch<{ activation: ActivationState }>("/api/activation")
      .then((response) => {
        setInvitedMember(response.activation.invitedMember);
        if (response.activation.onboardingCompleted) {
          setShowWelcome(false);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-sm text-foreground-muted">Loading onboarding...</p>;
  }

  if (showWelcome) {
    return (
      <OnboardingWelcome
        invitedMember={invitedMember}
        onContinue={() => setShowWelcome(false)}
      />
    );
  }

  return <OnboardingWizard />;
}
