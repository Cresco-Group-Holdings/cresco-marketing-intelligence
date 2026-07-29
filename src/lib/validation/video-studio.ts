import { VideoProjectType } from "@prisma/client";
import { z } from "zod";

const text = (max: number) => z.string().trim().min(1).max(max);

export const videoProjectCreateSchema = z.object({
  title: text(200),
  videoType: z.nativeEnum(VideoProjectType),
  contentItemId: z.string().optional(),
  script: text(10_000),
  targetDuration: z.number().int().min(5).max(180).default(30),
  aspectRatio: z.literal("9:16").default("9:16"),
});

export const videoSceneUpdateSchema = z.object({
  durationSeconds: z.number().min(0.5).max(60).optional(),
  narration: z.string().max(2_000).optional(),
  onScreenText: z.string().max(500).optional(),
  visualInstruction: z.string().max(2_000).optional(),
  transition: z.string().max(100).optional(),
  cta: z.string().max(300).optional(),
  sourceAssetId: z.string().optional().nullable(),
});

export const voiceoverSchema = z.object({
  voiceId: z.enum(["approved-en-us-neutral", "approved-en-gb-warm"]),
  language: z.string().min(2).max(20),
  accent: z.string().max(50).optional(),
  pronunciationOverrides: z.record(z.string(), z.string()).optional(),
  clonedVoiceConsentRecord: z.string().max(300).optional(),
});

export const subtitleSchema = z.object({
  cues: z
    .array(
      z.object({
        start: z.number().min(0),
        end: z.number().positive(),
        text: text(500),
        highlightWords: z.array(z.string()).max(10).optional(),
      }),
    )
    .min(1)
    .max(100),
  safeAreaPosition: z.enum(["top", "center", "bottom"]).default("bottom"),
});

export const musicSchema = z.object({
  sourceAssetId: z.string().optional(),
  libraryReference: z.string().max(300).optional(),
  licenceOwner: z.string().max(200).optional(),
  licenceType: z.string().max(100).optional(),
  attribution: z.string().max(500).optional(),
  licenceExpiresAt: z.string().datetime().optional(),
  commercialUsePermission: z.boolean(),
  allowedPlatforms: z.array(z.enum(["INSTAGRAM", "TIKTOK", "YOUTUBE"])).max(3),
});

export const renderRequestSchema = z.object({
  idempotencyKey: text(120),
  attachToContentVariantId: z.string().optional(),
});
