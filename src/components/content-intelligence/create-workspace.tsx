"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
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
import { useContentIntelligencePreviewData } from "@/components/content-intelligence/content-intelligence-preview-context";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { ChannelVariantCreator } from "@/components/organic-growth/channel-variant-creator";
import { CONTENT_OBJECTIVES } from "@/lib/content-intelligence/objectives";
import type { ContentBrief, MasterContent } from "@/lib/content-intelligence/types";
import { evaluateBrandAlignment } from "@/lib/content-intelligence/brand-alignment";
import { evaluateContentQuality } from "@/lib/content-intelligence/quality-check";
import { apiFetch } from "@/lib/api/client";

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

type GenerationPhase =
  | "idle"
  | "preparing"
  | "generating"
  | "validating"
  | "saving"
  | "complete"
  | "failed";

type GenerationTarget = "brief" | "master";

type SessionResponse = {
  session: {
    contentId: string;
    brief: ContentBrief;
    master: MasterContent | null;
    version: number;
    complianceFindings: Array<{
      checkType: string;
      result: string;
      message: string;
      blocking: boolean;
    }>;
  };
};

function resolveCreationMode(
  source: string | null,
): ContentBrief["mode"] {
  if (source === "winning") return "winning_content";
  if (source === "campaign") return "campaign";
  if (source === "opportunity") return "opportunity";
  if (source === "competitor") return "competitor_signal";
  return "manual";
}

function phaseLabel(phase: GenerationPhase, buttonTarget: GenerationTarget, activeTarget: GenerationTarget | null): string {
  const isActive = activeTarget === buttonTarget && phase !== "idle" && phase !== "complete";
  if (!isActive) {
    return buttonTarget === "brief" ? "Generate brief" : "Generate draft";
  }
  if (phase === "preparing") return "Preparing…";
  if (phase === "generating") return "Generating…";
  if (phase === "validating") return "Validating…";
  if (phase === "saving") return "Saving…";
  if (phase === "failed") return "Retry";
  return buttonTarget === "brief" ? "Generate brief" : "Generate draft";
}

