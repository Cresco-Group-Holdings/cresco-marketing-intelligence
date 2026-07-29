import { TikTokPrivacyLevel } from "@prisma/client";
import { z } from "zod";

export const tikTokPublishSettingsSchema = z.object({
  contentVariantId: z.string(),
  privacyLevel: z.nativeEnum(TikTokPrivacyLevel),
  disableComment: z.boolean().default(false),
  disableDuet: z.boolean().default(false),
  disableStitch: z.boolean().default(false),
  commercialContent: z.boolean().default(false),
  brandOrganicToggle: z.boolean().default(false),
  brandedContentToggle: z.boolean().default(false),
  videoCoverTimestampMs: z.number().int().min(0).max(600_000).optional(),
  audioRightsConfirmed: z.boolean(),
});

export const tikTokPublishRequestSchema = z.object({
  contentVariantId: z.string(),
  socialAccountId: z.string(),
  confirmed: z.literal(true, { error: "Explicit publish confirmation is required." }),
  idempotencyKey: z.string().trim().min(12).max(120),
});

export const tikTokManualConfirmSchema = z.object({
  publicUrl: z.string().trim().url().max(2_000),
});

export type TikTokPublishSettingsInput = z.infer<typeof tikTokPublishSettingsSchema>;
export type TikTokPublishRequestInput = z.infer<typeof tikTokPublishRequestSchema>;
