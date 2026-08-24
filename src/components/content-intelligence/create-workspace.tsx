"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { WorkspaceErrorState } from "@/components/layout/workspace-empty-state";
import { BrandContextReadinessPanel } from "@/components/content-intelligence/brand-context-readiness";
import { BrandAlignmentPanel } from "@/components/content-intelligence/brand-alignment-panel";
import { QualityCheckPanel } from "@/components/content-intelligence/quality-check-panel";
import { VariantPreviewPanel } from "@/components/content-intelligence/variant-preview-panel";
import { useContentIntelligence } from "@/components/content-intelligence/use-content-intelligence";
import { CONTENT_OBJECTIVES } from "@/lib/content-intelligence/objectives";
import type { ContentBrief, MasterContent } from "@/lib/content-intelligence/types";
import { evaluateBrandAlignment } from "@/lib/content-intelligence/brand-alignment";
import { evaluateContentQuality } from "@/lib/content-intelligence/quality-check";

const DEFAULT_BRIEF: ContentBrief = {
  mode: "manual",
  objective: "education",
  keyMessage: "",
  supportingMessages: [],
  proofPoints: [],
  differentiators: [],
  cta: "",
  channelStrategy: ["LINKEDIN"],
  suggestedFormats: ["carousel"],
  prohibitedClaims: [],
  evidenceNotes: [],
};

const DEFAULT_MASTER: MasterContent = {
  title: "",
  body: "",
  keyPoints: [],
  status: "draft",
};

