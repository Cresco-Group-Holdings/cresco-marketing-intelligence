"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BrandMarketingChannel,
  MarketingObjectiveType,
  OnboardingStepKey,
} from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api/client";
import { slugFromName } from "@/lib/utils/slug";
import { OnboardingStepProgress } from "@/components/onboarding/onboarding-step-progress";
import { ONBOARDING_STEPS } from "@/lib/onboarding/constants";
import {
  MARKETING_CHANNEL_LABELS,
  MARKETING_CHANNELS,
  MARKETING_OBJECTIVE_LABELS,
  MARKETING_OBJECTIVE_TYPES,
  TARGET_PERIOD_OPTIONS,
} from "@/lib/onboarding/marketing";
import { CRESCO_INTERNAL_TEMPLATE } from "@/lib/onboarding/cresco-template";
import {
  calculateBrandProfileCompleteness,
  hasEssentialBrandProfileFields,
} from "@/lib/brand-profile/completeness";
import type { WorkspaceState } from "@/components/workspace/workspace-provider";

type OnboardingState = {
  progress: {
    currentStep: OnboardingStepKey;
    completedSteps: OnboardingStepKey[];
    templateKey: string | null;
    organisationId: string | null;
    projectId: string | null;
    brandId: string | null;
  };
  profile: {
    displayName: string | null;
    firstName: string | null;
    lastName: string | null;
    timezone: string | null;
    locale: string | null;
  } | null;
  organisation: { id: string; name: string; slug: string; industry: string | null } | null;
  project: { id: string; name: string; slug: string } | null;
  brand: { id: string; name: string; slug: string } | null;
  brandProfile: Record<string, string | null> | null;
  objectives: Array<{
    objectiveType: MarketingObjectiveType;
    description: string;
    priority: number;
    targetValue: string;
    targetPeriod: string;
  }>;
  channelPreferences: Array<{ channel: BrandMarketingChannel }>;
  templateProjects: Array<{
    id: string;
    name: string;
    slug: string;
    brands: Array<{ id: string; name: string; slug: string }>;
  }>;
};

type OnboardingApiResponse = OnboardingState & {
  onboarding?: {
    status: "complete" | "incomplete";
    completedAt: string | null;
  };
};

type OnboardingCompletionResponse = {
  progress: { completedAt: string | null };
  state: OnboardingState & {
    workspace: {
      onboardingCompletedAt: string | null;
      currentOrganisationId: string | null;
      currentProjectId: string | null;
      currentBrandId: string | null;
    };
  };
  onboarding: {
    status: "complete" | "incomplete";
    completedAt: string | null;
  };
};

const LOAD_TIMEOUT_MS = 30_000;

type ObjectiveDraft = {
  objectiveType: MarketingObjectiveType;
  description: string;
  priority: number;
  targetValue: string;
  targetPeriod: string;
  selected: boolean;
};

