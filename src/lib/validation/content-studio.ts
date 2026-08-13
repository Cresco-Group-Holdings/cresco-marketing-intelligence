import { z } from "zod";
import {
  BrandMarketingChannel,
  ContentKnowledgeReferenceType,
  ContentStatus,
  ContentStudioType,
  ContentType,
} from "@prisma/client";

const trimmed = (max: number) => z.string().trim().min(1).max(max);
const optionalTrimmed = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

export const contentStudioListQuerySchema = z.object({
  status: z.nativeEnum(ContentStatus).optional(),
  studioType: z.nativeEnum(ContentStudioType).optional(),
  ownerUserId: z.string().optional(),
  campaignId: z.string().optional(),
  search: optionalTrimmed(200),
});

export const contentStudioVariantInputSchema = z.object({
  marketingChannel: z.nativeEnum(BrandMarketingChannel),
  format: z.nativeEnum(ContentType).optional(),
  channelBody: optionalTrimmed(50000),
  caption: optionalTrimmed(10000),
  headline: optionalTrimmed(500),
  description: optionalTrimmed(5000),
  destinationUrl: optionalTrimmed(2000),
  altText: optionalTrimmed(1000),
});

export const contentStudioCreateSchema = z.object({
  title: trimmed(300),
  studioType: z.nativeEnum(ContentStudioType),
  contentCampaignId: z.string().optional(),
  studioObjective: optionalTrimmed(2000),
  audienceSummary: optionalTrimmed(5000),
  contentBody: optionalTrimmed(100000),
  primaryCTA: optionalTrimmed(300),
  primaryChannel: z.nativeEnum(BrandMarketingChannel).optional(),
  dueAt: z.string().datetime().optional(),
  scheduledFor: z.string().datetime().optional(),
  timezone: optionalTrimmed(100),
  templateId: z.string().optional(),
  variants: z.array(contentStudioVariantInputSchema).max(20).optional(),
  assetIds: z.array(z.string()).max(20).optional(),
  knowledgeReferences: z
    .array(
      z.object({
        referenceType: z.nativeEnum(ContentKnowledgeReferenceType),
        referenceId: z.string().optional(),
        label: trimmed(300),
        excerpt: optionalTrimmed(5000),
      }),
    )
    .max(30)
    .optional(),
});

export const contentStudioUpdateSchema = contentStudioCreateSchema
  .partial()
  .extend({
    ownerUserId: z.string().optional(),
    expectedVersion: z.number().int().positive().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided.",
  });

export const contentStudioTransitionSchema = z.object({
  toStatus: z.nativeEnum(ContentStatus),
  reason: optionalTrimmed(2000),
});

export const contentStudioReviewDecisionSchema = z.object({
  feedback: optionalTrimmed(5000),
});

export const contentStudioTemplateCreateSchema = z.object({
  name: trimmed(200),
  studioType: z.nativeEnum(ContentStudioType),
  primaryChannel: z.nativeEnum(BrandMarketingChannel).optional(),
  titleTemplate: optionalTrimmed(300),
  objectiveTemplate: optionalTrimmed(2000),
  audienceSummaryTemplate: optionalTrimmed(5000),
  contentBodyTemplate: optionalTrimmed(100000),
  callToActionTemplate: optionalTrimmed(300),
  variantTemplates: z.record(z.string(), z.unknown()).optional(),
});

export const contentStudioKnowledgeRefSchema = z.object({
  referenceType: z.nativeEnum(ContentKnowledgeReferenceType),
  referenceId: z.string().optional(),
  label: trimmed(300),
  excerpt: optionalTrimmed(5000),
});

export const contentStudioScheduleSchema = z
  .object({
    scheduledFor: z.string().datetime(),
    timezone: optionalTrimmed(100),
  })
  .refine(
    (data) => {
      const date = new Date(data.scheduledFor);
      return date.getTime() > Date.now();
    },
    { message: "Scheduled date must be in the future.", path: ["scheduledFor"] },
  );

export type ContentStudioCreateInput = z.infer<typeof contentStudioCreateSchema>;
export type ContentStudioUpdateInput = z.infer<typeof contentStudioUpdateSchema>;
export type ContentStudioVariantInput = z.infer<typeof contentStudioVariantInputSchema>;
export type ContentStudioTemplateCreateInput = z.infer<typeof contentStudioTemplateCreateSchema>;
export type ContentStudioKnowledgeRefInput = z.infer<typeof contentStudioKnowledgeRefSchema>;