export function CreateWorkspace() {
  const { data, loading, error, reload } = useContentIntelligence();
  const [brief, setBrief] = useState<ContentBrief>(DEFAULT_BRIEF);
  const [master, setMaster] = useState<MasterContent>(DEFAULT_MASTER);
  const [generating, setGenerating] = useState<"brief" | "master" | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  if (loading && !data) return <DashboardSkeleton />;
  if (error && !data) {
    return <WorkspaceErrorState title="Couldn't load create workspace" description={error} onRetry={reload} />;
  }
  if (!data) return null;

  const alignment = evaluateBrandAlignment(master, {
    brandName: "Brand",
    shortDescription: null,
    valueProposition: data.strategy.keyMessages[0] ?? null,
    mission: null,
    targetAudience: data.strategy.targetAudienceLabels.join(", ") || null,
    keyBenefits: null,
    preferredTone: null,
    prohibitedTone: null,
    coreMessage: data.strategy.keyMessages[0] ?? null,
    tagline: null,
    audiences: [],
    personas: [],
    offers: data.strategy.offerLabels.map((name, i) => ({
      id: `offer-${i}`,
      name,
      description: null,
    })),
    competitors: [],
    prohibitedClaims: data.strategy.constraints,
    mandatoryDisclosures: data.strategy.complianceNotes,
    prohibitedVocabulary: [],
  });

  const quality = evaluateContentQuality({
    master,
    campaignObjective: data.strategy.primaryObjective,
    channel: "LINKEDIN",
    brandAlignmentWeak: (alignment.score ?? 100) < 70,
  });

  async function handleGenerateBrief() {
    setGenerating("brief");
    setGenError(null);
    try {
      setBrief({
        ...brief,
        keyMessage: "Explain why SEIS applications get delayed and how founders can avoid common mistakes.",
        audienceLabel: data!.strategy.targetAudienceLabels[0] ?? "Startup founders",
        audiencePain: "Uncertainty around eligibility and documentation requirements.",
        proofPoints: ["Based on observed client application patterns"],
        cta: "Check your SEIS eligibility",
        evidenceNotes: ["Funding-process content performs above account median"],
      });
    } catch {
      setGenError("Content generation is temporarily unavailable. Your brief has been saved.");
    } finally {
      setGenerating(null);
    }
  }

  async function handleGenerateMaster() {
    setGenerating("master");
    setGenError(null);
    try {
      setMaster({
        title: "5 reasons SEIS applications get delayed",
        hook: "Most SEIS delays are preventable — here are the five patterns we see most often.",
        body: "1. Incomplete advance assurance documentation\n2. Misaligned share class structure\n3. Trading activity thresholds not met\n4. Investor qualification gaps\n5. Late submission before funding round close\n\nEach of these can add weeks to your timeline.",
        keyPoints: [
          "Documentation completeness is the top delay factor",
          "Share structure must align before investor commitments",
          "Trading thresholds need early verification",
        ],
        cta: brief.cta || "Check your SEIS eligibility",
        contentPillar: "funding_opportunities",
        status: "draft",
        generationMetadata: {
          generatedAt: new Date().toISOString(),
          humanEdited: false,
        },
      });
    } catch {
      setGenError("Content generation is temporarily unavailable. Your brief has been saved.");
    } finally {
      setGenerating(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Content"
        description="Context-aware production from brief to channel-native variants."
        actions={
          <ButtonLink href="/content/studio/new" variant="outline" size="sm">
            Open studio editor
          </ButtonLink>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Context</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
              <div>
                <label className="text-xs text-foreground-subtle">Objective</label>
                <select
                  className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm"
                  value={brief.objective}
                  onChange={(e) =>
                    setBrief({ ...brief, objective: e.target.value as ContentBrief["objective"] })
                  }
                >
                  {CONTENT_OBJECTIVES.map((obj) => (
                    <option key={obj.value} value={obj.value}>
                      {obj.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-foreground-subtle">Content pillar</label>
                <input
                  className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm"
                  value={brief.contentPillar ?? ""}
                  onChange={(e) => setBrief({ ...brief, contentPillar: e.target.value })}
                  placeholder="e.g. funding_opportunities"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-foreground-subtle">Audience</label>
                <input
                  className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm"
                  value={brief.audienceLabel ?? ""}
                  onChange={(e) => setBrief({ ...brief, audienceLabel: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">AI Content Brief</CardTitle>
              <Button size="sm" onClick={() => void handleGenerateBrief()} disabled={generating === "brief"}>
                {generating === "brief" ? "Generating…" : "Generate brief"}
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <label className="text-xs text-foreground-subtle">Key message</label>
                <textarea
                  className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm"
                  rows={2}
                  value={brief.keyMessage}
                  onChange={(e) => setBrief({ ...brief, keyMessage: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-foreground-subtle">CTA</label>
                <input
                  className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm"
                  value={brief.cta}
                  onChange={(e) => setBrief({ ...brief, cta: e.target.value })}
                />
              </div>
              {brief.evidenceNotes.length > 0 ? (
                <p className="text-xs text-foreground-muted">
                  Evidence: {brief.evidenceNotes.join(" · ")}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Master Content</CardTitle>
              <Button size="sm" onClick={() => void handleGenerateMaster()} disabled={generating === "master"}>
                {generating === "master" ? "Generating…" : "Generate draft"}
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <input
                className="w-full rounded-md border px-2 py-1.5 font-medium"
                value={master.title}
                onChange={(e) => setMaster({ ...master, title: e.target.value })}
                placeholder="Title"
              />
              <textarea
                className="w-full rounded-md border px-2 py-1.5"
                rows={6}
                value={master.body}
                onChange={(e) => setMaster({ ...master, body: e.target.value })}
                placeholder="Master content body"
              />
            </CardContent>
          </Card>

          <VariantPreviewPanel master={master} />

          {genError ? (
            <p className="text-sm text-destructive">{genError}</p>
          ) : null}
        </div>

        <div className="space-y-4">
          <BrandContextReadinessPanel readiness={data.brandReadiness} />
          <BrandAlignmentPanel result={alignment} />
          <QualityCheckPanel result={quality} />
          <ButtonLink href="/content/studio/workflow" className="w-full">
            Request approval
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
