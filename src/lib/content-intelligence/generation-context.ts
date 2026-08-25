import type { ContentObjective, BriefCreationMode, FunnelStage } from "@/lib/content-intelligence/types";
import { CONTENT_OBJECTIVES } from "@/lib/content-intelligence/objectives";
import { AppError } from "@/lib/errors";
import type { ControlledBrandContext } from "@/lib/ai/brand-context-builder";

export type BriefGenerationInput = {
  mode: BriefCreationMode;
  objective?: ContentObjective;
  funnelStage?: FunnelStage | null;
  audienceId?: string | null;
  offerId?: string | null;
  campaignId?: string | null;
  contentPillar?: string | null;
  sourceContentId?: string | null;
  sourceOpportunityId?: string | null;
  competitorSignalId?: string | null;
  studioType?: string;
};

export type ResolvedSourceEvidence = {
  label: string;
  notes: string[];
};

export type ResolvedGenerationContext = {
  mode: BriefCreationMode;
  objective: ContentObjective;
  funnelStage: FunnelStage | null;
  audienceId: string | null;
  audienceLabel: string | null;
  offerId: string | null;
  offerLabel: string | null;
  campaignId: string | null;
  campaignLabel: string | null;
  contentPillar: string | null;
  sourceContentId: string | null;
  sourceOpportunityId: string | null;
  evidenceNotes: string[];
  prohibitedClaims: string[];
  brandContext: ControlledBrandContext;
};

const OBJECTIVE_VALUES = new Set(CONTENT_OBJECTIVES.map((item) => item.value));

export function mapObjectiveValue(value: string | undefined | null): ContentObjective | null {
  if (!value) return null;
  const normalised = value.toLowerCase().replace(/\s+/g, "_");
  if (OBJECTIVE_VALUES.has(normalised as ContentObjective)) {
    return normalised as ContentObjective;
  }
  const match = CONTENT_OBJECTIVES.find(
    (item) => item.label.toLowerCase() === value.toLowerCase(),
  );
  return match?.value ?? null;
}

export function buildBriefGenerationPrompt(
  context: ResolvedGenerationContext,
  sourceEvidence: ResolvedSourceEvidence | null,
): string {
  const lines = [
    "Generate a structured marketing content brief for the brand.",
    `Creation mode: ${context.mode}`,
    `Objective: ${context.objective}`,
    context.funnelStage ? `Funnel stage: ${context.funnelStage}` : null,
    context.audienceLabel ? `Audience: ${context.audienceLabel}` : null,
    context.offerLabel ? `Offer: ${context.offerLabel}` : null,
    context.campaignLabel ? `Campaign: ${context.campaignLabel}` : null,
    context.contentPillar ? `Content pillar: ${context.contentPillar}` : null,
    sourceEvidence ? `Source evidence: ${sourceEvidence.label}` : null,
    sourceEvidence?.notes.length ? `Evidence notes:\n- ${sourceEvidence.notes.join("\n- ")}` : null,
    context.evidenceNotes.length ? `Additional evidence:\n- ${context.evidenceNotes.join("\n- ")}` : null,
    "",
    "Use only supplied brand context and evidence. Do not fabricate statistics, competitor intelligence, or performance claims.",
    "Return a concise, actionable brief aligned to the objective and audience.",
  ].filter(Boolean);

  return lines.join("\n");
}

export function buildMasterGenerationPrompt(
  brief: {
    objective: ContentObjective;
    audienceLabel?: string | null;
    audiencePain?: string | null;
    keyMessage: string;
    supportingMessages: string[];
    proofPoints: string[];
    differentiators: string[];
    cta: string;
    channelStrategy: string[];
    contentPillar?: string | null;
    evidenceNotes: string[];
  },
  studioType: string,
): string {
  return [
    "Generate master content from the approved content brief below.",
    `Studio content type: ${studioType}`,
    `Objective: ${brief.objective}`,
    brief.audienceLabel ? `Audience: ${brief.audienceLabel}` : null,
    brief.audiencePain ? `Audience pain: ${brief.audiencePain}` : null,
    `Key message: ${brief.keyMessage}`,
    brief.supportingMessages.length
      ? `Supporting messages:\n- ${brief.supportingMessages.join("\n- ")}`
      : null,
    brief.proofPoints.length ? `Proof points:\n- ${brief.proofPoints.join("\n- ")}` : null,
    brief.differentiators.length
      ? `Differentiators:\n- ${brief.differentiators.join("\n- ")}`
      : null,
    `CTA: ${brief.cta}`,
    brief.channelStrategy.length ? `Channels: ${brief.channelStrategy.join(", ")}` : null,
    brief.contentPillar ? `Content pillar: ${brief.contentPillar}` : null,
    brief.evidenceNotes.length ? `Evidence notes:\n- ${brief.evidenceNotes.join("\n- ")}` : null,
    "",
    "Write channel-agnostic master content. Do not fabricate testimonials or guarantees.",
    "Flag compliance risks in riskFlags when present.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function assertSourceModeAllowed(
  mode: BriefCreationMode,
  evidence: ResolvedSourceEvidence | null,
): void {
  if (mode === "manual") return;

  if (mode === "competitor_signal" && !evidence) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Competitor signal source is not available. Choose a different creation mode.",
    );
  }

  if (mode === "winning_content" && !evidence) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Winning content source was not found. Choose a different creation mode.",
    );
  }

  if (mode === "campaign" && !evidence) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Campaign source was not found. Choose a different creation mode.",
    );
  }

  if (mode === "opportunity" && !evidence) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Content opportunity source was not found. Choose a different creation mode.",
    );
  }
}