export function OnboardingWizard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadTimedOut, setLoadTimedOut] = useState(false);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<OnboardingState | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [locale, setLocale] = useState("en-GB");

  const [organisationName, setOrganisationName] = useState("");
  const [organisationSlug, setOrganisationSlug] = useState("");
  const [industry, setIndustry] = useState("");
  const [website, setWebsite] = useState("");

  const [projectName, setProjectName] = useState("");
  const [projectSlug, setProjectSlug] = useState("");
  const [projectDescription, setProjectDescription] = useState("");

  const [brandName, setBrandName] = useState("");
  const [brandSlug, setBrandSlug] = useState("");
  const [brandDescription, setBrandDescription] = useState("");

  const [shortDescription, setShortDescription] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [valueProposition, setValueProposition] = useState("");
  const [mission, setMission] = useState("");

  const [objectiveDrafts, setObjectiveDrafts] = useState<ObjectiveDraft[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<BrandMarketingChannel[]>([]);

  const step = state?.progress.currentStep ?? OnboardingStepKey.ACCOUNT_PROFILE;

  async function loadState() {
    setLoading(true);
    setLoadTimedOut(false);
    setError(null);
    try {
      const data = await apiFetch<OnboardingApiResponse>("/api/onboarding");

      if (data.onboarding?.status === "complete") {
        router.refresh();
        await router.replace("/dashboard");
        return;
      }

      hydrateFromState(data);
      setState(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load onboarding.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!loading) {
      setLoadTimedOut(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setLoadTimedOut(true);
    }, LOAD_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loading]);

  function hydrateFromState(data: OnboardingState) {
    if (data.profile) {
      setDisplayName(data.profile.displayName ?? "");
      setFirstName(data.profile.firstName ?? "");
      setLastName(data.profile.lastName ?? "");
      setTimezone(data.profile.timezone ?? "UTC");
      setLocale(data.profile.locale ?? "en-GB");
    }

    if (data.organisation) {
      setOrganisationName(data.organisation.name);
      setOrganisationSlug(data.organisation.slug);
      setIndustry(data.organisation.industry ?? "");
    }

    if (data.project) {
      setProjectName(data.project.name);
      setProjectSlug(data.project.slug);
    }

    if (data.brand) {
      setBrandName(data.brand.name);
      setBrandSlug(data.brand.slug);
    }

    if (data.brandProfile) {
      setShortDescription(data.brandProfile.shortDescription ?? "");
      setTargetAudience(data.brandProfile.targetAudience ?? "");
      setValueProposition(data.brandProfile.valueProposition ?? "");
      setMission(data.brandProfile.mission ?? "");
    }

    setObjectiveDrafts(
      MARKETING_OBJECTIVE_TYPES.map((objectiveType) => {
        const existing = data.objectives.find((objective) => objective.objectiveType === objectiveType);
        return {
          objectiveType,
          description:
            existing?.description ??
            `Increase ${MARKETING_OBJECTIVE_LABELS[objectiveType].toLowerCase()} for this brand.`,
          priority: existing?.priority ?? 3,
          targetValue: existing ? String(existing.targetValue) : "100",
          targetPeriod: existing?.targetPeriod ?? "90d",
          selected: Boolean(existing),
        };
      }),
    );

    setSelectedChannels(
      data.channelPreferences.length > 0
        ? data.channelPreferences.map((preference) => preference.channel)
        : [BrandMarketingChannel.WEBSITE, BrandMarketingChannel.SEO],
    );
  }

  useEffect(() => {
    void loadState();
  }, []);

  async function saveStep(
    nextStep: OnboardingStepKey,
    data: Record<string, unknown>,
    action: "save" | "back" = "save",
  ) {
    setSaving(true);
    setError(null);
    try {
      const result = await apiFetch<{ state: OnboardingState }>("/api/onboarding", {
        method: "PUT",
        body: JSON.stringify({ step: nextStep, action, data }),
      });
      hydrateFromState(result.state);
      setState(result.state);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save this step.");
    } finally {
      setSaving(false);
    }
  }

  async function applyTemplate() {
    setSaving(true);
    setError(null);
    try {
      const result = await apiFetch<{ state: OnboardingState }>("/api/onboarding", {
        method: "POST",
        body: JSON.stringify({ templateKey: CRESCO_INTERNAL_TEMPLATE.key }),
      });
      hydrateFromState(result.state);
      setState(result.state);
    } catch (templateError) {
      setError(templateError instanceof Error ? templateError.message : "Unable to apply template.");
    } finally {
      setSaving(false);
    }
  }

  async function switchTemplateProject(projectId: string, brandId: string) {
    setSaving(true);
    setError(null);
    try {
      const result = await apiFetch<{ state: OnboardingState }>("/api/onboarding", {
        method: "POST",
        body: JSON.stringify({
          action: "switch-context",
          currentProjectId: projectId,
          currentBrandId: brandId,
        }),
      });
      hydrateFromState(result.state);
      setState(result.state);
    } catch (switchError) {
      setError(switchError instanceof Error ? switchError.message : "Unable to switch project.");
    } finally {
      setSaving(false);
    }
  }

  async function completeOnboarding() {
    setCompleting(true);
    setSaving(true);
    setError(null);
    try {
      const result = await apiFetch<OnboardingCompletionResponse>("/api/onboarding", {
        method: "PUT",
        body: JSON.stringify({ step: OnboardingStepKey.REVIEW, action: "save" }),
      });

      if (result.onboarding.status !== "complete" || !result.onboarding.completedAt) {
        throw new Error("Onboarding completion was not confirmed by the server. Please try again.");
      }

      const workspace = await apiFetch<WorkspaceState>("/api/workspace");
      if (workspace.onboarding?.status !== "complete") {
        throw new Error(
          "Workspace onboarding status was not saved. Please try again before leaving this page.",
        );
      }

      if (!workspace.preference.currentOrganisationId) {
        throw new Error("Workspace context was not created. Please try again.");
      }

      router.refresh();
      await router.replace("/dashboard");
      router.refresh();
    } catch (completeError) {
      setError(
        completeError instanceof Error ? completeError.message : "Unable to complete onboarding.",
      );
    } finally {
      setCompleting(false);
      setSaving(false);
    }
  }

  const profileCompleteness = useMemo(() => {
    if (!state?.brandProfile) {
      return calculateBrandProfileCompleteness({
        shortDescription,
        targetAudience,
        valueProposition,
        mission,
      });
    }

    return calculateBrandProfileCompleteness(state.brandProfile);
  }, [mission, shortDescription, state?.brandProfile, targetAudience, valueProposition]);

  const essentialsComplete = hasEssentialBrandProfileFields({
    shortDescription,
    targetAudience,
    valueProposition,
  });

  if (loading && !state) {
    return (
      <div className="space-y-3 text-sm text-foreground-muted">
        <p>Loading onboarding...</p>
        {loadTimedOut ? (
          <p className="text-amber-700">
            This is taking longer than expected. Check your connection or try again.
          </p>
        ) : null}
      </div>
    );
  }

  if (!state) {
    return (
      <div className="space-y-4 rounded-lg border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
        <p className="font-medium">We couldn&apos;t load your onboarding status.</p>
        <p>{error ?? "An unexpected error occurred while loading onboarding."}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void loadState()}>
            Try again
          </Button>
          <Button variant="outline" onClick={() => void router.replace("/dashboard")}>
            Return to dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground-subtle">
          Step {ONBOARDING_STEPS.indexOf(step) + 1} of {ONBOARDING_STEPS.length}
        </p>
        <h1 className="text-3xl font-semibold text-foreground">Set up your workspace</h1>
        <p className="text-sm text-foreground-muted">
          Progress is saved after each step so you can resume later.
        </p>
      </div>

      <OnboardingStepProgress
        currentStep={step}
        completedSteps={state.progress.completedSteps}
      />

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {step === OnboardingStepKey.ACCOUNT_PROFILE ? (
        <Card>
          <CardHeader>
            <CardTitle>Account profile</CardTitle>
            <CardDescription>
              Required: timezone. Optional: display name and regional preferences.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input label="Display name (optional)" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="First name (optional)" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              <Input label="Last name (optional)" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
            <Input label="Timezone (required)" value={timezone} onChange={(e) => setTimezone(e.target.value)} required />
            <Input label="Locale (optional)" value={locale} onChange={(e) => setLocale(e.target.value)} />
            <Button
              disabled={saving || !timezone.trim()}
              onClick={() =>
                void saveStep(OnboardingStepKey.ACCOUNT_PROFILE, {
                  displayName,
                  firstName,
                  lastName,
                  timezone,
                  locale,
                })
              }
            >
              Save and continue
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {step === OnboardingStepKey.ORGANISATION ? (
        <Card>
          <CardHeader>
            <CardTitle>Organisation details</CardTitle>
            <CardDescription>
              Required: organisation name. Internal teams can optionally apply the Cresco template.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!state.progress.templateKey ? (
              <div className="rounded-lg border border-dashed border-border-strong p-4">
                <p className="text-sm font-medium text-foreground">{CRESCO_INTERNAL_TEMPLATE.label}</p>
                <p className="mt-1 text-sm text-foreground-muted">{CRESCO_INTERNAL_TEMPLATE.description}</p>
                <Button className="mt-3" variant="outline" disabled={saving} onClick={() => void applyTemplate()}>
                  Use Cresco internal template
                </Button>
              </div>
            ) : null}
            <Input
              label="Organisation name (required)"
              value={organisationName}
              onChange={(e) => {
                setOrganisationName(e.target.value);
                setOrganisationSlug(slugFromName(e.target.value));
              }}
              required
            />
            <Input label="Slug (required)" value={organisationSlug} onChange={(e) => setOrganisationSlug(e.target.value)} required />
            <Input label="Industry (optional)" value={industry} onChange={(e) => setIndustry(e.target.value)} />
            <Input label="Website (optional)" value={website} onChange={(e) => setWebsite(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" disabled={saving} onClick={() => void saveStep(step, {}, "back")}>
                Back
              </Button>
              <Button
                disabled={saving || !organisationName.trim()}
                onClick={() =>
                  void saveStep(OnboardingStepKey.ORGANISATION, {
                    name: organisationName,
                    slug: organisationSlug,
                    industry,
                    website,
                    defaultTimezone: timezone,
                  })
                }
              >
                Save and continue
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === OnboardingStepKey.PROJECT ? (
        <Card>
          <CardHeader>
            <CardTitle>First project</CardTitle>
            <CardDescription>
              Required: project name. Template users can switch between pre-created Cresco projects.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {state.progress.templateKey && state.templateProjects.length > 1 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground-muted">Cresco projects</p>
                {state.templateProjects.map((templateProject) => {
                  const brand = templateProject.brands[0];
                  if (!brand) return null;
                  const isActive = state.project?.id === templateProject.id;
                  return (
                    <button
                      key={templateProject.id}
                      type="button"
                      className={`w-full rounded-lg border px-4 py-3 text-left text-sm ${
                        isActive ? "border-primary bg-surface-subtle" : "border-border"
                      }`}
                      onClick={() => void switchTemplateProject(templateProject.id, brand.id)}
                    >
                      <span className="font-medium text-foreground">{templateProject.name}</span>
                      <span className="mt-1 block text-foreground-muted">{brand.name}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
            <Input
              label="Project name (required)"
              value={projectName}
              onChange={(e) => {
                setProjectName(e.target.value);
                setProjectSlug(slugFromName(e.target.value));
              }}
              required
            />
            <Input label="Slug (required)" value={projectSlug} onChange={(e) => setProjectSlug(e.target.value)} required />
            <Input label="Description (optional)" value={projectDescription} onChange={(e) => setProjectDescription(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" disabled={saving} onClick={() => void saveStep(step, {}, "back")}>
                Back
              </Button>
              <Button
                disabled={saving || !projectName.trim()}
                onClick={() =>
                  void saveStep(OnboardingStepKey.PROJECT, {
                    name: projectName,
                    slug: projectSlug,
                    description: projectDescription,
                    existingProjectId: state.project?.id,
                  })
                }
              >
                Save and continue
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === OnboardingStepKey.BRAND ? (
        <Card>
          <CardHeader>
            <CardTitle>First brand</CardTitle>
            <CardDescription>Required: brand name for the workspace you are configuring.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Brand name (required)"
              value={brandName}
              onChange={(e) => {
                setBrandName(e.target.value);
                setBrandSlug(slugFromName(e.target.value));
              }}
              required
            />
            <Input label="Slug (required)" value={brandSlug} onChange={(e) => setBrandSlug(e.target.value)} required />
            <Input label="Description (optional)" value={brandDescription} onChange={(e) => setBrandDescription(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" disabled={saving} onClick={() => void saveStep(step, {}, "back")}>
                Back
              </Button>
              <Button
                disabled={saving || !brandName.trim()}
                onClick={() =>
                  void saveStep(OnboardingStepKey.BRAND, {
                    name: brandName,
                    slug: brandSlug,
                    description: brandDescription,
                    existingBrandId: state.brand?.id,
                    existingProjectId: state.project?.id,
                  })
                }
              >
                Save and continue
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === OnboardingStepKey.BRAND_PROFILE ? (
        <Card>
          <CardHeader>
            <CardTitle>Brand profile</CardTitle>
            <CardDescription>
              Recommended: short description, target audience, and value proposition.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input label="Short description (recommended)" value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} />
            <Input label="Target audience (recommended)" value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} />
            <Input label="Value proposition (recommended)" value={valueProposition} onChange={(e) => setValueProposition(e.target.value)} />
            <Input label="Mission (optional)" value={mission} onChange={(e) => setMission(e.target.value)} />
            <p className="text-sm text-foreground-muted">Profile completeness: {profileCompleteness}%</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" disabled={saving} onClick={() => void saveStep(step, {}, "back")}>
                Back
              </Button>
              <Button
                disabled={saving}
                onClick={() =>
                  void saveStep(OnboardingStepKey.BRAND_PROFILE, {
                    shortDescription,
                    targetAudience,
                    valueProposition,
                    mission,
                  })
                }
              >
                Save and continue
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === OnboardingStepKey.MARKETING_OBJECTIVES ? (
        <Card>
          <CardHeader>
            <CardTitle>Marketing objectives</CardTitle>
            <CardDescription>
              Required: select at least one objective with a target value and period.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {objectiveDrafts.map((objective, index) => (
              <div key={objective.objectiveType} className="rounded-lg border border-border p-4">
                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <input
                    type="checkbox"
                    checked={objective.selected}
                    onChange={(event) => {
                      const next = [...objectiveDrafts];
                      next[index] = { ...objective, selected: event.target.checked };
                      setObjectiveDrafts(next);
                    }}
                  />
                  {MARKETING_OBJECTIVE_LABELS[objective.objectiveType]}
                </label>
                {objective.selected ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Input
                      label="Description (required)"
                      value={objective.description}
                      onChange={(event) => {
                        const next = [...objectiveDrafts];
                        next[index] = { ...objective, description: event.target.value };
                        setObjectiveDrafts(next);
                      }}
                    />
                    <Input
                      label="Priority (required)"
                      type="number"
                      min={1}
                      max={10}
                      value={objective.priority}
                      onChange={(event) => {
                        const next = [...objectiveDrafts];
                        next[index] = { ...objective, priority: Number(event.target.value) };
                        setObjectiveDrafts(next);
                      }}
                    />
                    <Input
                      label="Target value (required)"
                      type="number"
                      min={1}
                      value={objective.targetValue}
                      onChange={(event) => {
                        const next = [...objectiveDrafts];
                        next[index] = { ...objective, targetValue: event.target.value };
                        setObjectiveDrafts(next);
                      }}
                    />
                    <label className="space-y-2 text-sm">
                      <span className="block font-medium text-foreground-muted">Target period (required)</span>
                      <select
                        className="block w-full rounded-lg border border-border-strong px-3 py-2"
                        value={objective.targetPeriod}
                        onChange={(event) => {
                          const next = [...objectiveDrafts];
                          next[index] = { ...objective, targetPeriod: event.target.value };
                          setObjectiveDrafts(next);
                        }}
                      >
                        {TARGET_PERIOD_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ) : null}
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" disabled={saving} onClick={() => void saveStep(step, {}, "back")}>
                Back
              </Button>
              <Button
                disabled={saving || !objectiveDrafts.some((objective) => objective.selected)}
                onClick={() =>
                  void saveStep(OnboardingStepKey.MARKETING_OBJECTIVES, {
                    objectives: objectiveDrafts
                      .filter((objective) => objective.selected)
                      .map((objective) => ({
                        objectiveType: objective.objectiveType,
                        description: objective.description,
                        priority: objective.priority,
                        targetValue: Number(objective.targetValue),
                        targetPeriod: objective.targetPeriod,
                      })),
                  })
                }
              >
                Save and continue
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === OnboardingStepKey.CHANNEL_PREFERENCES ? (
        <Card>
          <CardHeader>
            <CardTitle>Channel preferences</CardTitle>
            <CardDescription>
              Required: choose at least one planned channel. This is configuration only — no APIs are connected yet.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              {MARKETING_CHANNELS.map((channel) => {
                const checked = selectedChannels.includes(channel);
                return (
                  <label
                    key={channel}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                      checked ? "border-primary bg-surface-subtle" : "border-border"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => {
                        setSelectedChannels((current) =>
                          event.target.checked
                            ? [...current, channel]
                            : current.filter((value) => value !== channel),
                        );
                      }}
                    />
                    {MARKETING_CHANNEL_LABELS[channel]}
                  </label>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" disabled={saving} onClick={() => void saveStep(step, {}, "back")}>
                Back
              </Button>
              <Button
                disabled={saving || selectedChannels.length === 0}
                onClick={() =>
                  void saveStep(OnboardingStepKey.CHANNEL_PREFERENCES, {
                    channels: selectedChannels,
                  })
                }
              >
                Save and continue
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === OnboardingStepKey.REVIEW ? (
        <Card>
          <CardHeader>
            <CardTitle>Review and completion</CardTitle>
            <CardDescription>Confirm your workspace configuration before entering the dashboard.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-foreground-muted">
            <div className="rounded-lg border border-border p-4">
              <p><strong>Organisation:</strong> {state.organisation?.name ?? "—"}</p>
              <p><strong>Project:</strong> {state.project?.name ?? "—"}</p>
              <p><strong>Brand:</strong> {state.brand?.name ?? "—"}</p>
              <p><strong>Brand profile completeness:</strong> {profileCompleteness}%</p>
              <p><strong>Essential profile fields:</strong> {essentialsComplete ? "Complete" : "Incomplete"}</p>
              <p><strong>Marketing objectives:</strong> {state.objectives.length}</p>
              <p><strong>Planned channels:</strong> {state.channelPreferences.map((item) => MARKETING_CHANNEL_LABELS[item.channel]).join(", ") || "—"}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" disabled={saving} onClick={() => void saveStep(step, {}, "back")}>
                Back
              </Button>
              <Button
                disabled={saving || completing}
                onClick={() => void completeOnboarding()}
              >
                {completing ? "Completing onboarding…" : "Complete onboarding"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
