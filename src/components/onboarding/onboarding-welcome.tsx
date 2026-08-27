"use client";

import { useState } from "react";
import { BrandMarketingChannel } from "@prisma/client";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api/client";
import type { ActivationGoal } from "@/lib/activation/providers";
import { MARKETING_CHANNEL_LABELS, MARKETING_CHANNELS } from "@/lib/onboarding/marketing";

const PERSONA_OPTIONS = [
  "Founder",
  "Marketing Lead",
  "Marketing Team Member",
  "Agency",
  "Consultant / Solo Marketer",
] as const;

const GOAL_OPTIONS: Array<{ value: ActivationGoal; label: string }> = [
  { value: "grow_organic_reach", label: "Grow organic reach" },
  { value: "create_better_content", label: "Create better content" },
  { value: "understand_performance", label: "Understand marketing performance" },
  { value: "improve_paid_advertising", label: "Improve paid advertising" },
  { value: "track_conversions", label: "Track conversions/revenue" },
  { value: "manage_in_one_place", label: "Manage marketing in one place" },
];

type OnboardingWelcomeProps = {
  onContinue: () => void;
  invitedMember?: boolean;
};

export function OnboardingWelcome({ onContinue, invitedMember = false }: OnboardingWelcomeProps) {
  const [phase, setPhase] = useState<"welcome" | "preferences">("welcome");
  const [persona, setPersona] = useState<string | null>(null);
  const [goal, setGoal] = useState<ActivationGoal | null>(null);
  const [channels, setChannels] = useState<BrandMarketingChannel[]>([]);
  const [saving, setSaving] = useState(false);

  async function savePreferencesAndContinue() {
    setSaving(true);
    try {
      await apiFetch("/api/activation/preferences", {
        method: "POST",
        body: JSON.stringify({
          persona,
          goal,
          channels,
        }),
      });
      onContinue();
    } finally {
      setSaving(false);
    }
  }

  function toggleChannel(channel: BrandMarketingChannel) {
    setChannels((current) =>
      current.includes(channel)
        ? current.filter((item) => item !== channel)
        : [...current, channel],
    );
  }

  if (phase === "welcome") {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">Welcome to Cresco</h1>
          <p className="text-sm text-foreground-muted">
            Let&apos;s connect enough context for Cresco to start helping you grow.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Essential setup</CardTitle>
            <CardDescription>
              {invitedMember
                ? "You joined an existing organisation. We will skip owner-only steps where possible."
                : "A short guided path to your first meaningful result."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-foreground-muted">
            <p>1. Organisation</p>
            <p>2. Brand</p>
            <p>3. Brand Knowledge</p>
            <p>4. Connect data</p>
            <p>5. Create first content</p>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={() => setPhase("preferences")}>Continue setup</Button>
              <ButtonLink href="/demo" variant="outline">
                Explore demo workspace
              </ButtonLink>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground">Personalise your setup</h1>
        <p className="text-sm text-foreground-muted">
          Optional — helps Cresco prioritise recommendations during onboarding.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>What best describes your role?</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {PERSONA_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              className={`rounded-full border px-3 py-1.5 text-sm ${
                persona === option ? "border-primary bg-primary/5 font-medium" : "border-border"
              }`}
              onClick={() => setPersona(option)}
            >
              {option}
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What do you want Cresco to help with first?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {GOAL_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                goal === option.value ? "border-primary bg-primary/5 font-medium" : "border-border"
              }`}
              onClick={() => setGoal(option.value)}
            >
              {option.label}
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Where do you currently market?</CardTitle>
          <CardDescription>Used to prioritise integration suggestions.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {MARKETING_CHANNELS.map((channel) => (
            <button
              key={channel}
              type="button"
              className={`rounded-full border px-3 py-1.5 text-sm ${
                channels.includes(channel) ? "border-primary bg-primary/5 font-medium" : "border-border"
              }`}
              onClick={() => toggleChannel(channel)}
            >
              {MARKETING_CHANNEL_LABELS[channel]}
            </button>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => setPhase("welcome")}>
          Back
        </Button>
        <Button disabled={saving} onClick={() => void savePreferencesAndContinue()}>
          Continue to workspace setup
        </Button>
        <Button variant="outline" disabled={saving} onClick={onContinue}>
          Skip for now
        </Button>
      </div>
    </div>
  );
}
