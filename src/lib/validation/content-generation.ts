import { z } from "zod";
import { ContentType, SocialProvider } from "@prisma/client";
import { CONTENT_GENERATION_LIMITS } from "@/lib/content/generation-limits";

const optionalTrimmed = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

export const contentGenerationModeSchema = z.enum([
  "FROM_IDEA",
  "FROM_OBJECTIVE",
  "FROM_OFFER",
  "FROM_ARTICLE",
  "REPURPOSE",
  "PLATFORM_VARIANTS",
  "REWRITE",
  "SHORTEN",
  "EXPAND",
  "CHANGE_TONE",
  "IMPROVE_CTA",
  "HASHTAGS",
  "VIDEO_SCRIPT",
]);

export const contentGenerationRequestSchema = z
  .object({
    mode: contentGenerationModeSchema,
    title: optionalTrimmed(CONTENT_GENERATION_LIMITS.maxTitleLength),
    brief: optionalTrimmed(CONTENT_GENERATION_LIMITS.maxBriefLength),
    sourceText: optionalTrimmed(CONTENT_GENERATION_LIMITS.maxSourceTextLength),
    sourceContentId: z.string().optional(),
    objectiveId: z.string().optional(),
    audienceId: z.string().optional(),
    personaId: z.string().optional(),
    offerId: z.string().optional(),
    contentPillar: optionalTrimmed(200),
    platforms: z
      .array(z.nativeEnum(SocialProvider))
      .min(1)
      .max(CONTENT_GENERATION_LIMITS.maxPlatforms),
    format: z.nativeEnum(ContentType).default("TEXT_POST"),
    tone: optionalTrimmed(100),
    language: optionalTrimmed(50).default("en"),
    cta: optionalTrimmed(300),
    destinationUrl: optionalTrimmed(2000),
    variantCount: z
      .number()
      .int()
      .min(1)
      .max(CONTENT_GENERATION_LIMITS.maxVariantsPerRequest)
      .default(1),
    provider: z.enum(["MOCK", "OPENAI", "ANTHROPIC", "GOOGLE"]).optional(),
    model: z.string().max(100).optional(),
  })
  .superRefine((value, context) => {
    if (["FROM_ARTICLE", "REPURPOSE"].includes(value.mode) && !value.sourceText?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sourceText"],
        message: "Approved source text is required for article and repurpose generation.",
      });
    }
  });

export const contentRegenerateFieldSchema = z.object({
  field: z.enum([
    "hook",
    "body",
    "caption",
    "headline",
    "cta",
    "hashtags",
    "videoScript",
    "visualBrief",
  ]),
  platform: z.nativeEnum(SocialProvider).optional(),
  instruction: optionalTrimmed(1000),
  provider: z.enum(["MOCK", "OPENAI", "ANTHROPIC", "GOOGLE"]).optional(),
  model: z.string().max(100).optional(),
});

export const contentIdeasRequestSchema = z.object({
  brief: optionalTrimmed(CONTENT_GENERATION_LIMITS.maxBriefLength),
  objectiveId: z.string().optional(),
  audienceId: z.string().optional(),
  offerId: z.string().optional(),
  contentPillar: optionalTrimmed(200),
  count: z.number().int().min(1).max(10).default(5),
  useAi: z.boolean().default(true),
  provider: z.enum(["MOCK", "OPENAI", "ANTHROPIC", "GOOGLE"]).optional(),
  model: z.string().max(100).optional(),
});

export type ContentGenerationMode = z.infer<typeof contentGenerationModeSchema>;
export type ContentGenerationRequest = z.infer<typeof contentGenerationRequestSchema>;
export type ContentRegenerateFieldRequest = z.infer<typeof contentRegenerateFieldSchema>;
export type ContentIdeasRequest = z.infer<typeof contentIdeasRequestSchema>;