export function CreateWorkspace() {
  const previewData = useContentIntelligencePreviewData();
  const isPreviewMode = Boolean(previewData);
  const { data, loading, error, reload } = useContentIntelligence();
  const { preference } = useWorkspace();
  const searchParams = useSearchParams();

  const organisationId = preference.currentOrganisationId;
  const brandId = preference.currentBrandId;

  const [contentId, setContentId] = useState<string | null>(
    searchParams.get("contentId"),
  );
  const [brief, setBrief] = useState<ContentBrief>({
    ...DEFAULT_BRIEF,
    mode: resolveCreationMode(searchParams.get("source")),
  });
  const [master, setMaster] = useState<MasterContent>(DEFAULT_MASTER);
  const [version, setVersion] = useState(1);
  const [phase, setPhase] = useState<GenerationPhase>("idle");
  const [target, setTarget] = useState<GenerationTarget | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [complianceFindings, setComplianceFindings] = useState<
    SessionResponse["session"]["complianceFindings"]
  >([]);
  const [variantReloadKey, setVariantReloadKey] = useState(0);

  const inFlightRef = useRef(false);
  const briefSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const masterSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadSession = useCallback(
    async (sessionContentId: string) => {
      if (!organisationId || !brandId || isPreviewMode) return;
      const response = await apiFetch<SessionResponse>(
        `/api/brands/${brandId}/content-intelligence/session/${sessionContentId}?organisationId=${organisationId}`,
        { organisationId },
      );
      setContentId(response.session.contentId);
      setBrief(response.session.brief);
      setMaster(response.session.master ?? DEFAULT_MASTER);
      setVersion(response.session.version);
      setComplianceFindings(response.session.complianceFindings);
    },
    [brandId, isPreviewMode, organisationId],
  );

  useEffect(() => {
    const sessionId = searchParams.get("contentId");
    if (sessionId && organisationId && brandId && !isPreviewMode) {
      void loadSession(sessionId).catch(() => undefined);
    }
  }, [brandId, isPreviewMode, loadSession, organisationId, searchParams]);

  const brandContext = useMemo(
    () => ({
      brandName: "Brand",
      shortDescription: null,
      valueProposition: data?.strategy.keyMessages[0] ?? null,
      mission: null,
      targetAudience: data?.strategy.targetAudienceLabels.join(", ") || null,
      keyBenefits: null,
      preferredTone: null,
      prohibitedTone: null,
      coreMessage: data?.strategy.keyMessages[0] ?? null,
      tagline: null,
      audiences: [],
      personas: [],
      offers:
        data?.strategy.offerLabels.map((name, i) => ({
          id: `offer-${i}`,
          name,
          description: null,
        })) ?? [],
      competitors: [],
      prohibitedClaims: data?.strategy.constraints ?? [],
      mandatoryDisclosures: data?.strategy.complianceNotes ?? [],
      prohibitedVocabulary: [],
    }),
    [data],
  );

  const alignment = evaluateBrandAlignment(master, brandContext);
  const quality = evaluateContentQuality({
    master,
    campaignObjective: data?.strategy.primaryObjective,
    channel: "LINKEDIN",
    brandAlignmentWeak: (alignment.score ?? 100) < 70,
  });

  async function runPreviewBriefGeneration() {
    setTarget("brief");
    setPhase("generating");
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
      setPhase("complete");
    } catch {
      setGenError("Content generation is temporarily unavailable. Your brief has been saved.");
      setPhase("failed");
    } finally {
      setTarget(null);
      setPhase("idle");
    }
  }

  async function runPreviewMasterGeneration() {
    setTarget("master");
    setPhase("generating");
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
      setPhase("complete");
    } catch {
      setGenError("Content generation is temporarily unavailable. Your brief has been saved.");
      setPhase("failed");
    } finally {
      setTarget(null);
      setPhase("idle");
    }
  }

  async function persistBriefEdits(nextBrief: ContentBrief) {
    if (!contentId || !organisationId || !brandId || isPreviewMode) return;
    await apiFetch<SessionResponse>(
      `/api/brands/${brandId}/content-intelligence/brief/${contentId}?organisationId=${organisationId}`,
      {
        method: "PATCH",
        organisationId,
        body: JSON.stringify(nextBrief),
      },
    );
  }

  async function persistMasterEdits(nextMaster: MasterContent) {
    if (!contentId || !organisationId || !brandId || isPreviewMode) return;
    const response = await apiFetch<SessionResponse>(
      `/api/brands/${brandId}/content-intelligence/master/${contentId}?organisationId=${organisationId}`,
      {
        method: "PATCH",
        organisationId,
        body: JSON.stringify({
          title: nextMaster.title,
          hook: nextMaster.hook,
          body: nextMaster.body,
          keyPoints: nextMaster.keyPoints,
          cta: nextMaster.cta,
          contentPillar: nextMaster.contentPillar,
          expectedVersion: version,
        }),
      },
    );
    setVersion(response.session.version);
  }

  function scheduleBriefSave(nextBrief: ContentBrief) {
    if (!contentId) return;
    if (briefSaveTimer.current) clearTimeout(briefSaveTimer.current);
    briefSaveTimer.current = setTimeout(() => {
      void persistBriefEdits(nextBrief).catch(() => undefined);
    }, 600);
  }

  function scheduleMasterSave(nextMaster: MasterContent) {
    if (!contentId) return;
    if (masterSaveTimer.current) clearTimeout(masterSaveTimer.current);
    masterSaveTimer.current = setTimeout(() => {
      void persistMasterEdits(nextMaster).catch(() => undefined);
    }, 600);
  }

  async function handleGenerateBrief() {
    if (inFlightRef.current) return;
    if (isPreviewMode) {
      await runPreviewBriefGeneration();
      return;
    }
    if (!organisationId || !brandId) return;

    inFlightRef.current = true;
    setTarget("brief");
    setPhase("preparing");
    setGenError(null);

    const idempotencyKey = crypto.randomUUID();

    try {
      setPhase("generating");
      const response = await apiFetch<SessionResponse>(
        `/api/brands/${brandId}/content-intelligence/brief/generate?organisationId=${organisationId}`,
        {
          method: "POST",
          organisationId,
          body: JSON.stringify({
            mode: brief.mode,
            objective: brief.objective,
            funnelStage: brief.funnelStage,
            audienceId: brief.audienceId,
            offerId: brief.offerId,
            campaignId: brief.campaignId ?? searchParams.get("campaignId"),
            contentPillar: brief.contentPillar,
            sourceContentId: brief.sourceContentId ?? searchParams.get("contentId"),
            sourceOpportunityId: brief.sourceOpportunityId ?? searchParams.get("opportunityId"),
            competitorSignalId: searchParams.get("competitorSignalId"),
            contentId: contentId ?? undefined,
            idempotencyKey,
          }),
        },
      );
      setPhase("validating");
      setContentId(response.session.contentId);
      setBrief(response.session.brief);
      setVersion(response.session.version);
      setPhase("saving");
      setPhase("complete");
      setTimeout(() => setPhase("idle"), 400);
    } catch (err) {
      setGenError(
        err instanceof Error
          ? err.message
          : "We couldn't generate a valid content brief. Your context has been preserved.",
      );
      setPhase("failed");
    } finally {
      inFlightRef.current = false;
      setTarget(null);
    }
  }

  async function handleGenerateMaster() {
    if (inFlightRef.current) return;
    if (isPreviewMode) {
      await runPreviewMasterGeneration();
      return;
    }
    if (!organisationId || !brandId || !contentId) {
      setGenError("Generate and save a brief before creating master content.");
      return;
    }

    inFlightRef.current = true;
    setTarget("master");
    setPhase("preparing");
    setGenError(null);

    const idempotencyKey = crypto.randomUUID();

    try {
      setPhase("generating");
      const response = await apiFetch<SessionResponse>(
        `/api/brands/${brandId}/content-intelligence/master/generate?organisationId=${organisationId}`,
        {
          method: "POST",
          organisationId,
          body: JSON.stringify({
            contentId,
            idempotencyKey,
          }),
        },
      );
      setPhase("validating");
      setMaster(response.session.master ?? DEFAULT_MASTER);
      setVersion(response.session.version);
      setComplianceFindings(response.session.complianceFindings);
      setPhase("saving");
      setPhase("complete");
      setTimeout(() => setPhase("idle"), 400);
    } catch (err) {
      setGenError(
        err instanceof Error
          ? err.message
          : "We couldn't generate valid master content. Your brief has been preserved.",
      );
      setPhase("failed");
    } finally {
      inFlightRef.current = false;
      setTarget(null);
    }
  }

  if (loading && !data) return <DashboardSkeleton />;
  if (error && !data) {
    return (
      <WorkspaceErrorState
        title="Couldn't load create workspace"
        description={error}
        onRetry={reload}
      />
    );
  }
  if (!data) return null;

  const briefBusy = target === "brief" && phase !== "idle" && phase !== "failed" && phase !== "complete";
  const masterBusy =
    target === "master" && phase !== "idle" && phase !== "failed" && phase !== "complete";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Content"
        description="Context-aware production from brief to channel-native variants."
        actions={
          contentId ? (
            <ButtonLink href={`/content/studio/${contentId}`} variant="outline" size="sm">
              Open studio editor
            </ButtonLink>
          ) : (
            <ButtonLink href="/content/studio/new" variant="outline" size="sm">
              Open studio editor
            </ButtonLink>
          )
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Context</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <label className="text-xs text-foreground-subtle">Objective</label>
                <select
                  className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm"
                  value={brief.objective}
                  onChange={(e) => {
                    const next = {
                      ...brief,
                      objective: e.target.value as ContentBrief["objective"],
                    };
                    setBrief(next);
                    scheduleBriefSave(next);
                  }}
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
                  onChange={(e) => {
                    const next = { ...brief, contentPillar: e.target.value };
                    setBrief(next);
                    scheduleBriefSave(next);
                  }}
                  placeholder="e.g. funding_opportunities"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-foreground-subtle">Audience</label>
                <input
                  className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm"
                  value={brief.audienceLabel ?? ""}
                  onChange={(e) => {
                    const next = { ...brief, audienceLabel: e.target.value };
                    setBrief(next);
                    scheduleBriefSave(next);
                  }}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-foreground-subtle">Audience pain / need</label>
                <textarea
                  className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm"
                  rows={2}
                  value={brief.audiencePain ?? ""}
                  onChange={(e) => {
                    const next = { ...brief, audiencePain: e.target.value };
                    setBrief(next);
                    scheduleBriefSave(next);
                  }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">AI Content Brief</CardTitle>
              <Button
                size="sm"
                onClick={() => void handleGenerateBrief()}
                disabled={briefBusy || !organisationId || !brandId}
              >
                {phaseLabel(phase, "brief", target)}
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <label className="text-xs text-foreground-subtle">Key message</label>
                <textarea
                  className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm"
                  rows={2}
                  value={brief.keyMessage}
                  onChange={(e) => {
                    const next = { ...brief, keyMessage: e.target.value };
                    setBrief(next);
                    scheduleBriefSave(next);
                  }}
                />
              </div>
              <div>
                <label className="text-xs text-foreground-subtle">Proof points</label>
                <textarea
                  className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm"
                  rows={2}
                  value={brief.proofPoints.join("\n")}
                  onChange={(e) => {
                    const next = {
                      ...brief,
                      proofPoints: e.target.value.split("\n").filter(Boolean),
                    };
                    setBrief(next);
                    scheduleBriefSave(next);
                  }}
                />
              </div>
              <div>
                <label className="text-xs text-foreground-subtle">CTA</label>
                <input
                  className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm"
                  value={brief.cta}
                  onChange={(e) => {
                    const next = { ...brief, cta: e.target.value };
                    setBrief(next);
                    scheduleBriefSave(next);
                  }}
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
              <Button
                size="sm"
                onClick={() => void handleGenerateMaster()}
                disabled={masterBusy || !brief.keyMessage.trim()}
              >
                {phaseLabel(phase, "master", target)}
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <input
                className="w-full rounded-md border px-2 py-1.5 font-medium"
                value={master.title}
                onChange={(e) => {
                  const next = { ...master, title: e.target.value };
                  setMaster(next);
                  scheduleMasterSave(next);
                }}
                placeholder="Title"
              />
              <textarea
                className="w-full rounded-md border px-2 py-1.5"
                rows={2}
                value={master.hook ?? ""}
                onChange={(e) => {
                  const next = { ...master, hook: e.target.value };
                  setMaster(next);
                  scheduleMasterSave(next);
                }}
                placeholder="Hook"
              />
              <textarea
                className="w-full rounded-md border px-2 py-1.5"
                rows={6}
                value={master.body}
                onChange={(e) => {
                  const next = { ...master, body: e.target.value };
                  setMaster(next);
                  scheduleMasterSave(next);
                }}
                placeholder="Master content body"
              />
            </CardContent>
          </Card>

          <VariantPreviewPanel master={master} />

          {contentId && master.body && organisationId && brandId && !isPreviewMode ? (
            <ChannelVariantCreator
              key={variantReloadKey}
              contentId={contentId}
              brandId={brandId}
              organisationId={organisationId}
              title={master.title}
              body={master.body}
              existingChannels={[]}
              onCreated={() => setVariantReloadKey((value) => value + 1)}
            />
          ) : null}

          {genError ? (
            <Card className="border-destructive/40">
              <CardContent className="flex items-center justify-between gap-3 pt-4 text-sm">
                <p className="text-destructive">{genError}</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setGenError(null);
                    setPhase("idle");
                  }}
                >
                  Retry
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <BrandContextReadinessPanel readiness={data.brandReadiness} />
          <BrandAlignmentPanel result={alignment} />
          <QualityCheckPanel result={quality} />
          {complianceFindings.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Content compliance check</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {complianceFindings.map((finding, index) => (
                  <p
                    key={`${finding.checkType}-${index}`}
                    className={
                      finding.result === "FAIL"
                        ? "text-destructive"
                        : finding.result === "WARNING"
                          ? "text-amber-600"
                          : "text-foreground-muted"
                    }
                  >
                    {finding.message}
                  </p>
                ))}
                <p className="text-[11px] text-foreground-subtle">
                  Compliance check — not legal approval.
                </p>
              </CardContent>
            </Card>
          ) : null}
          <ButtonLink
            href={contentId ? `/content/studio/${contentId}` : "/content/studio/workflow"}
            className="w-full"
          >
            Request approval
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
