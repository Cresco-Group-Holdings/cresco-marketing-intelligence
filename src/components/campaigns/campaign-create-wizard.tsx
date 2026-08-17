"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import {
  createCampaign,
  formatCampaignError,
  isCampaignVersionConflict,
} from "@/components/campaigns/campaign-api";
import { CampaignStatusBadge } from "@/components/campaigns/campaign-status-badge";
import {
  CAMPAIGN_CHANNEL_LABELS,
  CAMPAIGN_CHANNEL_OPTIONS,
  CAMPAIGN_OBJECTIVE_LABELS,
  CAMPAIGN_OBJECTIVES,
  CAMPAIGN_WIZARD_STEPS,
  type CampaignChannelType,
  type CampaignObjective,
  type CampaignWizardStep,
} from "@/components/campaigns/types";

type KpiDraft = {
  name: string;
  targetValue: string;
  unit: string;
};

type WizardForm = {
  name: string;
  description: string;
  primaryObjective: CampaignObjective;
  channels: CampaignChannelType[];
  startAt: string;
  endAt: string;
  budgetAmount: string;
  budgetCurrency: string;
  audienceDescription: string;
  audienceSegments: string;
  kpis: KpiDraft[];
};

const DEFAULT_FORM: WizardForm = {
  name: "",
  description: "",
  primaryObjective: "LEAD_GENERATION",
  channels: [],
  startAt: "",
  endAt: "",
  budgetAmount: "",
  budgetCurrency: "USD",
  audienceDescription: "",
  audienceSegments: "",
  kpis: [{ name: "", targetValue: "", unit: "" }],
};

function defaultSchedule(): Pick<WizardForm, "startAt" | "endAt"> {
  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + 30);
  return {
    startAt: start.toISOString().slice(0, 10),
    endAt: end.toISOString().slice(0, 10),
  };
}

function toIsoDate(value: string): string | undefined {
  if (!value) return undefined;
  return new Date(`${value}T12:00:00.000Z`).toISOString();
}

