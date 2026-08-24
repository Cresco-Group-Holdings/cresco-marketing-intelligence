import { z } from "zod";
import type { ContentBrief } from "@/lib/content-intelligence/types";

export const contentBriefSchema = z.object({
  mode: z.enum(["manual", "campaign", "opportunity", "winning_content", "competitor_signal"]),
  objective: z.enum([
    "awareness",
    "education",
    "engagement",
    "lead_generation",
    "conversion",
    "retention",
    "product_adoption",
    "authority",
    "community_growth",
    "traffic",
    "event_promotion",
  ]),
  funnelStage: z
    .enum(["awareness", "consideration", "evaluation", "conversion", "retention", "advocacy"])
    .nullable()
    .optional(),
  audienceId: z.string().nullable().optional(),
  audienceLabel: z.string().nullable().optional(),
  audiencePain: z.string().max(2000).nullable().optional(),
  offerId: z.string().nullable().optional(),
  offerLabel: z.string().nullable().optional(),
  campaignId: z.string().nullable().optional(),
  campaignLabel: z.string().nullable().optional(),
  contentPillar: z.string().nullable().optional(),
  keyMessage: z.string().min(1).max(500),
  supportingMessages: z.array(z.string().max(500)).max(10).default([]),
  proofPoints: z.array(z.string().max(500)).max(10).default([]),
  differentiators: z.array(z.string().max(500)).max(10).default([]),
  cta: z.string().min(1).max(300),
  channelStrategy: z.array(z.string().max(100)).max(10).default([]),
  suggestedFormats: z.array(z.string().max(100)).max(10).default([]),
  brandVoice: z.string().max(500).nullable().optional(),
  prohibitedClaims: z.array(z.string().max(500)).max(20).default([]),
  evidenceNotes: z.array(z.string().max(1000)).max(10).default([]),
  successMetric: z.string().max(300).nullable().optional(),
  sourceOpportunityId: z.string().nullable().optional(),
  sourceContentId: z.string().nullable().optional(),
});

export const contentIntelligenceBriefOutputSchema = z.object({
  objective: z.string(),
  audienceSummary: z.string().min(1).max(1000),
  audiencePain: z.string().max(1000).optional(),
  keyMessage: z.string().min(1).max(500),
  supportingMessages: z.array(z.string().max(500)).max(8),
  proofPoints: z.array(z.string().max(500)).max(8),
  differentiators: z.array(z.string().max(500)).max(6),
  cta: z.string().min(1).max(300),
  channelStrategy: z.array(z.string().max(100)).max(8),
  suggestedFormats: z.array(z.string().max(100)).max(8),
  contentPillar: z.string().max(200).optional(),
  successMetric: z.string().max(300).optional(),
  evidenceNotes: z.array(z.string().max(500)).max(6).optional(),
  riskFlags: z.array(z.string().max(300)).max(10).optional(),
});

export const contentIntelligenceMasterOutputSchema = z.object({
  title: z.string().min(1).max(300),
  summary: z.string().max(1000).optional(),
  hook: z.string().max(500).optional(),
  body: z.string().min(1).max(20000),
  keyPoints: z.array(z.string().max(500)).max(12),
  cta: z.string().max(300).optional(),
  contentPillar: z.string().max(200).optional(),
  recommendedChannels: z.array(z.string().max(50)).max(8).optional(),
  riskFlags: z.array(z.string().max(300)).max(10).optional(),
});

export type ContentIntelligenceBriefOutput = z.infer<typeof contentIntelligenceBriefOutputSchema>;
export type ContentIntelligenceMasterOutput = z.infer<typeof contentIntelligenceMasterOutputSchema>;

export function serializeBriefToMetadata(brief: ContentBrief): Record<string, unknown> {
  return { ...brief, version: 1 };
}

export function parseBriefFromMetadata(metadata: unknown): ContentBrief | null {
  const parsed = contentBriefSchema.safeParse(metadata);
  if (!parsed.success) return null;
  return parsed.data;
}

export function briefToStudioFields(brief: ContentBrief): {
  title: string;
  studioObjective: string;
  audienceSummary: string | null;
  primaryMessage: string;
  primaryCTA: string;
  contentPillar: string | null;
} {
  return {
    title: brief.keyMessage.slice(0, 120),
    studioObjective: brief.objective,
    audienceSummary: brief.audienceLabel ?? brief.audiencePain ?? null,
    primaryMessage: brief.keyMessage,
    primaryCTA: brief.cta,
    contentPillar: brief.contentPillar ?? null,
  };
}
