import { z } from "zod";
import {
  ContentApprovalMode,
  ContentPriority,
  ContentRevisionSource,
  ContentStatus,
  ContentType,
  SocialProvider,
} from "@prisma/client";

const trimmed = (max: number) => z.string().trim().min(1).max(max);
const optionalTrimmed = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

export const contentListQuerySchema = z.object({
  status: z.nativeEnum(ContentStatus).optional(),
  ownerUserId: z.string().optional(),
  provider: z.nativeEnum(SocialProvider).optional(),
  search: optionalTrimmed(200),
});

export const contentVariantInputSchema = z.object({
  provider: z.nativeEnum(SocialProvider),
  socialAccountId: z.string().optional(),
  format: z.nativeEnum(ContentType),
  caption: optionalTrimmed(10000),
  headline: optionalTrimmed(500),
  description: optionalTrimmed(5000),
  hashtags: z.array(z.string().trim().max(100)).max(30).optional(),
  mentions: z.array(z.string().trim().max(100)).max(30).optional(),
  destinationUrl: optionalTrimmed(2000),
  firstComment: optionalTrimmed(5000),
  altText: optionalTrimmed(1000),
  thumbnailAssetId: z.string().optional(),
  durationSeconds: z.number().int().positive().optional(),
  aspectRatio: optionalTrimmed(20),
});

export const contentCreateSchema = z.object({
  title: trimmed(300),
  objectiveId: z.string().optional(),
  contentCampaignId: z.string().optional(),
  campaignName: optionalTrimmed(200),
  contentPillar: optionalTrimmed(200),
  contentType: z.nativeEnum(ContentType),
  primaryMessage: optionalTrimmed(10000),
  targetAudienceId: z.string().optional(),
  primaryCTA: optionalTrimmed(300),
  destinationUrl: optionalTrimmed(2000),
  priority: z.nativeEnum(ContentPriority).optional(),
  variants: z.array(contentVariantInputSchema).max(12).optional(),
  assetIds: z.array(z.string()).max(20).optional(),
});

export const contentUpdateSchema = contentCreateSchema
  .partial()
  .extend({
    ownerUserId: z.string().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided.",
  });

export const contentCommentCreateSchema = z.object({
  body: trimmed(5000),
  contentVariantId: z.string().optional(),
});

export const contentApprovalDecisionSchema = z.object({
  decisionNote: optionalTrimmed(2000),
});

export const contentRequestChangesSchema = z.object({
  decisionNote: trimmed(2000),
});

export const contentRevisionRestoreSchema = z.object({
  changeNote: optionalTrimmed(1000),
  source: z.nativeEnum(ContentRevisionSource).optional(),
});

export const contentWorkflowSettingsSchema = z.object({
  approvalMode: z.nativeEnum(ContentApprovalMode),
  separationOfDutiesEnabled: z.boolean(),
});

export type ContentCreateInput = z.infer<typeof contentCreateSchema>;
export type ContentUpdateInput = z.infer<typeof contentUpdateSchema>;
export type ContentVariantInput = z.infer<typeof contentVariantInputSchema>;
