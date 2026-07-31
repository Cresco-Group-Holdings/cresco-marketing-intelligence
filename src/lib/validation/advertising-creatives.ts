import { z } from "zod";
import {
  AdvertisingChannelType,
  AdvertisingCreativeConceptCategory,
  AdvertisingCreativeFormatType,
  AdvertisingCreativeReviewRole,
  AdvertisingPlanObjectiveType,
} from "@prisma/client";

export const createCreativeProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  campaignPlanId: z.string().optional(),
  primaryFormat: z.nativeEnum(AdvertisingCreativeFormatType).optional(),
  channelType: z.nativeEnum(AdvertisingChannelType).optional(),
  objectiveType: z.nativeEnum(AdvertisingPlanObjectiveType).optional(),
  audienceSummary: z.string().max(1000).optional(),
  placementSummary: z.string().max(1000).optional(),
  offerSummary: z.string().max(1000).optional(),
});

export const generateCopySchema = z.object({
  formatType: z.nativeEnum(AdvertisingCreativeFormatType),
  conceptCategory: z.nativeEnum(AdvertisingCreativeConceptCategory).optional(),
  variantLabel: z.string().optional(),
});

export const addVariantSchema = z.object({
  conceptId: z.string().optional(),
  variantLabel: z.string().min(1),
  hypothesis: z.string().optional(),
  hook: z.string().optional(),
  headline: z.string().optional(),
  primaryText: z.string().optional(),
  cta: z.string().optional(),
});

export const updateCopySchema = z.object({
  variantId: z.string().optional(),
  fieldKey: z.string(),
  fieldValue: z.string(),
  isLocked: z.boolean().optional(),
});

export const attachAssetSchema = z.object({
  variantId: z.string().optional(),
  marketingAssetId: z.string().optional(),
  visualProjectId: z.string().optional(),
  source: z.enum(["ASSET_LIBRARY", "AI_IMAGE_STUDIO", "AI_CAROUSEL_STUDIO", "AI_VIDEO_PIPELINE", "UPLOAD", "EXTERNAL"]),
  isSynthetic: z.boolean().optional(),
});

export const reviewDecisionSchema = z.object({
  reviewerRole: z.nativeEnum(AdvertisingCreativeReviewRole),
  decision: z.enum(["APPROVED", "REJECTED", "CHANGES_REQUESTED"]),
  decisionNote: z.string().max(2000).optional(),
  comment: z.string().max(2000).optional(),
  lockedSections: z.array(z.string()).default([]),
});

export const validateProviderSchema = z.object({
  provider: z.string(),
  formatType: z.nativeEnum(AdvertisingCreativeFormatType),
});