export function CampaignCreateWizard() {
  const router = useRouter();
  const { preference } = useWorkspace();
  const organisationId = preference.currentOrganisationId;
  const brandId = preference.currentBrandId;

  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<WizardForm>(() => ({
    ...DEFAULT_FORM,
    ...defaultSchedule(),
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [versionConflict, setVersionConflict] = useState(false);

  const currentStep = CAMPAIGN_WIZARD_STEPS[stepIndex] as CampaignWizardStep;
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === CAMPAIGN_WIZARD_STEPS.length - 1;

  const canContinue = useMemo(() => {
    if (currentStep === "Basics") return form.name.trim().length > 0;
    if (currentStep === "Objective") return Boolean(form.primaryObjective);
    if (currentStep === "Channels") return form.channels.length > 0;
    if (currentStep === "Schedule") return Boolean(form.startAt && form.endAt);
    return true;
  }, [currentStep, form]);

  function updateForm<K extends keyof WizardForm>(key: K, value: WizardForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleChannel(channel: CampaignChannelType) {
    setForm((current) => ({
      ...current,
      channels: current.channels.includes(channel)
        ? current.channels.filter((item) => item !== channel)
        : [...current.channels, channel],
    }));
  }

  function updateKpi(index: number, patch: Partial<KpiDraft>) {
    setForm((current) => ({
      ...current,
      kpis: current.kpis.map((kpi, idx) => (idx === index ? { ...kpi, ...patch } : kpi)),
    }));
  }

  function addKpiRow() {
    setForm((current) => ({
      ...current,
      kpis: [...current.kpis, { name: "", targetValue: "", unit: "" }],
    }));
  }

  async function submitCampaign(status: "DRAFT" | "PLANNED") {
    if (!organisationId || !brandId || !form.name.trim()) return;

    setSaving(true);
    setError(null);
    setVersionConflict(false);

    const kpis = form.kpis
      .filter((kpi) => kpi.name.trim())
      .map((kpi) => ({
        name: kpi.name.trim(),
        targetValue: kpi.targetValue ? Number(kpi.targetValue) : undefined,
        unit: kpi.unit.trim() || undefined,
      }));

    const segments = form.audienceSegments
      .split(",")
      .map((segment) => segment.trim())
      .filter(Boolean);

    try {
      const campaign = await createCampaign(organisationId, {
        brandId,
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        status,
        primaryObjective: form.primaryObjective,
        channels: form.channels,
        startAt: toIsoDate(form.startAt),
        endAt: toIsoDate(form.endAt),
        budgetAmount: form.budgetAmount ? Number(form.budgetAmount) : undefined,
        budgetCurrency: form.budgetCurrency || undefined,
        audience: {
          description: form.audienceDescription.trim() || undefined,
          segments: segments.length > 0 ? segments : undefined,
        },
        kpis: kpis.length > 0 ? kpis : undefined,
      });
      router.push(`/campaigns/${campaign.id}`);
    } catch (caught) {
      setVersionConflict(isCampaignVersionConflict(caught));
      setError(formatCampaignError(caught));
    } finally {
      setSaving(false);
    }
  }

  if (!organisationId || !brandId) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-foreground-muted">
          Select an organisation and brand workspace before creating a campaign.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New campaign"
        description="Define campaign basics, objectives, channels, schedule, budget, audience, and KPIs."
        breadcrumbs={[
          { label: "Campaigns", href: "/campaigns" },
          { label: "New campaign" },
        ]}
        actions={
          <ButtonLink href="/campaigns" variant="outline">
            Cancel
          </ButtonLink>
        }
      />

      <Card>
        <CardContent className="py-5">
          <div className="flex flex-wrap gap-2">
            {CAMPAIGN_WIZARD_STEPS.map((step, index) => (
              <Badge key={step} variant={index === stepIndex ? "default" : "muted"}>
                {index + 1}. {step}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-danger">{error}</p>
            {versionConflict ? (
              <p className="mt-2 text-sm text-foreground-muted">
                Reload this page if another session updated campaign data while you were editing.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{currentStep}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentStep === "Basics" ? (
            <>
              <Input
                label="Campaign name"
                placeholder="Spring product launch"
                value={form.name}
                onChange={(event) => updateForm("name", event.target.value)}
              />
              <div className="space-y-2">
                <label htmlFor="campaign-description" className="block text-sm font-medium text-foreground-muted">
                  Description
                </label>
                <textarea
                  id="campaign-description"
                  value={form.description}
                  onChange={(event) => updateForm("description", event.target.value)}
                  rows={4}
                  className="block w-full rounded-lg border border-border-strong bg-surface-elevated px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-foreground-subtle focus-visible:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="What is this campaign trying to achieve?"
                />
              </div>
            </>
          ) : null}

          {currentStep === "Objective" ? (
            <div className="grid gap-3 md:grid-cols-2">
              {CAMPAIGN_OBJECTIVES.map((objective) => (
                <button
                  key={objective}
                  type="button"
                  onClick={() => updateForm("primaryObjective", objective)}
                  className={`rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                    form.primaryObjective === objective
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-foreground-muted hover:bg-surface-subtle"
                  }`}
                >
                  {CAMPAIGN_OBJECTIVE_LABELS[objective]}
                </button>
              ))}
            </div>
          ) : null}

          {currentStep === "Channels" ? (
            <div className="grid gap-3 md:grid-cols-2">
              {CAMPAIGN_CHANNEL_OPTIONS.map((channel) => (
                <button
                  key={channel}
                  type="button"
                  onClick={() => toggleChannel(channel)}
                  className={`rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                    form.channels.includes(channel)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-foreground-muted hover:bg-surface-subtle"
                  }`}
                >
                  {CAMPAIGN_CHANNEL_LABELS[channel]}
                </button>
              ))}
            </div>
          ) : null}

          {currentStep === "Schedule" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Start date"
                type="date"
                value={form.startAt}
                onChange={(event) => updateForm("startAt", event.target.value)}
              />
              <Input
                label="End date"
                type="date"
                value={form.endAt}
                onChange={(event) => updateForm("endAt", event.target.value)}
              />
            </div>
          ) : null}

          {currentStep === "Budget" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Total budget"
                type="number"
                min="0"
                step="0.01"
                placeholder="10000"
                value={form.budgetAmount}
                onChange={(event) => updateForm("budgetAmount", event.target.value)}
              />
              <Input
                label="Currency"
                placeholder="USD"
                value={form.budgetCurrency}
                onChange={(event) => updateForm("budgetCurrency", event.target.value.toUpperCase())}
              />
            </div>
          ) : null}

          {currentStep === "Audience" ? (
            <>
              <div className="space-y-2">
                <label htmlFor="audience-description" className="block text-sm font-medium text-foreground-muted">
                  Audience description
                </label>
                <textarea
                  id="audience-description"
                  value={form.audienceDescription}
                  onChange={(event) => updateForm("audienceDescription", event.target.value)}
                  rows={4}
                  className="block w-full rounded-lg border border-border-strong bg-surface-elevated px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-foreground-subtle focus-visible:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Describe the primary audience for this campaign."
                />
              </div>
              <Input
                label="Segments"
                hint="Comma-separated audience segments"
                placeholder="Enterprise buyers, trial users"
                value={form.audienceSegments}
                onChange={(event) => updateForm("audienceSegments", event.target.value)}
              />
            </>
          ) : null}

          {currentStep === "KPIs" ? (
            <div className="space-y-4">
              {form.kpis.map((kpi, index) => (
                <div key={`kpi-${index}`} className="grid gap-3 rounded-lg border border-border p-4 md:grid-cols-3">
                  <Input
                    label="KPI name"
                    placeholder="Qualified leads"
                    value={kpi.name}
                    onChange={(event) => updateKpi(index, { name: event.target.value })}
                  />
                  <Input
                    label="Target"
                    type="number"
                    placeholder="250"
                    value={kpi.targetValue}
                    onChange={(event) => updateKpi(index, { targetValue: event.target.value })}
                  />
                  <Input
                    label="Unit"
                    placeholder="leads"
                    value={kpi.unit}
                    onChange={(event) => updateKpi(index, { unit: event.target.value })}
                  />
                </div>
              ))}
              <Button variant="outline" onClick={addKpiRow}>
                Add KPI
              </Button>
            </div>
          ) : null}

          {currentStep === "Review" ? (
            <div className="space-y-4 text-sm text-foreground-muted">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-foreground">{form.name || "Untitled campaign"}</span>
                <CampaignStatusBadge status="DRAFT" />
              </div>
              {form.description ? <p>{form.description}</p> : null}
              <p>
                <span className="font-medium text-foreground">Objective:</span>{" "}
                {CAMPAIGN_OBJECTIVE_LABELS[form.primaryObjective]}
              </p>
              <p>
                <span className="font-medium text-foreground">Channels:</span>{" "}
                {form.channels.map((channel) => CAMPAIGN_CHANNEL_LABELS[channel]).join(", ") || "None selected"}
              </p>
              <p>
                <span className="font-medium text-foreground">Schedule:</span> {form.startAt} – {form.endAt}
              </p>
              <p>
                <span className="font-medium text-foreground">Budget:</span>{" "}
                {form.budgetAmount
                  ? `${form.budgetCurrency} ${Number(form.budgetAmount).toLocaleString()}`
                  : "Not set"}
              </p>
              <p>
                <span className="font-medium text-foreground">Audience:</span>{" "}
                {form.audienceDescription || "Not described"}
              </p>
              <p>
                <span className="font-medium text-foreground">KPIs:</span>{" "}
                {form.kpis.filter((kpi) => kpi.name.trim()).length || 0} defined
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="outline"
          disabled={isFirstStep || saving}
          onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
        >
          Back
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={saving} onClick={() => void submitCampaign("DRAFT")}>
            Save draft
          </Button>
          {!isLastStep ? (
            <Button disabled={!canContinue || saving} onClick={() => setStepIndex((current) => current + 1)}>
              Continue
            </Button>
          ) : (
            <Button disabled={!canContinue || saving} onClick={() => void submitCampaign("PLANNED")}>
              Create campaign
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
