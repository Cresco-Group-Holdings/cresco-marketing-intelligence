import { z } from "zod";
import { ContentStudioType } from "@prisma/client";
import { contentBriefSchema } from "@/lib/content-intelligence/brief";

const briefCreationModeSchema = z.enum([
  "manual",
  "campaign",
  "opportunity",
  "winning_content",
  "competitor_signal",
]);

const contentObjectiveSchema = z.enum([
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
]);

const funnelStageSchema = z.enum([
  "awareness",
  "consideration",
  "evaluation",
  "conversion",
  "retention",
  "advocacy",
]);

export const contentIntelligenceBriefGenerateSchema = z.object({
  mode: briefCreationModeSchema.default("manual"),
  objective: contentObjectiveSchema.optional(),
  funnelStage: funnelStageSchema.nullable().optional(),
  audienceId: z.string().nullable().optional(),
  offerId: z.string().nullable().optional(),
  campaignId: z.string().nullable().optional(),
  contentPillar: z.string().max(200).nullable().optional(),
  sourceContentId: z.string().nullable().optional(),
  sourceOpportunityId: z.string().nullable().optional(),
  competitorSignalId: z.string().nullable().optional(),
  studioType: z.nativeEnum(ContentStudioType).default("SOCIAL_POST"),
  contentId: z.string().optional(),
  idempotencyKey: z.string().min(8).max(128).optional(),
});

export const contentIntelligenceBriefUpdateSchema = contentBriefSchema
  .partial()
  .extend({
    expectedVersion: z.number().int().positive().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one brief field must be provided.",
  });

export const contentIntelligenceMasterGenerateSchema = z.object({
  contentId: z.string(),
  studioType: z.nativeEnum(ContentStudioType).optional(),
  idempotencyKey: z.string().min(8).max(128).optional(),
});

export const contentIntelligenceMasterUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(300).optional(),
    summary: z.string().trim().max(1000).nullable().optional(),
    hook: z.string().trim().max(500).nullable().optional(),
    body: z.string().trim().min(1).max(20000).optional(),
    keyPoints: z.array(z.string().max(500)).max(12).optional(),
    cta: z.string().trim().max(300).nullable().optional(),
    contentPillar: z.string().trim().max(200).nullable().optional(),
    expectedVersion: z.number().int().positive().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one master content field must be provided.",
  });

export type ContentIntelligenceBriefGenerateInput = z.infer<
  typeof contentIntelligenceBriefGenerateSchema
>;
export type ContentIntelligenceBriefUpdateInput = z.infer<
  typeof contentIntelligenceBriefUpdateSchema
>;
export type ContentIntelligenceMasterGenerateInput = z.infer<
  typeof contentIntelligenceMasterGenerateSchema
>;
export type ContentIntelligenceMasterUpdateInput = z.infer<
  typeof contentIntelligenceMasterUpdateSchema
>;
